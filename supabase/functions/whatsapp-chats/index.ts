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

    if (!instance) {
      return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
    const token = instance.instance_token || "";

    // If instance is not marked as connected, check live status from UazAPI
    if (instance.status !== "connected") {
      try {
        const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, {
          method: "GET",
          headers: { "Content-Type": "application/json", "token": token },
        });
        const statusData = await statusRes.json();
        console.log("Live status check:", JSON.stringify(statusData).substring(0, 500));

        const rawStatus = statusData.status;
        const instanceStatus = statusData.instance?.status;
        let connected = false;

        if (typeof rawStatus === 'object' && rawStatus !== null && rawStatus.connected === true) {
          connected = true;
        } else if (instanceStatus === "connected" || instanceStatus === "open") {
          connected = true;
        } else if (typeof rawStatus === 'string' && (rawStatus === "connected" || rawStatus === "open")) {
          connected = true;
        }

        if (connected) {
          const jid = (typeof rawStatus === 'object' && rawStatus?.jid) || statusData.instance?.owner || statusData.owner || statusData.phoneNumber || "";
          const cleanPhone = typeof jid === 'string' ? jid.replace(/@.*/, "").replace(/:/g, "").replace(/[^0-9]/g, "") : "";
          await adminClient
            .from("whatsapp_instances")
            .update({ status: "connected", phone_number: cleanPhone || "connected" })
            .eq("tenant_id", profile.tenant_id);
          console.log("Updated instance status to connected");
        } else {
          return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { 
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }
      } catch (statusErr) {
        console.error("Status check error:", statusErr);
        return new Response(JSON.stringify({ error: "WhatsApp not connected" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST CHATS ──
    if (action === "chats") {
      // Try multiple approaches to get chats
      let chats: any[] = [];
      
      // Approach 1: POST /chat/find with sort
      const res1 = await fetch(`${UAZAPI_URL}/chat/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({
          operator: "AND",
          sort: "-wa_lastMsgTimestamp",
          limit: 100,
          offset: 0,
        }),
      });
      const data1 = await res1.json();
      console.log("chat/find response status:", res1.status, "type:", typeof data1, "isArray:", Array.isArray(data1), "keys:", typeof data1 === 'object' && data1 !== null ? Object.keys(data1) : [], "sample:", JSON.stringify(data1).substring(0, 800));
      
      if (Array.isArray(data1)) {
        chats = data1;
      } else if (data1.data && Array.isArray(data1.data)) {
        chats = data1.data;
      } else if (data1.chats && Array.isArray(data1.chats)) {
        chats = data1.chats;
      } else if (data1.result && Array.isArray(data1.result)) {
        chats = data1.result;
      }

      // Approach 2: If no chats, try GET /chat/list
      if (chats.length === 0) {
        try {
          const res2 = await fetch(`${UAZAPI_URL}/chat/list`, {
            method: "GET",
            headers: { "Content-Type": "application/json", "token": token },
          });
          const data2 = await res2.json();
          console.log("chat/list response status:", res2.status, "sample:", JSON.stringify(data2).substring(0, 800));
          
          if (Array.isArray(data2)) {
            chats = data2;
          } else if (data2.data && Array.isArray(data2.data)) {
            chats = data2.data;
          } else if (data2.chats && Array.isArray(data2.chats)) {
            chats = data2.chats;
          }
        } catch (e) {
          console.log("chat/list fallback failed:", e.message);
        }
      }

      // Approach 3: If still no chats, try POST /chat/find without filters
      if (chats.length === 0) {
        try {
          const res3 = await fetch(`${UAZAPI_URL}/chat/find`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": token },
            body: JSON.stringify({}),
          });
          const data3 = await res3.json();
          console.log("chat/find (no filter) response:", res3.status, "sample:", JSON.stringify(data3).substring(0, 800));
          
          if (Array.isArray(data3)) {
            chats = data3;
          } else if (data3.data && Array.isArray(data3.data)) {
            chats = data3.data;
          } else if (data3.chats && Array.isArray(data3.chats)) {
            chats = data3.chats;
          }
        } catch (e) {
          console.log("chat/find (no filter) fallback failed:", e.message);
        }
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

    // ── SEND TEXT MESSAGE ── UazAPI v2: POST /send/text
    if (action === "send") {
      const body = await req.json();
      const { chatId, message } = body;

      if (!chatId || !message) {
        return new Response(JSON.stringify({ error: "chatId and message required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const number = chatId.replace(/@.*/, "");
      const res = await fetch(`${UAZAPI_URL}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ number, text: message }),
      });
      const data = await res.json();
      console.log("send/text response:", res.status, JSON.stringify(data).substring(0, 500));

      if (!res.ok || data.error || data.code === 405) {
        console.error("send/text failed:", JSON.stringify(data));
        return new Response(JSON.stringify({ error: data.error || data.message || "Envio não permitido." }), {
          status: res.ok ? 403 : res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND MEDIA ── UazAPI v2: POST /send/media
    if (action === "sendMedia") {
      const body = await req.json();
      const { chatId, mediaUrl, mediaType, caption } = body;

      if (!chatId || !mediaUrl) {
        return new Response(JSON.stringify({ error: "chatId and mediaUrl required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const number = chatId.replace(/@.*/, "");
      const res = await fetch(`${UAZAPI_URL}/send/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({
          number,
          type: mediaType || "image",
          file: mediaUrl,
          caption: caption || "",
        }),
      });
      const data = await res.json();
      console.log("send/media response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MARK AS READ ── UazAPI v2: POST /chat/read
    if (action === "markRead") {
      const body = await req.json();
      const { chatId } = body;

      if (!chatId) {
        return new Response(JSON.stringify({ error: "chatId required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const res = await fetch(`${UAZAPI_URL}/chat/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ number: chatId, read: true }),
      });
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE MESSAGE ── UazAPI v2: POST /message/delete
    if (action === "deleteMessage") {
      const body = await req.json();
      const { chatId, messageid } = body;

      if (!chatId || !messageid) {
        return new Response(JSON.stringify({ error: "chatId and messageid required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const res = await fetch(`${UAZAPI_URL}/message/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ id: messageid, chatid: chatId }),
      });
      const data = await res.json();
      console.log("message/delete response:", res.status, JSON.stringify(data).substring(0, 500));

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "getMedia") {
      const body = await req.json();
      const { messageid } = body;

      if (!messageid) {
        return new Response(JSON.stringify({ error: "messageid required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      try {
        // UazAPI v2 correct endpoint: POST /message/download with { id }
        let res = await fetch(`${UAZAPI_URL}/message/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": token },
          body: JSON.stringify({ id: messageid }),
        });

        // Fallback: try with messageid field name
        if (!res.ok) {
          const errBody = await res.text();
          console.log("message/download attempt 1 failed:", res.status, errBody.substring(0, 300));
          res = await fetch(`${UAZAPI_URL}/message/download`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": token },
            body: JSON.stringify({ messageid }),
          });
        }

        // Fallback 2: try /chat/getMediaURL
        if (!res.ok) {
          const errBody2 = await res.text();
          console.log("message/download attempt 2 failed:", res.status, errBody2.substring(0, 300));
          res = await fetch(`${UAZAPI_URL}/chat/getMediaURL`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": token },
            body: JSON.stringify({ messageid }),
          });
        }
        
        console.log("downloadMediaMessage response status:", res.status, "content-type:", res.headers.get("content-type"));

        if (!res.ok) {
          const errText = await res.text();
          console.error("downloadMediaMessage error:", errText.substring(0, 500));
          return new Response(JSON.stringify({ error: "Failed to download media" }), {
            status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const contentType = res.headers.get("content-type") || "application/octet-stream";
        
        // Check if response is JSON (might contain a URL instead of binary)
        if (contentType.includes("application/json")) {
          const jsonData = await res.json();
          console.log("downloadMediaMessage returned JSON:", JSON.stringify(jsonData).substring(0, 500));
          
          // If it returns a URL, proxy that URL
          const mediaUrl = jsonData.url || jsonData.fileURL || jsonData.file || jsonData.media;
          if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('http')) {
            const mediaRes = await fetch(mediaUrl);
            const mediaBuffer = await mediaRes.arrayBuffer();
            return new Response(mediaBuffer, {
              headers: {
                ...corsHeaders,
                "Content-Type": mediaRes.headers.get("content-type") || "application/octet-stream",
                "Cache-Control": "public, max-age=3600",
              },
            });
          }
          
          // If it returns base64
          if (jsonData.base64 || jsonData.data) {
            const b64 = jsonData.base64 || jsonData.data;
            const mimeType = jsonData.mimetype || jsonData.mime || contentType;
            const binaryString = atob(b64.replace(/^data:[^;]+;base64,/, ''));
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
        }

        // Binary response - proxy it directly
        const buffer = await res.arrayBuffer();
        return new Response(buffer, {
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (mediaErr) {
        console.error("getMedia error:", mediaErr);
        return new Response(JSON.stringify({ error: mediaErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── DELETE CHAT ── UazAPI: POST /chat/delete
    if (action === "deleteChat") {
      const body = await req.json();
      const { chatId } = body;

      if (!chatId) {
        return new Response(JSON.stringify({ error: "chatId required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const res = await fetch(`${UAZAPI_URL}/chat/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ chatId }),
      });
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CHECK NUMBER ── UazAPI v2: POST /chat/check
    if (action === "checkNumber") {
      const body = await req.json();
      const { numbers } = body;

      if (!numbers || !Array.isArray(numbers)) {
        return new Response(JSON.stringify({ error: "numbers array required" }), { 
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const res = await fetch(`${UAZAPI_URL}/chat/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ numbers }),
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
