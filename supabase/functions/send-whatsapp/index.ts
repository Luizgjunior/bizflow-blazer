import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    // Update campaign status to sending
    await adminClient
      .from("whatsapp_campaigns")
      .update({ status: "sending", started_at: new Date().toISOString() })
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

    for (const contact of contacts) {
      try {
        const phone = contact.telefone.replace(/\D/g, "");

        let sendResult;

        if (campaign.tipo === "media" && campaign.media_url) {
          // Send media message - UazAPI v2: POST /send/media
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
              caption: campaign.mensagem || "",
            }),
          });
        } else if (campaign.tipo === "template") {
          // Send list/template message
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
          // Send text message - UazAPI v2: POST /send/text
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

      // Update counters
      await adminClient
        .from("whatsapp_campaigns")
        .update({ enviados, falhas })
        .eq("id", campaign_id);

      // Random delay 1-3s between messages
      const delay = Math.floor(Math.random() * 2000) + 1000;
      await sleep(delay);
    }

    // Mark campaign as completed
    await adminClient
      .from("whatsapp_campaigns")
      .update({ status: "completed", finished_at: new Date().toISOString(), enviados, falhas })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({
      message: "Campaign completed",
      enviados,
      falhas,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("send-whatsapp error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
