import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between 3s and 15s (reduced to keep batch under 60s total)
function getRandomDelay(): number {
  const min = 3000;
  const max = 15000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Process a batch of contacts (max ~5 per invocation to avoid timeout)
const BATCH_SIZE = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { campaign_id, tenant_id: payloadTenantId } = await req.json();

    let tenantId: string;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    // If called with service role key (self-invoke), use tenant_id from payload
    if (token === serviceRoleKey && payloadTenantId) {
      tenantId = payloadTenantId;
      console.log(`Self-invoke batch for tenant ${tenantId}, campaign ${campaign_id}`);
    } else {
      // Normal user call - validate auth
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "No tenant found" }), { status: 400, headers: corsHeaders });
      }
      tenantId = profile.tenant_id;
    }

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

    const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL") || "";
    if (!EVOLUTION_URL) {
      return new Response(JSON.stringify({ error: "EVOLUTION_URL not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    // Get pending contacts (limited batch)
    const { data: contacts } = await adminClient
      .from("whatsapp_campaign_contacts")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (!contacts || contacts.length === 0) {
      await adminClient
        .from("whatsapp_campaigns")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", campaign_id);

      return new Response(JSON.stringify({ message: "No pending contacts", status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load or generate AI variations
    const useAiVariations = campaign.use_ai_variations === true;
    let aiVariations: string[] = [];
    if (useAiVariations && campaign.ai_variations && Array.isArray(campaign.ai_variations) && campaign.ai_variations.length > 0) {
      aiVariations = campaign.ai_variations;
      console.log(`Loaded ${aiVariations.length} saved AI variations`);
    } else if (useAiVariations && campaign.mensagem && (campaign.enviados || 0) === 0) {
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
              { role: "user", content: `Gere ${Math.max(contacts.length, 5)} variações desta mensagem:\n\n"${campaign.mensagem}"` }
            ],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          aiVariations = content.split("|||").map((v: string) => v.trim()).filter((v: string) => v.length > 0);
          console.log(`Generated ${aiVariations.length} AI variations`);
          // Save variations for reuse across batches
          await adminClient.from("whatsapp_campaigns").update({ ai_variations: aiVariations }).eq("id", campaign_id);
        }
      } catch (aiErr) {
        console.error("AI variations error (proceeding without):", aiErr);
      }
    }

    // Update campaign status to sending (if not already)
    if (campaign.status !== "sending") {
      await adminClient
        .from("whatsapp_campaigns")
        .update({ status: "sending", started_at: new Date().toISOString() })
        .eq("id", campaign_id);
    }

    let enviados = campaign.enviados || 0;
    let falhas = campaign.falhas || 0;

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];

      // Apply random delay (skip first message of first batch)
      if (i > 0 || enviados > 0) {
        const delayMs = getRandomDelay();
        await sleep(delayMs);
      }

      try {
        const phone = contact.telefone.replace(/\D/g, "");
        const messageText = aiVariations.length > 0
          ? aiVariations[(enviados + i) % aiVariations.length]
          : (campaign.mensagem || "");
        
        let sendResult;

        if (campaign.tipo === "media" && campaign.media_url) {
          sendResult = await fetch(`${UAZAPI_URL}/send/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": instanceToken },
            body: JSON.stringify({ number: phone, type: campaign.media_type || "image", file: campaign.media_url, caption: messageText }),
          });
        } else {
          sendResult = await fetch(`${UAZAPI_URL}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": instanceToken },
            body: JSON.stringify({ number: phone, text: messageText }),
          });
        }

        const sendData = await sendResult.json();

        if (sendResult.ok && !sendData.error) {
          enviados++;
          await adminClient
            .from("whatsapp_campaign_contacts")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", contact.id);
        } else {
          falhas++;
          await adminClient
            .from("whatsapp_campaign_contacts")
            .update({ status: "failed", error_message: sendData.error || "Send failed" })
            .eq("id", contact.id);
        }
      } catch (sendErr) {
        falhas++;
        await adminClient
          .from("whatsapp_campaign_contacts")
          .update({ status: "failed", error_message: sendErr.message })
          .eq("id", contact.id);
      }

      // Update counters after each message
      await adminClient
        .from("whatsapp_campaigns")
        .update({ enviados, falhas })
        .eq("id", campaign_id);
    }

    // Check if there are more pending contacts
    const { count: remaining } = await adminClient
      .from("whatsapp_campaign_contacts")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    if ((remaining ?? 0) === 0) {
      await adminClient
        .from("whatsapp_campaigns")
        .update({ status: "completed", finished_at: new Date().toISOString(), enviados, falhas })
        .eq("id", campaign_id);

      return new Response(JSON.stringify({ status: "completed", enviados, falhas, remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Self-invoke for the next batch (fire-and-forget)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ campaign_id, tenant_id: tenantId }),
    }).catch(err => console.error("Self-invoke error:", err));

    return new Response(
      JSON.stringify({ status: "sending", enviados, falhas, remaining, batch_processed: contacts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-whatsapp error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
