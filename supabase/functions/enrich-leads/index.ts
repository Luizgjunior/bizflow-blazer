import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { lead_ids, icp_id } = await req.json();

    if (!lead_ids?.length) {
      return new Response(JSON.stringify({ error: "lead_ids é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get leads
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .in("id", lead_ids);

    if (leadsError || !leads?.length) {
      return new Response(JSON.stringify({ error: "Leads não encontrados" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ICP for scoring context
    let icpPayload: Record<string, any> = {};
    if (icp_id) {
      const { data: icp } = await supabase
        .from("icps")
        .select("payload_json")
        .eq("id", icp_id)
        .single();
      if (icp) icpPayload = icp.payload_json as Record<string, any>;
    }

    const results: any[] = [];

    for (const lead of leads) {
      try {
        // Step 1: Advanced scoring
        const advancedScore = calculateAdvancedScore(lead, icpPayload);

        // Step 2: AI qualification
        const aiResult = await classifyWithAI(lead, icpPayload, lovableApiKey);

        // Step 3: Update lead
        const updates: Record<string, any> = {
          score: advancedScore.total,
          raw_json: {
            ...(lead.raw_json as Record<string, any> || {}),
            score_breakdown: advancedScore.breakdown,
            ai_classification: aiResult,
            enriched_at: new Date().toISOString(),
          },
        };

        // Add AI tags
        if (aiResult.tags?.length) {
          const existingTags = lead.tags || [];
          const newTags = [...new Set([...existingTags, ...aiResult.tags])];
          updates.tags = newTags;
        }

        await supabase.from("leads").update(updates).eq("id", lead.id);

        results.push({
          lead_id: lead.id,
          cnpj: lead.cnpj,
          score: advancedScore.total,
          breakdown: advancedScore.breakdown,
          ai: aiResult,
          status: "enriched",
        });
      } catch (leadErr) {
        console.error(`Enrich error for lead ${lead.id}:`, leadErr);
        results.push({ lead_id: lead.id, status: "error", error: String(leadErr) });
      }
    }

    return new Response(
      JSON.stringify({ enriched: results.filter(r => r.status === "enriched").length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("enrich-leads error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateAdvancedScore(
  lead: any,
  icpPayload: Record<string, any>
): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let total = 0;

  // Base: 10 points just for existing
  breakdown.base = 10;
  total += 10;

  // CNAE match: up to 25
  if (icpPayload.cnaes?.length && lead.cnae_principal) {
    const cnaeNorm = (lead.cnae_principal || "").replace(/[^\d]/g, "");
    const exactMatch = icpPayload.cnaes.some((c: string) =>
      cnaeNorm === c.replace(/[^\d]/g, "")
    );
    const prefixMatch = icpPayload.cnaes.some((c: string) =>
      cnaeNorm.startsWith(c.replace(/[^\d]/g, "").slice(0, 4))
    );
    if (exactMatch) {
      breakdown.cnae = 25;
    } else if (prefixMatch) {
      breakdown.cnae = 15;
    } else {
      breakdown.cnae = 0;
    }
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
    const rawJson = lead.raw_json as Record<string, any> || {};
    const leadPorte = rawJson.porte || rawJson.porte_empresa || "";
    if (leadPorte && leadPorte.toLowerCase().includes(icpPayload.porte.toLowerCase())) {
      breakdown.porte = 10;
    } else {
      breakdown.porte = 0;
    }
    total += breakdown.porte;
  }

  // Situação ativa: 10
  if (lead.situacao) {
    breakdown.situacao = lead.situacao === "ATIVA" ? 10 : 0;
    total += breakdown.situacao;
  }

  // Capital social (from raw_json): up to 10
  const rawJson = lead.raw_json as Record<string, any> || {};
  const capitalSocial = parseFloat(rawJson.capital_social || rawJson["capital social"] || "0");
  if (capitalSocial > 100000) {
    breakdown.capital_social = 10;
  } else if (capitalSocial > 10000) {
    breakdown.capital_social = 5;
  } else {
    breakdown.capital_social = 0;
  }
  total += breakdown.capital_social;

  return { total: Math.min(100, Math.max(0, total)), breakdown };
}

async function classifyWithAI(
  lead: any,
  icpPayload: Record<string, any>,
  apiKey: string
): Promise<{ qualification: string; confidence: number; reasoning: string; tags: string[] }> {
  try {
    const rawJson = lead.raw_json as Record<string, any> || {};
    
    const prompt = `Você é um especialista em qualificação de leads B2B para o mercado brasileiro.

Analise este lead e classifique-o considerando o ICP (Perfil de Cliente Ideal) informado.

LEAD:
- Razão Social: ${lead.razao_social}
- CNPJ: ${lead.cnpj}
- UF: ${lead.uf || "N/A"}
- Município: ${lead.municipio || "N/A"}
- CNAE Principal: ${lead.cnae_principal || "N/A"}
- Situação: ${lead.situacao || "N/A"}
- Data Abertura: ${lead.data_abertura || "N/A"}
- Capital Social: ${rawJson.capital_social || rawJson["capital social"] || "N/A"}
- Porte: ${rawJson.porte || rawJson.porte_empresa || "N/A"}

ICP DESEJADO:
- CNAEs buscados: ${icpPayload.cnaes?.join(", ") || "N/A"}
- UF desejada: ${icpPayload.uf || "N/A"}
- Município desejado: ${icpPayload.municipio || "N/A"}
- Porte desejado: ${icpPayload.porte || "N/A"}
- Tempo mínimo abertura: ${icpPayload.tempo_abertura_min || "N/A"} anos

Responda APENAS com JSON válido no formato:
{
  "qualification": "hot" | "warm" | "cold",
  "confidence": 0.0 a 1.0,
  "reasoning": "breve explicação em português",
  "tags": ["tag1", "tag2"]
}

As tags devem descrever características relevantes do lead (ex: "alto capital", "mesmo setor", "região target").`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status);
      return { qualification: "unknown", confidence: 0, reasoning: "Erro na API de IA", tags: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        qualification: parsed.qualification || "unknown",
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || "",
        tags: parsed.tags || [],
      };
    }

    return { qualification: "unknown", confidence: 0, reasoning: "Resposta inválida", tags: [] };
  } catch (err) {
    console.error("AI classification error:", err);
    return { qualification: "unknown", confidence: 0, reasoning: String(err), tags: [] };
  }
}
