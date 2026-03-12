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
    const casaDosKey = Deno.env.get("CASADOSDADOS_API_KEY")!;

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

    const { icp_id } = await req.json();
    if (!icp_id) {
      return new Response(JSON.stringify({ error: "icp_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ICP
    const { data: icp, error: icpError } = await supabase
      .from("icps")
      .select("*")
      .eq("id", icp_id)
      .single();

    if (icpError || !icp) {
      return new Response(JSON.stringify({ error: "ICP não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check tenant limits (only API leads count)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("limites_consulta")
      .eq("id", icp.tenant_id)
      .single();

    const { count: existingLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", icp.tenant_id)
      .not("run_id", "is", null);

    if (tenant && (existingLeads ?? 0) >= tenant.limites_consulta) {
      return new Response(
        JSON.stringify({ error: "Limite de consultas atingido para este tenant" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from("runs")
      .insert({
        tenant_id: icp.tenant_id,
        icp_id: icp.id,
        status: "queued",
      })
      .select()
      .single();

    if (runError) {
      return new Response(JSON.stringify({ error: runError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Casa dos Dados payload from ICP's payload_json
    const payload = icp.payload_json as Record<string, any>;
    const pesquisa: Record<string, any> = {};

    if (payload.cnaes?.length) pesquisa.codigo_atividade_principal = payload.cnaes.map((c: string) => c.replace(/[^\d]/g, ""));
    if (payload.uf) pesquisa.uf = [payload.uf.toLowerCase()];
    if (payload.municipio) pesquisa.municipio = [payload.municipio.toLowerCase()];
    if (payload.bairro) pesquisa.bairro = [payload.bairro.toLowerCase()];
    if (payload.cep) pesquisa.cep = [payload.cep.replace(/[^\d]/g, "")];
    if (payload.situacao_cadastral) pesquisa.situacao_cadastral = [payload.situacao_cadastral];
    else pesquisa.situacao_cadastral = ["ATIVA"];

    if (payload.natureza_juridica) {
      pesquisa.natureza_juridica = [payload.natureza_juridica];
    }

    if (payload.porte) {
      const porteMap: Record<string, string> = {
        MEI: "01",
        ME: "03",
        EPP: "05",
        Demais: "09",
      };
      if (porteMap[payload.porte]) {
        pesquisa.porte_empresa = { codigos: [porteMap[payload.porte]] };
      }
    }

    if (payload.capital_social_min || payload.capital_social_max) {
      pesquisa.capital_social = {};
      if (payload.capital_social_min) pesquisa.capital_social.inicio = payload.capital_social_min;
      if (payload.capital_social_max) pesquisa.capital_social.fim = payload.capital_social_max;
    }

    // Date range: use explicit dates or compute from tempo_abertura_min
    if (payload.data_abertura_inicio || payload.data_abertura_fim) {
      pesquisa.data_abertura = {
        inicio: payload.data_abertura_inicio || "1900-01-01",
        fim: payload.data_abertura_fim || new Date().toISOString().split("T")[0],
      };
    } else if (payload.tempo_abertura_min) {
      const now = new Date();
      const yearsAgo = new Date(now.getFullYear() - payload.tempo_abertura_min, now.getMonth(), now.getDate());
      pesquisa.data_abertura = {
        inicio: "1900-01-01",
        fim: yearsAgo.toISOString().split("T")[0],
      };
    }

    if (payload.com_telefone) pesquisa.com_telefone = true;
    if (payload.com_email) pesquisa.com_email = true;

    // Build exclusion list: manual exclusions + all CNPJs already in the tenant
    const manualExclusions: string[] = [];
    if (payload.exclusoes) {
      payload.exclusoes
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => /^\d{14}$/.test(s))
        .forEach((cnpj: string) => manualExclusions.push(cnpj));
    }

    // Fetch all existing CNPJs for this tenant to avoid duplicates from Casa dos Dados
    const existingCnpjs: string[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch } = await supabase
        .from("leads")
        .select("cnpj")
        .eq("tenant_id", icp.tenant_id)
        .range(offset, offset + batchSize - 1);
      if (!batch || batch.length === 0) break;
      batch.forEach((l: any) => existingCnpjs.push(l.cnpj.replace(/[^\d]/g, "")));
      if (batch.length < batchSize) break;
      offset += batchSize;
    }

    const allExclusions = [...new Set([...manualExclusions, ...existingCnpjs])];
    if (allExclusions.length > 0) {
      pesquisa.excluir = { cnpj: allExclusions };
    }

    // Determine quantity
    const quantidade = payload.quantidade_leads || 100;

    // Call Casa dos Dados v5 to generate file
    const cdBody: Record<string, any> = {
      nome: `LeadFlow_${icp.nome}_${run.id.slice(0, 8)}`,
      tipo: "csv",
      total_linhas: quantidade,
      pesquisa,
    };

    console.log("Calling Casa dos Dados:", JSON.stringify(cdBody));

    // Update run to running
    await supabase.from("runs").update({ status: "running" }).eq("id", run.id);

    const cdResponse = await fetch(
      "https://api.casadosdados.com.br/v5/cnpj/pesquisa/arquivo",
      {
        method: "POST",
        headers: {
          "api-key": casaDosKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cdBody),
      }
    );

    if (!cdResponse.ok) {
      const errorText = await cdResponse.text();
      console.error("Casa dos Dados error:", cdResponse.status, errorText);

      // Detect specific error types for friendly messages
      const isNoBalance = errorText.includes("Sem saldo");
      const isZeroResults = errorText.includes("0 empresas");

      const friendlyError = isNoBalance
        ? "Seu saldo acabou. Recarregue para continuar."
        : isZeroResults
        ? "Nenhuma empresa encontrada com os filtros deste ICP. Tente ajustar os critérios."
        : `Erro na API (${cdResponse.status})`;

      await supabase
        .from("runs")
        .update({
          status: "error",
          error_json: { message: friendlyError, detail: errorText },
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return new Response(
        JSON.stringify({ error: friendlyError, code: isNoBalance ? "NO_BALANCE" : isZeroResults ? "NO_RESULTS" : "API_ERROR" }),
        { status: isNoBalance ? 402 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cdData = await cdResponse.json();
    const arquivoUuid = cdData.arquivo_uuid;

    // Save the arquivo_uuid as casadosdados_job_id
    await supabase
      .from("runs")
      .update({ casadosdados_job_id: arquivoUuid })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        arquivo_uuid: arquivoUuid,
        message: "Run criada e arquivo solicitado. Use check-run para acompanhar.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("run-icp error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
