import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    if (!instance || instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
    const token = instance.instance_token || "";
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST CHATS ──
    if (action === "chats") {
      const res = await fetch(`${UAZAPI_URL}/chat/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const chats = Array.isArray(data) ? data : (data.data || data.chats || []);

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
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const res = await fetch(`${UAZAPI_URL}/message/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ chatid: chatId, count }),
      });
      const data = await res.json();
      console.log("Messages response status:", res.status, "keys:", Object.keys(data), "sample:", JSON.stringify(data).substring(0, 500));

      let messages = [];
      if (Array.isArray(data)) {
        messages = data;
      } else if (data.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (data.data && Array.isArray(data.data)) {
        messages = data.data;
      }

      return new Response(JSON.stringify({ messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND MESSAGE ──
    if (action === "send") {
      const body = await req.json();
      const { chatId, message } = body;

      if (!chatId || !message) {
        return new Response(JSON.stringify({ error: "chatId and message required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const phone = chatId.replace(/@.*/, "");
      console.log("Sending text to phone:", phone, "chatId:", chatId, "UAZAPI_URL:", UAZAPI_URL);
      
      // Try chatid format first (UazAPI v2 style)
      const sendBody = { phone, text: message };
      console.log("Request body:", JSON.stringify(sendBody));
      
      const res = await fetch(`${UAZAPI_URL}/message/sendText`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify(sendBody),
      });
      const data = await res.json();
      console.log("sendText HTTP status:", res.status, "response:", JSON.stringify(data).substring(0, 500));

      // If 405, try alternative endpoint
      if (data.code === 405) {
        console.log("Trying /chat/sendText as fallback...");
        const res2 = await fetch(`${UAZAPI_URL}/chat/sendText`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": token },
          body: JSON.stringify({ chatid: chatId, text: message }),
        });
        const data2 = await res2.json();
        console.log("chat/sendText response:", res2.status, JSON.stringify(data2).substring(0, 500));
        
        if (data2.code !== 405) {
          return new Response(JSON.stringify(data2), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const phone = chatId.replace(/@.*/, "");
      const res = await fetch(`${UAZAPI_URL}/message/sendMedia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({
          phone,
          media: mediaUrl,
          type: mediaType || "image",
          caption: caption || "",
        }),
      });
      const data = await res.json();

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
