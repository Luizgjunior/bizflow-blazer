import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function tryFetch(url: string, options: RequestInit): Promise<{ url: string; ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return { url, ok: res.ok, status: res.status, data };
  } catch (err) {
    return { url, ok: false, status: 0, data: { error: err.message } };
  }
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = user.id;
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).single();
    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), { status: 400, headers: corsHeaders });
    }

    const tenantId = profile.tenant_id;
    const UAZAPI_URL = Deno.env.get("UAZAPI_URL") || "";
    const UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "";

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "connect") {
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      let instanceName = existing?.instance_name;
      let instanceToken = existing?.instance_token;

      if (!existing) {
        // Create new instance
        instanceName = `tenant_${tenantId.substring(0, 8)}`;
        const createResult = await tryFetch(`${UAZAPI_URL}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ Name: instanceName, instanceName }),
        });
        console.log("Create response:", JSON.stringify(createResult.data).substring(0, 300));

        if (!createResult.ok || createResult.data.error) {
          return new Response(JSON.stringify({ 
            error: "Failed to create instance: " + (createResult.data.error || createResult.data.message || "Unknown error"),
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        instanceToken = createResult.data.token || createResult.data.instance?.token || "";

        await adminClient.from("whatsapp_instances").insert({
          tenant_id: tenantId,
          instance_name: instanceName,
          instance_token: instanceToken,
          status: "connecting",
        });
      } else if (existing.status === "connected") {
        return new Response(JSON.stringify({ 
          status: "connected", 
          phone_number: existing.phone_number 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connecting" })
          .eq("tenant_id", tenantId);
      }

      // Step 2: Connect/start the instance to generate QR code
      const connectResult = await tryFetch(`${UAZAPI_URL}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instanceToken || "",
        },
        body: JSON.stringify({}),
      });
      console.log("Connect response:", JSON.stringify(connectResult.data).substring(0, 500));

      // Extract QR code from connect response
      let qrString: string | null = null;
      const cd = connectResult.data;
      qrString = cd.qrcode || cd.base64 || cd.qr || cd.data?.qrcode || cd.data?.base64 || cd.instance?.qrcode || null;
      if (typeof qrString !== 'string' || qrString.length < 10) qrString = null;

      // If no QR from connect, try /instance/qr endpoint
      if (!qrString) {
        const qrResult = await tryFetch(`${UAZAPI_URL}/instance/qr`, {
          method: "GET",
          headers: { "token": instanceToken || "" },
        });
        console.log("QR endpoint response:", JSON.stringify(qrResult.data).substring(0, 300));
        if (qrResult.ok) {
          const d = qrResult.data;
          const val = d.qrcode || d.base64 || d.qr || d.data?.qrcode || d.data?.base64 || null;
          if (typeof val === 'string' && val.length > 10) qrString = val;
        }
      }

      return new Response(JSON.stringify({
        status: "connecting",
        qr_code: qrString,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const { data: instance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (!instance) {
        return new Response(JSON.stringify({ status: "disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Try multiple status endpoints
      let statusData: any = {};
      let statusFound = false;

      // Try /instance/status first (UazAPI v2 primary)
      for (const endpoint of [
        { url: `${UAZAPI_URL}/instance/status`, method: "GET" },
        { url: `${UAZAPI_URL}/instance/info`, method: "GET" },
        { url: `${UAZAPI_URL}/instance/connect`, method: "GET" },
      ]) {
        const result = await tryFetch(endpoint.url, {
          method: endpoint.method,
          headers: { 
            "Content-Type": "application/json",
            "token": instance.instance_token || "" 
          },
        });
        console.log(`Status check ${endpoint.url}:`, JSON.stringify(result.data).substring(0, 300));
        
        if (result.ok && result.data && !result.data.error && result.status !== 404) {
          statusData = result.data;
          statusFound = true;
          break;
        }
      }

      // Handle status which can be a string ("connected") or object ({ connected: true })
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

      const jid = (typeof rawStatus === 'object' && rawStatus?.jid) || statusData.instance?.owner || statusData.owner || statusData.phoneNumber || "";
      console.log("Parsed connected:", connected, "jid:", jid, "instanceStatus:", instanceStatus);

      if (connected && instance.status !== "connected") {
        const cleanPhone = typeof jid === 'string' ? jid.replace(/@.*/, "").replace(/:/g, "").replace(/[^0-9]/g, "") : "";
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", phone_number: cleanPhone || "connected" })
          .eq("tenant_id", tenantId);

        return new Response(JSON.stringify({
          status: "connected",
          phone_number: cleanPhone,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check if there's a QR code available (for polling while connecting)
      let qrString: string | null = null;
      if (!connected) {
        // Try /instance/qr for fresh QR
        const qrResult = await tryFetch(`${UAZAPI_URL}/instance/qr`, {
          method: "GET",
          headers: { "token": instance.instance_token || "" },
        });
        if (qrResult.ok) {
          const val = qrResult.data?.qrcode || qrResult.data?.base64 || qrResult.data?.qr || null;
          if (typeof val === 'string' && val.length > 10) qrString = val;
        }
      }

      return new Response(JSON.stringify({
        status: connected ? "connected" : instance.status,
        phone_number: instance.phone_number,
        qr_code: qrString,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      const { data: instance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (instance) {
        await tryFetch(`${UAZAPI_URL}/instance/logout`, {
          method: "DELETE",
          headers: { "token": instance.instance_token || "" },
        });

        await adminClient
          .from("whatsapp_instances")
          .update({ status: "disconnected", phone_number: null })
          .eq("tenant_id", tenantId);
      }

      return new Response(JSON.stringify({ status: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-instance error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
