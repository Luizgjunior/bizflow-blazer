import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), { status: 400, headers: corsHeaders });
    }

    const tenantId = profile.tenant_id;
    const { numbers } = await req.json();

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return new Response(JSON.stringify({ error: "numbers array required" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get WhatsApp instance for this tenant
    const { data: instance } = await adminClient
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (!instance || instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { status: 400, headers: corsHeaders });
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
    if (!UAZAPI_URL) {
      return new Response(JSON.stringify({ error: "UAZAPI_URL not configured" }), { status: 500, headers: corsHeaders });
    }
    const instanceToken = instance.instance_token || "";

    // Check each number (batch of up to 50 per call)
    const results: { number: string; has_whatsapp: boolean; error?: string }[] = [];

    for (const num of numbers.slice(0, 50)) {
      const phone = String(num).replace(/\D/g, "");
      if (!phone || phone.length < 10) {
        results.push({ number: phone, has_whatsapp: false, error: "invalid_number" });
        continue;
      }

      try {
        const res = await fetch(`${UAZAPI_URL}/contact/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ number: phone }),
        });

        const data = await res.json();
        
        // UazAPI returns exists: true/false or similar
        const hasWhatsapp = data.exists === true || data.numberExists === true || data.status === "valid" || (res.ok && !data.error);
        results.push({ number: phone, has_whatsapp: hasWhatsapp });
      } catch (err) {
        results.push({ number: phone, has_whatsapp: false, error: err.message });
      }

      // Small delay between checks to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    const total = results.length;
    const valid = results.filter(r => r.has_whatsapp).length;
    const invalid = results.filter(r => !r.has_whatsapp).length;

    return new Response(JSON.stringify({ results, summary: { total, valid, invalid } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("check-whatsapp error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
