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
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find active automations where proxima_execucao <= now
    const { data: dueAutomations, error: fetchError } = await supabase
      .from("automations")
      .select("*, icps(*, tenants:tenant_id(limites_consulta))")
      .eq("ativa", true)
      .lte("proxima_execucao", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching automations:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!dueAutomations || dueAutomations.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma automação pendente", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${dueAutomations.length} due automations`);
    const results: any[] = [];

    for (const auto of dueAutomations) {
      try {
        const icp = auto.icps as any;
        if (!icp) {
          console.error(`Automation ${auto.id}: ICP not found`);
          results.push({ automation_id: auto.id, status: "error", error: "ICP not found" });
          continue;
        }

        // Check tenant limits
        const tenant = icp.tenants as any;
        const { count: existingLeads } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", auto.tenant_id);

        if (tenant && (existingLeads ?? 0) >= tenant.limites_consulta) {
          console.log(`Automation ${auto.id}: tenant limit reached`);
          results.push({ automation_id: auto.id, status: "skipped", reason: "limit_reached" });
          // Still update proxima_execucao so it doesn't retry every cycle
          await updateProximaExecucao(supabase, auto);
          continue;
        }

        // Create run
        const { data: run, error: runError } = await supabase
          .from("runs")
          .insert({
            tenant_id: auto.tenant_id,
            icp_id: auto.icp_id,
            status: "queued",
          })
          .select()
          .single();

        if (runError) {
          console.error(`Automation ${auto.id}: run creation failed`, runError);
          results.push({ automation_id: auto.id, status: "error", error: runError.message });
          continue;
        }

        // Build Casa dos Dados payload
        const payload = icp.payload_json as Record<string, any>;
        const pesquisa: Record<string, any> = {};

        if (payload.cnaes?.length) pesquisa.codigo_atividade_principal = payload.cnaes;
        if (payload.uf) pesquisa.uf = [payload.uf.toLowerCase()];
        if (payload.municipio) pesquisa.municipio = [payload.municipio.toLowerCase()];
        if (payload.situacao_cadastral) pesquisa.situacao_cadastral = [payload.situacao_cadastral];
        else pesquisa.situacao_cadastral = ["ATIVA"];

        if (payload.porte) {
          const porteMap: Record<string, string> = { MEI: "01", ME: "03", EPP: "05", Demais: "09" };
          if (porteMap[payload.porte]) pesquisa.porte_empresa = { codigos: [porteMap[payload.porte]] };
        }

        if (payload.tempo_abertura_min) {
          const now = new Date();
          const yearsAgo = new Date(now.getFullYear() - payload.tempo_abertura_min, now.getMonth(), now.getDate());
          pesquisa.data_abertura = { inicio: "1900-01-01", fim: yearsAgo.toISOString().split("T")[0] };
        }

        const cdBody = {
          nome: `Auto_${icp.nome}_${run.id.slice(0, 8)}`,
          tipo: "csv",
          pesquisa,
        };

        await supabase.from("runs").update({ status: "running" }).eq("id", run.id);

        const cdResponse = await fetch(
          "https://api.casadosdados.com.br/v5/cnpj/pesquisa/arquivo",
          {
            method: "POST",
            headers: { "api-key": casaDosKey, "Content-Type": "application/json" },
            body: JSON.stringify(cdBody),
          }
        );

        if (!cdResponse.ok) {
          const errorText = await cdResponse.text();
          console.error(`Automation ${auto.id}: API error`, cdResponse.status, errorText);
          await supabase.from("runs").update({
            status: "error",
            error_json: { message: `API error: ${cdResponse.status}`, detail: errorText },
            finished_at: new Date().toISOString(),
          }).eq("id", run.id);
          results.push({ automation_id: auto.id, run_id: run.id, status: "error" });
        } else {
          const cdData = await cdResponse.json();
          await supabase.from("runs").update({ casadosdados_job_id: cdData.arquivo_uuid }).eq("id", run.id);
          results.push({ automation_id: auto.id, run_id: run.id, status: "triggered" });
        }

        // Update proxima_execucao
        await updateProximaExecucao(supabase, auto);
      } catch (autoErr) {
        console.error(`Automation ${auto.id} failed:`, autoErr);
        results.push({ automation_id: auto.id, status: "error", error: String(autoErr) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("run-automations error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function updateProximaExecucao(supabase: any, auto: any) {
  const now = new Date();
  let next: Date;
  if (auto.frequencia === "diaria") {
    next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else {
    // semanal
    next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  await supabase
    .from("automations")
    .update({ proxima_execucao: next.toISOString() })
    .eq("id", auto.id);
}
