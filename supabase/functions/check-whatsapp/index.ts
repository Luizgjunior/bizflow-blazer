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
        const res = await fetch(`${UAZAPI_URL}/chat/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken },
          body: JSON.stringify({ numbers: batch }),
        });

        const data = await res.json();
        console.log(`Batch ${i / 50 + 1} response status: ${res.status}, sample:`, JSON.stringify(data).slice(0, 500));

        if (Array.isArray(data)) {
          // Response is an array of results
          for (const item of data) {
            const number = item.number || item.jid?.replace(/@.*/, "") || "";
            const cleanNumber = number.replace(/\D/g, "");
            const hasWhatsapp = item.exists === true || item.numberExists === true || item.status === "valid" || item.isRegistered === true;
            results.push({ number: cleanNumber || batch[data.indexOf(item)] || "", has_whatsapp: hasWhatsapp });
          }
        } else if (data && typeof data === "object" && !data.error) {
          // Single object response or map-like response
          // Try to match numbers from the batch
          for (const phone of batch) {
            // Check if data has the number as key or in a results array
            if (data[phone] !== undefined) {
              results.push({ number: phone, has_whatsapp: !!data[phone] });
            } else if (data.exists !== undefined) {
              // Single number check response
              results.push({ number: phone, has_whatsapp: data.exists === true || data.numberExists === true || data.isRegistered === true });
            } else {
              // Unknown format, assume valid to avoid blocking
              console.log(`Unknown response format for ${phone}, assuming valid`);
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
