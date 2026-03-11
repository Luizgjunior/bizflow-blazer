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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

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

        const createRes = await fetch(`${UAZAPI_URL}/instance/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ instanceName }),
        });

        const createData = await createRes.json();
        instanceToken = createData.token || createData.instance?.token || "";

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
        // Re-initialize if disconnected
        await fetch(`${UAZAPI_URL}/instance/init`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "admintoken": UAZAPI_ADMIN_TOKEN,
          },
          body: JSON.stringify({ instanceName }),
        });

        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connecting" })
          .eq("tenant_id", tenantId);
      }

      // Get QR Code
      const qrRes = await fetch(`${UAZAPI_URL}/instance/qr`, {
        method: "GET",
        headers: { "token": instanceToken || "" },
      });

      const qrData = await qrRes.json();
      console.log("QR API response:", JSON.stringify(qrData));

      // Try multiple possible field names from UazAPI response
      const qrValue = qrData.qrcode || qrData.base64 || qrData.data || qrData.qr || qrData.value || qrData.code || null;

      return new Response(JSON.stringify({
        status: "connecting",
        qr_code: typeof qrValue === 'string' ? qrValue : null,
        qr_raw: qrData,
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
      const statusRes = await fetch(`${UAZAPI_URL}/instance/connectionState`, {
        method: "GET",
        headers: { "token": instance.instance_token || "" },
      });

      const statusData = await statusRes.json();
      const connected = statusData.state === "connected" || statusData.state === "open";

      if (connected && instance.status !== "connected") {
        // Update DB with connected status
        const phoneNumber = statusData.phoneNumber || statusData.user?.id?.split("@")[0] || "";
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
        await fetch(`${UAZAPI_URL}/instance/logout`, {
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
