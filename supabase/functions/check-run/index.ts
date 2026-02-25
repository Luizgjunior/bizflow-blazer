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

    const { run_id } = await req.json();
    if (!run_id) {
      return new Response(JSON.stringify({ error: "run_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get run
    const { data: run, error: runError } = await supabase
      .from("runs")
      .select("*, icps(payload_json)")
      .eq("id", run_id)
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: "Run não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (run.status === "done") {
      return new Response(
        JSON.stringify({ status: "done", total_leads: run.total_leads }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!run.casadosdados_job_id) {
      return new Response(
        JSON.stringify({ status: run.status, message: "Aguardando envio para API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check file status at Casa dos Dados
    const checkUrl = `https://api.casadosdados.com.br/v4/public/cnpj/pesquisa/arquivo/${run.casadosdados_job_id}`;
    const checkResponse = await fetch(checkUrl, {
      headers: { "api-key": casaDosKey },
    });

    if (checkResponse.status === 202) {
      return new Response(
        JSON.stringify({ status: "running", message: "Arquivo ainda sendo processado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkResponse.ok) {
      const errorText = await checkResponse.text();
      console.error("Check error:", checkResponse.status, errorText);
      return new Response(
        JSON.stringify({ status: "error", message: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkData = await checkResponse.json();
    const downloadLink = checkData.link;

    if (!downloadLink) {
      return new Response(
        JSON.stringify({ status: "running", message: "Arquivo ainda sendo processado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the CSV
    console.log("Downloading CSV from:", downloadLink);
    const csvResponse = await fetch(downloadLink);
    if (!csvResponse.ok) {
      throw new Error(`Failed to download CSV: ${csvResponse.status}`);
    }

    const csvText = await csvResponse.text();

    // Upload CSV to storage
    const filePath = `${run.tenant_id}/${run.id}.csv`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(filePath, csvText, {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
    }

    // Parse CSV
    const lines = csvText.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      await supabase
        .from("runs")
        .update({
          status: "done",
          total_leads: 0,
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      return new Response(
        JSON.stringify({ status: "done", total_leads: 0, message: "Nenhum lead encontrado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = parseCSVLine(lines[0]);
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    console.log("CSV headers:", headers);

    const icpPayload = (run.icps as any)?.payload_json || {};

    // Get existing CNPJs for this tenant to dedup
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("cnpj")
      .eq("tenant_id", run.tenant_id);
    const existingCnpjs = new Set((existingLeads || []).map((l) => l.cnpj));

    const leadsToInsert: any[] = [];
    const seenCnpjs = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 2) continue;

      const getVal = (keys: string[]): string => {
        for (const key of keys) {
          const idx = headerMap[key];
          if (idx !== undefined && values[idx]) return values[idx].trim();
        }
        return "";
      };

      const cnpj = getVal(["cnpj"]).replace(/[^\d]/g, "");
      if (!cnpj || cnpj.length < 11) continue;

      // Dedup: skip if already in tenant or in this batch
      if (existingCnpjs.has(cnpj) || seenCnpjs.has(cnpj)) continue;
      seenCnpjs.add(cnpj);

      const razaoSocial = getVal(["razao_social", "razão social", "razao social"]);
      const uf = getVal(["uf", "estado"]);
      const municipio = getVal(["municipio", "município", "cidade"]);
      const cnaePrincipal = getVal(["cnae_principal", "cnae principal", "cnae_fiscal", "cnae fiscal"]);
      const situacao = getVal(["situacao_cadastral", "situação cadastral", "situacao"]);
      const dataAbertura = getVal(["data_abertura", "data abertura", "data_inicio_atividade"]);

      // Calculate score
      const score = calculateScore(
        { cnae: cnaePrincipal, uf, municipio, dataAbertura },
        icpPayload
      );

      leadsToInsert.push({
        tenant_id: run.tenant_id,
        run_id: run.id,
        cnpj,
        razao_social: razaoSocial || `Empresa ${cnpj}`,
        uf: uf || null,
        municipio: municipio || null,
        cnae_principal: cnaePrincipal || null,
        situacao: situacao || null,
        data_abertura: dataAbertura && isValidDate(dataAbertura) ? dataAbertura : null,
        score,
        raw_json: Object.fromEntries(headers.map((h, idx) => [h, values[idx] || ""])),
      });
    }

    // Insert leads in batches of 500
    let insertedCount = 0;
    for (let i = 0; i < leadsToInsert.length; i += 500) {
      const batch = leadsToInsert.slice(i, i + 500);
      const { error: insertError } = await supabase.from("leads").insert(batch);
      if (insertError) {
        console.error("Lead insert error:", insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    // Create export record
    const { data: signedUrl } = await supabase.storage
      .from("exports")
      .createSignedUrl(filePath, 3600);

    await supabase.from("exports").insert({
      tenant_id: run.tenant_id,
      run_id: run.id,
      file_url: signedUrl?.signedUrl || null,
      tipo: "csv",
      rows_count: insertedCount,
    });

    // Update run
    await supabase
      .from("runs")
      .update({
        status: "done",
        total_leads: insertedCount,
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return new Response(
      JSON.stringify({
        status: "done",
        total_leads: insertedCount,
        deduped: leadsToInsert.length - insertedCount + (seenCnpjs.size - leadsToInsert.length),
        message: `${insertedCount} leads importados com sucesso`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-run error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function calculateScore(
  lead: { cnae: string; uf: string; municipio: string; dataAbertura: string },
  icpPayload: Record<string, any>
): number {
  let score = 50; // Base score

  // CNAE match: +20
  if (icpPayload.cnaes?.length && lead.cnae) {
    const cnaeNorm = lead.cnae.replace(/[^\d]/g, "");
    const match = icpPayload.cnaes.some((c: string) =>
      cnaeNorm.startsWith(c.replace(/[^\d]/g, ""))
    );
    if (match) score += 20;
  }

  // UF match: +10
  if (icpPayload.uf && lead.uf) {
    if (lead.uf.toLowerCase() === icpPayload.uf.toLowerCase()) score += 10;
  }

  // Municipio match: +10
  if (icpPayload.municipio && lead.municipio) {
    if (lead.municipio.toLowerCase().includes(icpPayload.municipio.toLowerCase())) score += 10;
  }

  // Tempo de abertura: +10 if opened more than X years ago
  if (icpPayload.tempo_abertura_min && lead.dataAbertura) {
    try {
      const opened = new Date(lead.dataAbertura);
      const yearsOpen =
        (Date.now() - opened.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (yearsOpen >= icpPayload.tempo_abertura_min) score += 10;
    } catch {
      // ignore date parse errors
    }
  }

  return Math.min(100, Math.max(0, score));
}

function isValidDate(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}
