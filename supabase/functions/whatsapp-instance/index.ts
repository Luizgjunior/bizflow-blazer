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

    // ── ACTION: CONNECT ──
    if (action === "connect") {
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      let instanceName = existing?.instance_name;
      let instanceToken = existing?.instance_token;

      if (!existing) {
        // UazAPI v2: POST /instance/init with { name }
        instanceName = `tenant_${tenantId.substring(0, 8)}`;
        const createResult = await tryFetch(`${UAZAPI_URL}/instance/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ name: instanceName }),
        });
        console.log("Create (init) response:", JSON.stringify(createResult.data).substring(0, 500));

        if (!createResult.ok || createResult.data.error) {
          return new Response(JSON.stringify({ 
            error: "Failed to create instance: " + (createResult.data.error || createResult.data.message || JSON.stringify(createResult.data)),
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Extract token from response - could be in various places
        instanceToken = createResult.data.token 
          || createResult.data.instance?.token 
          || createResult.data.data?.token 
          || "";

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
        // Check if current token is still valid by trying to connect first
        const testConnect = await tryFetch(`${UAZAPI_URL}/instance/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": instanceToken || "" },
          body: JSON.stringify({}),
        });
        
        // If token is invalid (401), delete old instance and re-create
        if (testConnect.data?.code === 401 || testConnect.data?.message === "Invalid token.") {
          console.log("Token invalid, re-creating instance...");
          
          // Try to delete old instance from provider
          await tryFetch(`${UAZAPI_URL}/instance/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", "admintoken": UAZAPI_ADMIN_TOKEN },
            body: JSON.stringify({ name: existing.instance_name }),
          });
          
          // Delete local record
          await adminClient.from("whatsapp_instances").delete().eq("tenant_id", tenantId);
          
          // Re-create instance
          instanceName = `tenant_${tenantId.substring(0, 8)}`;
          const reCreateResult = await tryFetch(`${UAZAPI_URL}/instance/init`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "admintoken": UAZAPI_ADMIN_TOKEN },
            body: JSON.stringify({ name: instanceName }),
          });
          console.log("Re-create (init) response:", JSON.stringify(reCreateResult.data).substring(0, 500));
          
          if (!reCreateResult.ok || reCreateResult.data.error) {
            return new Response(JSON.stringify({ 
              error: "Failed to re-create instance: " + (reCreateResult.data.error || reCreateResult.data.message || JSON.stringify(reCreateResult.data)),
            }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          
          instanceToken = reCreateResult.data.token 
            || reCreateResult.data.instance?.token 
            || reCreateResult.data.data?.token 
            || "";
          
          await adminClient.from("whatsapp_instances").insert({
            tenant_id: tenantId,
            instance_name: instanceName,
            instance_token: instanceToken,
            status: "connecting",
          });
        } else {
          await adminClient
            .from("whatsapp_instances")
            .update({ status: "connecting" })
            .eq("tenant_id", tenantId);
            
          // If test connect already returned a QR, use it
          const cd = testConnect.data;
          const qrVal = cd.qrcode || cd.base64 || cd.qr || cd.data?.qrcode || cd.data?.base64 || null;
          if (typeof qrVal === 'string' && qrVal.length > 10) {
            return new Response(JSON.stringify({
              status: "connecting",
              qr_code: qrVal,
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }

      // UazAPI v2: POST /instance/connect to generate QR code
      const connectResult = await tryFetch(`${UAZAPI_URL}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": instanceToken || "",
        },
        body: JSON.stringify({}),
      });
      console.log("Connect response:", JSON.stringify(connectResult.data).substring(0, 500));

      // Extract QR code from response
      let qrString: string | null = null;
      const cd = connectResult.data;
      qrString = cd.qrcode || cd.base64 || cd.qr || cd.data?.qrcode || cd.data?.base64 || cd.instance?.qrcode || null;
      if (typeof qrString !== 'string' || qrString.length < 10) qrString = null;

      return new Response(JSON.stringify({
        status: "connecting",
        qr_code: qrString,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: STATUS ──
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

      // UazAPI v2: GET /instance/status
      const statusResult = await tryFetch(`${UAZAPI_URL}/instance/status`, {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "token": instance.instance_token || "" 
        },
      });
      console.log("Status check response:", JSON.stringify(statusResult.data).substring(0, 500));

      const statusData = statusResult.ok ? statusResult.data : {};

      // Parse connected state
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
      console.log("Parsed connected:", connected, "jid:", jid);

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

      // If not connected, update DB to reflect disconnected status and try to get fresh QR code
      if (!connected) {
        if (instance.status === "connected") {
          await adminClient
            .from("whatsapp_instances")
            .update({ status: "disconnected", phone_number: null })
            .eq("tenant_id", tenantId);
          console.log("Updated instance status to disconnected in DB");
        }

        let qrString: string | null = null;
        const connectResult = await tryFetch(`${UAZAPI_URL}/instance/connect`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "token": instance.instance_token || "" 
          },
          body: JSON.stringify({}),
        });
        if (connectResult.ok) {
          const cd = connectResult.data;
          const val = cd.qrcode || cd.base64 || cd.qr || cd.data?.qrcode || cd.data?.base64 || null;
          if (typeof val === 'string' && val.length > 10) qrString = val;
        }

        return new Response(JSON.stringify({
          status: "disconnected",
          phone_number: null,
          qr_code: qrString,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        status: "connected",
        phone_number: instance.phone_number,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: DISCONNECT ──
    if (action === "disconnect") {
      const { data: instance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (instance) {
        // Step 1: Disconnect the session
        await tryFetch(`${UAZAPI_URL}/instance/disconnect`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "token": instance.instance_token || "" 
          },
          body: JSON.stringify({}),
        });

        // Step 2: Delete the instance from UazAPI
        const deleteResult = await tryFetch(`${UAZAPI_URL}/instance/delete`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "token": instance.instance_token || "",
            "admintoken": UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ name: instance.instance_name }),
        });
        console.log("Delete instance response:", JSON.stringify(deleteResult.data).substring(0, 500));

        // Step 3: Remove the record from the database
        await adminClient
          .from("whatsapp_instances")
          .delete()
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
