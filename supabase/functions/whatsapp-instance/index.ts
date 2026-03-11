import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function tryFetch(url: string, options: RequestInit): Promise<{ url: string; ok: boolean; data: any }> {
  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return { url, ok: res.ok, data };
  } catch (err) {
    return { url, ok: false, data: { error: err.message } };
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
        instanceName = `tenant_${tenantId.substring(0, 8)}`;

        // Try multiple create endpoints (v1 and v2 patterns)
        const createEndpoints = [
          { url: `${UAZAPI_URL}/instance/create`, method: "POST" },
          { url: `${UAZAPI_URL}/instance/init`, method: "POST" },
          { url: `${UAZAPI_URL}/v1/instance/create`, method: "POST" },
          { url: `${UAZAPI_URL}/api/instance/create`, method: "POST" },
        ];

        let createData: any = null;
        for (const ep of createEndpoints) {
          const result = await tryFetch(ep.url, {
            method: ep.method,
            headers: {
              "Content-Type": "application/json",
              "admintoken": UAZAPI_ADMIN_TOKEN,
            },
            body: JSON.stringify({ Name: instanceName, instanceName }),
          });
          console.log(`Create attempt ${ep.url}:`, JSON.stringify(result.data));
          
          if (result.ok && !result.data.error && result.data.code !== 404) {
            createData = result.data;
            break;
          }
        }

        if (!createData) {
          return new Response(JSON.stringify({ 
            error: "Failed to create instance on UazAPI. Check admin token and URL.",
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        instanceToken = createData.token || createData.instance?.token || createData.data?.token || "";

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

      // Try multiple QR code endpoints
      const qrEndpoints = [
        `${UAZAPI_URL}/instance/qr/${instanceName}`,
        `${UAZAPI_URL}/instance/connectionState/${instanceName}`,
        `${UAZAPI_URL}/instance/qr`,
        `${UAZAPI_URL}/v1/instance/qr`,
      ];

      let qrString: string | null = null;
      for (const qrUrl of qrEndpoints) {
        const result = await tryFetch(qrUrl, {
          method: "GET",
          headers: { "token": instanceToken || "" },
        });
        console.log(`QR attempt ${qrUrl}:`, JSON.stringify(result.data).substring(0, 200));

        if (result.ok && result.data.code !== 404) {
          const d = result.data;
          const val = d.qrcode || d.base64 || d.qr || d.data?.qrcode || d.data?.base64 || d.data?.qr || d.data?.QRCode || null;
          if (typeof val === 'string' && val.length > 10) {
            qrString = val;
            break;
          }
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
      const statusEndpoints = [
        `${UAZAPI_URL}/instance/qr/${instance.instance_name}`,
        `${UAZAPI_URL}/instance/connectionState/${instance.instance_name}`,
        `${UAZAPI_URL}/instance/connectionState`,
      ];

      let connected = false;
      let phoneNumber = instance.phone_number || "";

      for (const statusUrl of statusEndpoints) {
        const result = await tryFetch(statusUrl, {
          method: "GET",
          headers: { "token": instance.instance_token || "" },
        });

        if (result.ok && result.data.code !== 404) {
          const d = result.data;
          const state = d.state || d.data?.state || d.status;
          connected = state === "connected" || state === "open";
          if (connected) {
            phoneNumber = d.phoneNumber || d.data?.phoneNumber || d.user?.id?.split("@")[0] || phoneNumber;
          }
          console.log(`Status from ${statusUrl}: state=${state}, connected=${connected}`);
          break;
        }
      }

      if (connected && instance.status !== "connected") {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", phone_number: phoneNumber })
          .eq("tenant_id", tenantId);
      }

      return new Response(JSON.stringify({
        status: connected ? "connected" : instance.status,
        phone_number: phoneNumber,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      const { data: instance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (instance) {
        // Try multiple logout endpoints
        for (const logoutUrl of [
          `${UAZAPI_URL}/instance/logout/${instance.instance_name}`,
          `${UAZAPI_URL}/instance/logout`,
        ]) {
          await tryFetch(logoutUrl, {
            method: "DELETE",
            headers: { "token": instance.instance_token || "" },
          });
        }

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
