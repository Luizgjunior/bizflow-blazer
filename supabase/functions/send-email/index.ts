import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(): number {
  const min = 500;
  const max = 5000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), { status: 400, headers: corsHeaders });
    }

    const tenantId = profile.tenant_id;
    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: campaign, error: campError } = await adminClient
      .from("email_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("tenant_id", tenantId)
      .single();

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: corsHeaders });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
      return new Response(JSON.stringify({ error: "Resend not configured" }), { status: 500, headers: corsHeaders });
    }

    // AI variations
    const useAiVariations = campaign.use_ai_variations === true;
    let aiVariations: string[] = [];

    // Get pending contacts first (needed for variation count)
    const { data: contacts } = await adminClient
      .from("email_campaign_contacts")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!contacts || contacts.length === 0) {
      await adminClient
        .from("email_campaigns")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", campaign_id);
      return new Response(JSON.stringify({ message: "No pending contacts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (useAiVariations && campaign.mensagem) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em copywriting para e-mail marketing. Gere variações de uma mensagem mantendo o mesmo significado e intenção, mas mudando palavras, estrutura e estilo para parecer natural.
Regras:
- Mantenha o mesmo tom da mensagem original
- Mantenha o mesmo comprimento aproximado
- Varie sinônimos, ordem das frases e estilo
- Cada variação deve ser única
- Se houver {nome} na mensagem, mantenha essa variável exatamente assim
- NÃO adicione prefixos como "Variação 1:" ou números
- Retorne APENAS as variações, uma por linha, separadas por |||`
              },
              { role: "user", content: `Gere ${Math.max(contacts.length, 5)} variações desta mensagem:\n\n"${campaign.mensagem}"` }
            ],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          aiVariations = content.split("|||").map((v: string) => v.trim()).filter((v: string) => v.length > 0);
          console.log(`Generated ${aiVariations.length} AI variations`);
        }
      } catch (aiErr) {
        console.error("AI variations error (proceeding without):", aiErr);
      }
    }

    // Update campaign status
    const startedAt = new Date().toISOString();
    await adminClient
      .from("email_campaigns")
      .update({ status: "sending", started_at: startedAt })
      .eq("id", campaign_id);

    let enviados = campaign.enviados || 0;
    let falhas = campaign.falhas || 0;
    const delays: number[] = [];
    const contactResults: { email: string; nome: string | null; status: string; error?: string; delay_ms: number; sent_at?: string }[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      let delayMs = 0;
      if (i > 0) {
        delayMs = getRandomDelay();
        delays.push(delayMs);
        await sleep(delayMs);
      }

      try {
        const messageText = aiVariations.length > 0
          ? aiVariations[i % aiVariations.length]
          : (campaign.mensagem || "");

        const personalizedMessage = messageText.replace(/\{nome\}/gi, contact.nome || "");

        const sendResult = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: [contact.email],
            subject: (campaign.assunto || "").replace(/\{nome\}/gi, contact.nome || ""),
            html: personalizedMessage,
          }),
        });

        const sendData = await sendResult.json();

        if (sendResult.ok && sendData.id) {
          enviados++;
          const sentAt = new Date().toISOString();
          await adminClient
            .from("email_campaign_contacts")
            .update({ status: "sent", sent_at: sentAt })
            .eq("id", contact.id);
          contactResults.push({ email: contact.email, nome: contact.nome, status: "sent", delay_ms: delayMs, sent_at: sentAt });
        } else {
          falhas++;
          const errMsg = sendData.message || sendData.error || "Send failed";
          await adminClient
            .from("email_campaign_contacts")
            .update({ status: "failed", error_message: errMsg })
            .eq("id", contact.id);
          contactResults.push({ email: contact.email, nome: contact.nome, status: "failed", error: errMsg, delay_ms: delayMs });
        }
      } catch (sendErr) {
        falhas++;
        await adminClient
          .from("email_campaign_contacts")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", contact.id);
        contactResults.push({ email: contact.email, nome: contact.nome, status: "failed", error: sendErr.message, delay_ms: delayMs });
      }

      await adminClient
        .from("email_campaigns")
        .update({ enviados, falhas })
        .eq("id", campaign_id);
    }

    const finishedAt = new Date().toISOString();
    await adminClient
      .from("email_campaigns")
      .update({ status: "completed", finished_at: finishedAt, enviados, falhas })
      .eq("id", campaign_id);

    const totalDelayMs = delays.reduce((a, b) => a + b, 0);
    const avgDelayMs = delays.length > 0 ? Math.round(totalDelayMs / delays.length) : 0;
    const minDelayMs = delays.length > 0 ? Math.min(...delays) : 0;
    const maxDelayMs = delays.length > 0 ? Math.max(...delays) : 0;
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    const report = {
      campaign_id,
      campaign_name: campaign.nome,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_seconds: Math.round(durationMs / 1000),
      total_contacts: contacts.length,
      enviados,
      falhas,
      success_rate: contacts.length > 0 ? Math.round((enviados / contacts.length) * 100) : 0,
      delay_stats: {
        avg_seconds: Math.round(avgDelayMs / 1000),
        min_seconds: Math.round(minDelayMs / 1000),
        max_seconds: Math.round(maxDelayMs / 1000),
        total_wait_seconds: Math.round(totalDelayMs / 1000),
      },
      contacts: contactResults,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
