import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
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

    // Check tenant limits
    const { data: tenant } = await supabase
      .from("tenants")
      .select("limites_consulta")
      .eq("id", icp.tenant_id)
      .single();

    const { count: existingLeads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", icp.tenant_id);

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

    if (payload.cnaes?.length) pesquisa.codigo_atividade_principal = payload.cnaes;
    if (payload.uf) pesquisa.uf = [payload.uf.toLowerCase()];
    if (payload.municipio) pesquisa.municipio = [payload.municipio.toLowerCase()];
    if (payload.situacao_cadastral) pesquisa.situacao_cadastral = [payload.situacao_cadastral];
    else pesquisa.situacao_cadastral = ["ATIVA"];

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

    if (payload.tempo_abertura_min) {
      const now = new Date();
      const yearsAgo = new Date(now.getFullYear() - payload.tempo_abertura_min, now.getMonth(), now.getDate());
      pesquisa.data_abertura = {
        inicio: "1900-01-01",
        fim: yearsAgo.toISOString().split("T")[0],
      };
    }

    if (payload.exclusoes) {
      const cnpjsToExclude = payload.exclusoes
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => /^\d{14}$/.test(s));
      if (cnpjsToExclude.length) pesquisa.excluir = { cnpj: cnpjsToExclude };
    }

    // Call Casa dos Dados v5 to generate file
    const cdBody = {
      nome: `LeadFlow_${icp.nome}_${run.id.slice(0, 8)}`,
      tipo: "csv",
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
      await supabase
        .from("runs")
        .update({
          status: "error",
          error_json: { message: `API error: ${cdResponse.status}`, detail: errorText },
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return new Response(
        JSON.stringify({ error: "Erro na API Casa dos Dados", detail: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
