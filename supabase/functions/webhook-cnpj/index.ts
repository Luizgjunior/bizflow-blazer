import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function calculateScore(lead: any, icpPayload: Record<string, any>): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let total = 0;

  // Base: 10 points
  breakdown.base = 10;
  total += 10;

  // Situação ativa: 10
  if (lead.situacao) {
    breakdown.situacao = lead.situacao === "ATIVA" ? 10 : 0;
    total += breakdown.situacao;
  }

  // CNAE match: up to 25
  if (icpPayload.cnaes?.length && lead.cnae_principal) {
    const cnaeNorm = (lead.cnae_principal || "").replace(/[^\d]/g, "");
    const exactMatch = icpPayload.cnaes.some((c: string) =>
      cnaeNorm === c.replace(/[^\d]/g, "")
    );
    const prefixMatch = icpPayload.cnaes.some((c: string) =>
      cnaeNorm.startsWith(c.replace(/[^\d]/g, "").slice(0, 4))
    );
    breakdown.cnae = exactMatch ? 25 : prefixMatch ? 15 : 0;
    total += breakdown.cnae;
  }

  // UF match: 10
  if (icpPayload.uf && lead.uf) {
    breakdown.uf = lead.uf.toLowerCase() === icpPayload.uf.toLowerCase() ? 10 : 0;
    total += breakdown.uf;
  }

  // Município match: 10
  if (icpPayload.municipio && lead.municipio) {
    breakdown.municipio = lead.municipio.toLowerCase().includes(icpPayload.municipio.toLowerCase()) ? 10 : 0;
    total += breakdown.municipio;
  }

  // Tempo de abertura: up to 15
  if (lead.data_abertura) {
    try {
      const opened = new Date(lead.data_abertura);
      const yearsOpen = (Date.now() - opened.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (icpPayload.tempo_abertura_min && yearsOpen >= icpPayload.tempo_abertura_min) {
        breakdown.tempo_abertura = 15;
      } else if (yearsOpen >= 5) {
        breakdown.tempo_abertura = 10;
      } else if (yearsOpen >= 2) {
        breakdown.tempo_abertura = 5;
      } else {
        breakdown.tempo_abertura = 0;
      }
      total += breakdown.tempo_abertura;
    } catch {
      breakdown.tempo_abertura = 0;
    }
  }

  // Porte match: 10
  if (icpPayload.porte) {
    const rawJson = lead.raw_json || {};
    const leadPorte = rawJson.porte || rawJson.porte_empresa || "";
    breakdown.porte = leadPorte && leadPorte.toLowerCase().includes(icpPayload.porte.toLowerCase()) ? 10 : 0;
    total += breakdown.porte;
  }

  // Capital social: up to 10
  const rawJson = lead.raw_json || {};
  const capitalSocial = parseFloat(rawJson.capital_social || rawJson["capital social"] || "0");
  breakdown.capital_social = capitalSocial > 100000 ? 10 : capitalSocial > 10000 ? 5 : 0;
  total += breakdown.capital_social;

  return { total: Math.min(100, Math.max(0, total)), breakdown };
}

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

    // Parse webhook format
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

    // Map incoming fields
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

    // Fetch all tenants with limits
    const { data: tenants, error: tenantsError } = await supabase
      .from("tenants")
      .select("id, limites_consulta");

    if (tenantsError || !tenants || tenants.length === 0) {
      return new Response(JSON.stringify({ error: "No tenants found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    const tenantResults: any[] = [];

    for (const tenant of tenants) {
      // Webhook leads não contam contra o limite do tenant

      // Get tenant ICPs for scoring
      const { data: icps } = await supabase
        .from("icps")
        .select("payload_json")
        .eq("tenant_id", tenant.id);

      const icpPayloads = (icps || []).map((i: any) => i.payload_json as Record<string, any>);

      // Deduplicate
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("cnpj")
        .eq("tenant_id", tenant.id);

      const existingCnpjs = new Set((existingLeads || []).map((l: any) => l.cnpj));

      const leadsToInsert = mappedRecords
        .filter((r: any) => {
          if (existingCnpjs.has(r.cnpj)) return false;
          existingCnpjs.add(r.cnpj);
          return true;
        })
        // Webhook leads não contam contra limites
        .map((r: any) => {
          // Calculate best score across all tenant ICPs
          let bestScore = { total: 10, breakdown: { base: 10 } as Record<string, number> };
          for (const icpPayload of icpPayloads) {
            const score = calculateScore(r, icpPayload);
            if (score.total > bestScore.total) {
              bestScore = score;
            }
          }

          return {
            tenant_id: tenant.id,
            run_id: null,
            cnpj: r.cnpj,
            razao_social: r.razao_social,
            uf: r.uf,
            municipio: r.municipio,
            cnae_principal: r.cnae_principal,
            situacao: r.situacao,
            data_abertura: r.data_abertura,
            score: bestScore.total,
            raw_json: {
              ...r.raw_json,
              score_breakdown: bestScore.breakdown,
            },
            tags: ["webhook"],
          };
        });

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

      tenantResults.push({ tenant_id: tenant.id, inserted: leadsToInsert.length });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenants_count: tenants.length,
        total_inserted: totalInserted,
        records_received: records.length,
        valid_records: mappedRecords.length,
        tenant_results: tenantResults,
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
