import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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

    const { run_id } = await req.json();
    if (!run_id) {
      return new Response(JSON.stringify({ error: "run_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run } = await supabase
      .from("runs")
      .select("tenant_id")
      .eq("id", run_id)
      .single();

    if (!run) {
      return new Response(JSON.stringify({ error: "Run não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get CNPJs already exported for this tenant (from previous exports/runs)
    const { data: previousExports } = await supabase
      .from("exports")
      .select("run_id")
      .eq("tenant_id", run.tenant_id);

    const previousRunIds = (previousExports || [])
      .map((e: any) => e.run_id)
      .filter((id: string) => id !== run_id);

    let alreadyExportedCnpjs = new Set<string>();
    if (previousRunIds.length > 0) {
      // Fetch CNPJs from previously exported runs
      for (let i = 0; i < previousRunIds.length; i += 10) {
        const batch = previousRunIds.slice(i, i + 10);
        const { data: prevLeads } = await supabase
          .from("leads")
          .select("cnpj")
          .in("run_id", batch);
        (prevLeads || []).forEach((l: any) => alreadyExportedCnpjs.add(l.cnpj));
      }
    }

    const { data: allLeads, error: leadsError } = await supabase
      .from("leads")
      .select("cnpj, razao_social, uf, municipio, cnae_principal, situacao, data_abertura, score, notas, tags, raw_json")
      .eq("run_id", run_id)
      .order("score", { ascending: false });

    if (leadsError) throw leadsError;

    // Filter out already exported CNPJs
    const leads = (allLeads || []).filter((l: any) => !alreadyExportedCnpjs.has(l.cnpj));

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "Todos os leads desta run já foram exportados anteriormente" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract phone/email from raw_json
    const extractPhone = (raw: any): string => {
      if (!raw) return "";
      return raw["Telefones"] || raw["telefones"] || raw["telefone"] || raw["Telefone"] || "";
    };

    const extractEmail = (raw: any): string => {
      if (!raw) return "";
      return raw["E-mail"] || raw["e-mail"] || raw["Email"] || raw["email"] || "";
    };

    // Build XLSX
    const rows = leads.map((l) => ({
      "CNPJ": l.cnpj,
      "Razão Social": l.razao_social,
      "Telefone": extractPhone(l.raw_json),
      "E-mail": extractEmail(l.raw_json),
      "UF": l.uf || "",
      "Município": l.municipio || "",
      "CNAE Principal": l.cnae_principal || "",
      "Situação": l.situacao || "",
      "Data Abertura": l.data_abertura || "",
      "Score": l.score ?? 0,
      "Notas": l.notas || "",
      "Tags": (l.tags || []).join("; "),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-size columns
    const colWidths = Object.keys(rows[0]).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...rows.map((r: any) => String(r[key]).length)
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Upload to storage
    const filePath = `${run.tenant_id}/export_${run_id}_${Date.now()}.xlsx`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(filePath, xlsxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Generate signed URL (24h)
    const { data: signedUrl } = await supabase.storage
      .from("exports")
      .createSignedUrl(filePath, 86400);

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from("exports")
      .insert({
        tenant_id: run.tenant_id,
        run_id,
        file_url: signedUrl?.signedUrl || null,
        tipo: "xlsx",
        rows_count: leads.length,
      })
      .select()
      .single();

    if (exportError) throw exportError;

    return new Response(
      JSON.stringify({
        success: true,
        export_id: exportRecord.id,
        download_url: signedUrl?.signedUrl,
        rows_count: leads.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("export-leads error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
