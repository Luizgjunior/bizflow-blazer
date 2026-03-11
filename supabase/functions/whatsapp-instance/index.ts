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

    const userId = user.id;

    // Get user's tenant_id
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
      // Check if instance already exists
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      let instanceName = existing?.instance_name;
      let instanceToken = existing?.instance_token;

      if (!existing) {
        // Create new instance on UazAPI
        instanceName = `tenant_${tenantId.substring(0, 8)}`;

        const createRes = await fetch(`${UAZAPI_URL}/instance/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ instanceName }),
        });

        const createData = await createRes.json();
        console.log("Create instance response:", JSON.stringify(createData));
        instanceToken = createData.token || createData.instance?.token || createData.data?.token || "";

        // Save instance in DB
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
        // Update status to connecting
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connecting" })
          .eq("tenant_id", tenantId);
      }

      // Get QR Code / connection state
      const qrRes = await fetch(`${UAZAPI_URL}/instance/connectionState/${instanceName}`, {
        method: "GET",
        headers: { "token": instanceToken || "" },
      });

      const qrData = await qrRes.json();
      console.log("ConnectionState response:", JSON.stringify(qrData));

      // Extract QR code from various possible response formats
      const qrValue = qrData.qrcode || qrData.base64 || qrData.qr || qrData.data?.qrcode || qrData.data?.base64 || qrData.data?.qr || null;
      const qrString = typeof qrValue === 'string' ? qrValue : null;

      return new Response(JSON.stringify({
        status: qrData.state === "connected" || qrData.state === "open" ? "connected" : "connecting",
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

      // Check real status on UazAPI
      const statusRes = await fetch(`${UAZAPI_URL}/instance/connectionState/${instance.instance_name}`, {
        method: "GET",
        headers: { "token": instance.instance_token || "" },
      });

      const statusData = await statusRes.json();
      console.log("Status response:", JSON.stringify(statusData));
      const connected = statusData.state === "connected" || statusData.state === "open";

      if (connected && instance.status !== "connected") {
        const phoneNumber = statusData.phoneNumber || statusData.user?.id?.split("@")[0] || statusData.data?.phoneNumber || "";
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", phone_number: phoneNumber })
          .eq("tenant_id", tenantId);

        return new Response(JSON.stringify({
          status: "connected",
          phone_number: phoneNumber,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        status: connected ? "connected" : instance.status,
        phone_number: instance.phone_number,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      const { data: instance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (instance) {
        await fetch(`${UAZAPI_URL}/instance/logout/${instance.instance_name}`, {
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
