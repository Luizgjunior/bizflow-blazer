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
      const res = await fetch(`${UAZAPI_URL}/chat/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      console.log("Chat list response keys:", Object.keys(data), "status:", res.status);
      
      // Try multiple response formats
      let chats = [];
      if (Array.isArray(data)) {
        chats = data;
      } else if (data.chats && Array.isArray(data.chats)) {
        chats = data.chats;
      } else if (data.data && Array.isArray(data.data)) {
        chats = data.data;
      }

      return new Response(JSON.stringify({ chats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET MESSAGES FOR A CHAT ──
    if (action === "messages") {
      const body = await req.json();
      const chatId = body.chatId; // e.g. "5511999999999@s.whatsapp.net"
      const count = body.count || 50;

      if (!chatId) {
        return new Response(JSON.stringify({ error: "chatId required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const res = await fetch(`${UAZAPI_URL}/message/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ chatId, count }),
      });
      const data = await res.json();
      console.log("Messages response keys:", Object.keys(data), "status:", res.status);

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

      // Clean phone number from chatId
      const phone = chatId.replace(/@.*/, "");

      const res = await fetch(`${UAZAPI_URL}/message/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ phone, message }),
      });
      const data = await res.json();
      console.log("Send message response:", JSON.stringify(data).substring(0, 300));

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
