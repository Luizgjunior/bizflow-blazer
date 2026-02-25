import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    // If WEBHOOK_SECRET is set, validate it
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    
    // Support both single and batch payloads
    const records = Array.isArray(body) ? body : [body];
    
    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "No records provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require tenant_id in payload
    const tenantId = records[0].tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, limites_consulta")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check limits
    const { count: existingCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if ((existingCount ?? 0) >= tenant.limites_consulta) {
      return new Response(JSON.stringify({ error: "Tenant limit reached" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing CNPJs for dedup
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("cnpj")
      .eq("tenant_id", tenantId);
    const existingCnpjs = new Set((existingLeads || []).map((l) => l.cnpj));

    const leadsToInsert: any[] = [];
    const skipped: string[] = [];

    for (const record of records) {
      const cnpj = (record.cnpj || "").replace(/[^\d]/g, "");
      if (!cnpj || cnpj.length < 11) {
        skipped.push(record.cnpj || "invalid");
        continue;
      }

      if (existingCnpjs.has(cnpj)) {
        skipped.push(cnpj);
        continue;
      }
      existingCnpjs.add(cnpj);

      leadsToInsert.push({
        tenant_id: tenantId,
        run_id: record.run_id || null,
        cnpj,
        razao_social: record.razao_social || `Empresa ${cnpj}`,
        uf: record.uf || null,
        municipio: record.municipio || null,
        cnae_principal: record.cnae_principal || null,
        situacao: record.situacao || "ATIVA",
        data_abertura: record.data_abertura || null,
        score: record.score || 50,
        raw_json: record.raw_json || record,
        tags: record.tags || ["webhook"],
      });
    }

    let insertedCount = 0;
    if (leadsToInsert.length > 0) {
      // Insert in batches
      for (let i = 0; i < leadsToInsert.length; i += 500) {
        const batch = leadsToInsert.slice(i, i + 500);
        const { error: insertError } = await supabase.from("leads").insert(batch);
        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          insertedCount += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        skipped: skipped.length,
        total_received: records.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("webhook-cnpj error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
