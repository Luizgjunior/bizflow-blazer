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

    // Get run to get tenant_id
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

    // Get leads for this run
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("cnpj, razao_social, uf, municipio, cnae_principal, situacao, data_abertura, score, notas, tags")
      .eq("run_id", run_id)
      .order("score", { ascending: false });

    if (leadsError) throw leadsError;
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum lead encontrado para esta run" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate CSV
    const csvHeaders = [
      "CNPJ", "Razão Social", "UF", "Município", "CNAE Principal",
      "Situação", "Data Abertura", "Score", "Notas", "Tags"
    ];

    const csvRows = leads.map((l) => [
      l.cnpj,
      escapeCSV(l.razao_social),
      l.uf || "",
      escapeCSV(l.municipio || ""),
      l.cnae_principal || "",
      l.situacao || "",
      l.data_abertura || "",
      String(l.score ?? 0),
      escapeCSV(l.notas || ""),
      (l.tags || []).join("; "),
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");

    // Upload to storage
    const filePath = `${run.tenant_id}/export_${run_id}_${Date.now()}.csv`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(filePath, csvContent, {
        contentType: "text/csv",
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
        tipo: "csv",
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

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
