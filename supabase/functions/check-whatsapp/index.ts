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

    const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL") || "";
    if (!EVOLUTION_URL) {
      return new Response(JSON.stringify({ error: "EVOLUTION_URL not configured" }), { status: 500, headers: corsHeaders });
    }
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Normalize all numbers
    const normalizedNumbers = numbers.slice(0, 200).map((num: string) => {
      let phone = String(num).replace(/\D/g, "");
      if (phone.length >= 10 && !phone.startsWith("55")) phone = "55" + phone;
      return phone;
    }).filter((p: string) => p.length >= 12);

    console.log(`Checking ${normalizedNumbers.length} numbers via UazAPI`);

    const results: { number: string; has_whatsapp: boolean; error?: string }[] = [];

    // Process in batches of 50 using the batch endpoint
    for (let i = 0; i < normalizedNumbers.length; i += 50) {
      const batch = normalizedNumbers.slice(i, i + 50);
      
      try {
        const res = await fetch(`${EVOLUTION_URL}/chat/whatsappNumbers/${instance.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": EVOLUTION_API_KEY },
          body: JSON.stringify({ numbers: batch }),
        });

        const data = await res.json();
        console.log(`Batch ${i / 50 + 1} response status: ${res.status}, sample:`, JSON.stringify(data).slice(0, 500));

        if (Array.isArray(data)) {
          for (const item of data) {
            const cleanNumber = (item.jid?.replace(/@.*/, "") || "").replace(/\D/g, "");
            results.push({ number: cleanNumber || batch[data.indexOf(item)] || "", has_whatsapp: item.exists === true });
          }
        } else if (data && typeof data === "object" && !data.error) {
          // Object with results array or unexpected format
          const items = data.results || data.data || [];
          if (Array.isArray(items) && items.length > 0) {
            for (const item of items) {
              const cleanNumber = (item.jid?.replace(/@.*/, "") || "").replace(/\D/g, "");
              results.push({ number: cleanNumber || batch[items.indexOf(item)] || "", has_whatsapp: item.exists === true });
            }
          } else {
            console.log(`Unknown response format, keeping all ${batch.length} numbers`);
            for (const phone of batch) {
              results.push({ number: phone, has_whatsapp: true });
            }
          }
        } else {
          // Error or unexpected format - keep all numbers
          console.log(`API error or unexpected format, keeping all ${batch.length} numbers`);
          for (const phone of batch) {
            results.push({ number: phone, has_whatsapp: true });
          }
        }
      } catch (err) {
        console.error(`Batch ${i / 50 + 1} error:`, err.message);
        // On error, keep all numbers in batch
        for (const phone of batch) {
          results.push({ number: phone, has_whatsapp: true, error: err.message });
        }
      }

      // Small delay between batches
      if (i + 50 < normalizedNumbers.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Add results for numbers that were filtered out (too short)
    const invalidNumbers = numbers.slice(0, 200).filter((num: string) => {
      let phone = String(num).replace(/\D/g, "");
      if (phone.length >= 10 && !phone.startsWith("55")) phone = "55" + phone;
      return phone.length < 12;
    });
    for (const num of invalidNumbers) {
      results.push({ number: String(num).replace(/\D/g, ""), has_whatsapp: false, error: "invalid_number" });
    }

    const total = results.length;
    const valid = results.filter(r => r.has_whatsapp).length;
    const invalid = results.filter(r => !r.has_whatsapp).length;

    console.log(`Check complete: ${total} total, ${valid} valid, ${invalid} invalid`);

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
