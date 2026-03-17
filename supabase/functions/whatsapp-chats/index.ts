import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: instance } = await adminClient
      .from("whatsapp_instances")
      .select("*")
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (!instance) {
      return new Response(JSON.stringify({ error: "WhatsApp not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL") || "";
    if (!EVOLUTION_URL) {
      return new Response(JSON.stringify({ error: "EVOLUTION_URL not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "EVOLUTION_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const instanceName = instance.instance_name;
    const evoHeaders = {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    };

    if (instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "WhatsApp not connected" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST CHATS ──
    if (action === "chats") {
      const res = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      console.log("findChats response status:", res.status, "isArray:", Array.isArray(data), "sample:", JSON.stringify(data).substring(0, 800));

      let chats: any[] = [];
      if (Array.isArray(data)) {
        chats = data;
      } else if (data?.data && Array.isArray(data.data)) {
        chats = data.data;
      } else if (data?.chats && Array.isArray(data.chats)) {
        chats = data.chats;
      }

      console.log("Total chats found:", chats.length);

      return new Response(JSON.stringify({ chats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET MESSAGES FOR A CHAT ──
    if (action === "messages") {
      const body = await req.json();
      const chatId = body.chatId;
      const count = body.count || 50;

      if (!chatId) {
        return new Response(JSON.stringify({ error: "chatId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${EVOLUTION_URL}/chat/findMessages/${instanceName}`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({
          where: { key: { remoteJid: chatId } },
          limit: count,
        }),
      });
      const data = await res.json();
      console.log("findMessages response status:", res.status, "sample:", JSON.stringify(data).substring(0, 500));

      let messages: any[] = [];
      if (data?.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (data?.messages?.records && Array.isArray(data.messages.records)) {
        messages = data.messages.records;
      } else if (Array.isArray(data)) {
        messages = data;
      } else if (data?.data?.messages && Array.isArray(data.data.messages)) {
        messages = data.data.messages;
      } else if (data?.data && Array.isArray(data.data)) {
        messages = data.data;
      }

      return new Response(JSON.stringify({ messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND TEXT MESSAGE ──
    if (action === "send") {
      const body = await req.json();
      const { chatId, message } = body;

      if (!chatId || !message) {
        return new Response(JSON.stringify({ error: "chatId and message required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const number = chatId.replace(/@.*/, "");
      const res = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({ number, text: message }),
      });
      const data = await res.json();
      console.log("sendText response:", res.status, JSON.stringify(data).substring(0, 500));

      if (!res.ok || data.error) {
        console.error("sendText failed:", JSON.stringify(data));
        return new Response(JSON.stringify({ error: data.error || data.message || "Envio não permitido." }), {
          status: res.ok ? 403 : res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND MEDIA ──
    if (action === "sendMedia") {
      const body = await req.json();
      const { chatId, mediaUrl, mediaType, caption } = body;

      if (!chatId || !mediaUrl) {
        return new Response(JSON.stringify({ error: "chatId and mediaUrl required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const number = chatId.replace(/@.*/, "");
      const res = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instanceName}`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({
          number,
          mediatype: mediaType || "image",
          media: mediaUrl,
          caption: caption || "",
        }),
      });
      const data = await res.json();
      console.log("sendMedia response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MARK AS READ ──
    if (action === "markRead") {
      const body = await req.json();
      const { chatId } = body;

      if (!chatId) {
        return new Response(JSON.stringify({ error: "chatId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${EVOLUTION_URL}/chat/markMessageAsRead/${instanceName}`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({
          readMessages: [{ remoteJid: chatId, fromMe: false, id: "" }],
        }),
      });
      const data = await res.json();
      console.log("markRead response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE MESSAGE ──
    if (action === "deleteMessage") {
      const body = await req.json();
      const { chatId, messageid } = body;

      if (!chatId || !messageid) {
        return new Response(JSON.stringify({ error: "chatId and messageid required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${EVOLUTION_URL}/message/delete/${instanceName}`, {
        method: "DELETE",
        headers: evoHeaders,
        body: JSON.stringify({ id: messageid, remoteJid: chatId, fromMe: true }),
      });
      const data = await res.json();
      console.log("deleteMessage response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET MEDIA ──
    if (action === "getMedia") {
      const body = await req.json();
      const { messageid } = body;

      if (!messageid) {
        return new Response(JSON.stringify({ error: "messageid required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instanceName}`, {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({
            message: { key: { id: messageid } },
            convertToMp4: false,
          }),
        });

        console.log("getBase64FromMediaMessage response status:", res.status);

        if (!res.ok) {
          const errText = await res.text();
          console.error("getBase64FromMediaMessage error:", errText.substring(0, 500));
          return new Response(JSON.stringify({ error: "Failed to download media" }), {
            status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const jsonData = await res.json();
        console.log("getBase64FromMediaMessage keys:", Object.keys(jsonData));

        const b64 = jsonData.base64;
        const mimeType = jsonData.mimetype || "application/octet-stream";

        if (b64 && typeof b64 === "string") {
          const cleanB64 = b64.replace(/^data:[^;]+;base64,/, "");
          const binaryString = atob(cleanB64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return new Response(bytes, {
            headers: {
              ...corsHeaders,
              "Content-Type": mimeType,
              "Cache-Control": "public, max-age=3600",
            },
          });
        }

        return new Response(JSON.stringify({ error: "Unexpected media response format" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (mediaErr) {
        console.error("getMedia error:", mediaErr);
        return new Response(JSON.stringify({ error: mediaErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── DELETE CHAT ──
    if (action === "deleteChat") {
      const body = await req.json();
      const { chatId } = body;

      if (!chatId) {
        return new Response(JSON.stringify({ error: "chatId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Deleting chat:", chatId);

      const res = await fetch(`${EVOLUTION_URL}/chat/deleteMessage/${instanceName}`, {
        method: "DELETE",
        headers: evoHeaders,
        body: JSON.stringify({ remoteJid: chatId }),
      });
      let data: any = {};
      try { data = await res.json(); } catch { /* ignore */ }
      console.log("deleteChat response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify({ success: true, ...data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CHECK NUMBER ──
    if (action === "checkNumber") {
      const body = await req.json();
      const { numbers } = body;

      if (!numbers || !Array.isArray(numbers)) {
        return new Response(JSON.stringify({ error: "numbers array required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${EVOLUTION_URL}/chat/whatsappNumbers/${instanceName}`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({ numbers }),
      });
      const data = await res.json();
      console.log("whatsappNumbers response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-chats error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
