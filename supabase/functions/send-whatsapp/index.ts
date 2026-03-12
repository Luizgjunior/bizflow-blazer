import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between 1s and 360s (never the same pattern)
function getRandomDelay(): number {
  const min = 1000;   // 1 second
  const max = 360000; // 360 seconds
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

    // Get campaign
    const { data: campaign, error: campError } = await adminClient
      .from("whatsapp_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("tenant_id", tenantId)
      .single();

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: corsHeaders });
    }

    // Get WhatsApp instance
    const { data: instance } = await adminClient
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", tenantId)
      .single();

    if (!instance || instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { status: 400, headers: corsHeaders });
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
    const instanceToken = instance.instance_token || "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    // Check if AI variations are enabled
    const useAiVariations = campaign.use_ai_variations === true;

    // Pre-generate AI variations if enabled
    let aiVariations: string[] = [];
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
                content: `Você é um especialista em copywriting para WhatsApp. Gere variações de uma mensagem mantendo o mesmo significado e intenção, mas mudando palavras, estrutura e estilo para parecer natural e escrita por uma pessoa diferente a cada vez.
Regras:
- Mantenha o mesmo tom da mensagem original
- Mantenha o mesmo comprimento aproximado
- Varie sinônimos, ordem das frases, pontuação e emojis
- Cada variação deve ser única
- Se houver {nome} na mensagem, mantenha essa variável exatamente assim
- NÃO adicione prefixos como "Variação 1:" ou números
- Retorne APENAS as variações, uma por linha, separadas por |||`
              },
              { role: "user", content: `Gere ${Math.max(contacts!.length, 5)} variações desta mensagem:\n\n"${campaign.mensagem}"` }
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

    // Update campaign status to sending
    const startedAt = new Date().toISOString();
    await adminClient
      .from("whatsapp_campaigns")
      .update({ status: "sending", started_at: startedAt })
      .eq("id", campaign_id);

    // Get pending contacts
    const { data: contacts } = await adminClient
      .from("whatsapp_campaign_contacts")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!contacts || contacts.length === 0) {
      await adminClient
        .from("whatsapp_campaigns")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", campaign_id);

      return new Response(JSON.stringify({ message: "No pending contacts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enviados = campaign.enviados || 0;
    let falhas = campaign.falhas || 0;
    const delays: number[] = [];
    const contactResults: { telefone: string; nome: string | null; status: string; error?: string; delay_ms: number; sent_at?: string }[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Apply random delay before sending (skip first message)
      let delayMs = 0;
      if (i > 0) {
        delayMs = getRandomDelay();
        delays.push(delayMs);
        await sleep(delayMs);
      }

      try {
        const phone = contact.telefone.replace(/\D/g, "");
        // Pick AI variation or fallback to original message
        const messageText = aiVariations.length > 0
          ? aiVariations[i % aiVariations.length]
          : (campaign.mensagem || "");
        let sendResult;

        if (campaign.tipo === "media" && campaign.media_url) {
          sendResult = await fetch(`${UAZAPI_URL}/send/media`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instanceToken,
            },
            body: JSON.stringify({
              number: phone,
              type: campaign.media_type || "image",
              file: campaign.media_url,
              caption: messageText,
            }),
          });
        } else if (campaign.tipo === "template") {
          sendResult = await fetch(`${UAZAPI_URL}/message/sendList`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instanceToken,
            },
            body: JSON.stringify({
              phone,
              title: campaign.nome,
              description: campaign.mensagem || "",
              buttonText: "Ver opções",
              sections: [{
                title: "Menu",
                rows: [{ title: "Saiba mais", description: campaign.mensagem || "" }],
              }],
            }),
          });
        } else {
          sendResult = await fetch(`${UAZAPI_URL}/send/text`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "token": instanceToken,
            },
            body: JSON.stringify({
              number: phone,
              text: campaign.mensagem || "",
            }),
          });
        }

        const sendData = await sendResult.json();

        if (sendResult.ok && !sendData.error) {
          enviados++;
          const sentAt = new Date().toISOString();
          await adminClient
            .from("whatsapp_campaign_contacts")
            .update({ status: "sent", sent_at: sentAt })
            .eq("id", contact.id);
          contactResults.push({ telefone: contact.telefone, nome: contact.nome, status: "sent", delay_ms: delayMs, sent_at: sentAt });
        } else {
          falhas++;
          const errMsg = sendData.error || "Send failed";
          await adminClient
            .from("whatsapp_campaign_contacts")
            .update({ status: "failed", error_message: errMsg })
            .eq("id", contact.id);
          contactResults.push({ telefone: contact.telefone, nome: contact.nome, status: "failed", error: errMsg, delay_ms: delayMs });
        }
      } catch (sendErr) {
        falhas++;
        await adminClient
          .from("whatsapp_campaign_contacts")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", contact.id);
        contactResults.push({ telefone: contact.telefone, nome: contact.nome, status: "failed", error: sendErr.message, delay_ms: delayMs });
      }

      // Update counters in real-time
      await adminClient
        .from("whatsapp_campaigns")
        .update({ enviados, falhas })
        .eq("id", campaign_id);
    }

    // Mark campaign as completed
    const finishedAt = new Date().toISOString();
    await adminClient
      .from("whatsapp_campaigns")
      .update({ status: "completed", finished_at: finishedAt, enviados, falhas })
      .eq("id", campaign_id);

    // Generate report
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
    console.error("send-whatsapp error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
