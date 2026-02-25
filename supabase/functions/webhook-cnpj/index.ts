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

    // Optional webhook secret validation
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Parse Casa dos Dados format: { data_evento, evento: [...] } or flat array
    let records: any[];
    if (body.evento && Array.isArray(body.evento)) {
      records = body.evento;
    } else if (Array.isArray(body)) {
      records = body;
    } else {
      records = [body];
    }

    if (records.length === 0) {
      return new Response(JSON.stringify({ error: "No records provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map Casa dos Dados fields to leads fields
    const mappedRecords = records.map((r: any) => {
      const cnpj = (r.cnpj || "").replace(/[^\d]/g, "");
      return {
        cnpj,
        razao_social: r.razao_social || r.nome_fantasia || `Empresa ${cnpj}`,
        uf: r.uf || null,
        municipio: r.municipio || null,
        cnae_principal: r.cnae_fiscal?.toString() || r.cnae_principal || null,
        situacao: r.situacao_cadastral || r.situacao || "ATIVA",
        data_abertura: r.data_inicio_atividade || r.data_abertura || null,
        raw_json: r,
      };
    }).filter((r: any) => r.cnpj && r.cnpj.length >= 11);

    if (mappedRecords.length === 0) {
      return new Response(JSON.stringify({ error: "No valid CNPJs in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id");

    if (tenantsError || !tenants || tenants.length === 0) {
      console.error("Error fetching tenants:", tenantsError);
      return new Response(JSON.stringify({ error: "No tenants found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;

    // For each tenant, deduplicate and insert
    for (const tenant of tenants) {
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("cnpj")
        .eq("tenant_id", tenant.id);

      const existingCnpjs = new Set((existingLeads || []).map((l: any) => l.cnpj));

      const leadsToInsert = mappedRecords
        .filter((r: any) => {
          if (existingCnpjs.has(r.cnpj)) return false;
          existingCnpjs.add(r.cnpj); // prevent duplicates within batch
          return true;
        })
        .map((r: any) => ({
          tenant_id: tenant.id,
          run_id: null,
          cnpj: r.cnpj,
          razao_social: r.razao_social,
          uf: r.uf,
          municipio: r.municipio,
          cnae_principal: r.cnae_principal,
          situacao: r.situacao,
          data_abertura: r.data_abertura,
          score: 50,
          raw_json: r.raw_json,
          tags: ["webhook", "casa-dos-dados"],
        }));

      if (leadsToInsert.length > 0) {
        for (let i = 0; i < leadsToInsert.length; i += 500) {
          const batch = leadsToInsert.slice(i, i + 500);
          const { error: insertError } = await supabase.from("leads").insert(batch);
          if (insertError) {
            console.error(`Insert error for tenant ${tenant.id}:`, insertError);
          } else {
            totalInserted += batch.length;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenants_count: tenants.length,
        total_inserted: totalInserted,
        records_received: records.length,
        valid_records: mappedRecords.length,
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
