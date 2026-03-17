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
    const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL") || "";
    if (!EVOLUTION_URL) {
      return new Response(JSON.stringify({ error: "EVOLUTION_URL not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "EVOLUTION_API_KEY not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const evoHeaders = {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const instanceName = `tenant_${tenantId.substring(0, 8)}`;

    // ── ACTION: CONNECT ──
    if (action === "connect") {
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenantId)
        .single();

      if (existing?.status === "connected") {
        return new Response(JSON.stringify({
          status: "connected",
          phone_number: existing.phone_number,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!existing) {
        // Create instance via Evolution API
        const createResult = await tryFetch(`${EVOLUTION_URL}/instance/create`, {
          method: "POST",
          headers: evoHeaders,
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
          }),
        });
        console.log("Create instance response:", JSON.stringify(createResult.data).substring(0, 500));

        if (!createResult.ok || createResult.data.error) {
          return new Response(JSON.stringify({
            error: "Failed to create instance: " + (createResult.data.error || createResult.data.message || JSON.stringify(createResult.data)),
          }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await adminClient.from("whatsapp_instances").insert({
          tenant_id: tenantId,
          instance_name: instanceName,
          instance_token: EVOLUTION_API_KEY,
          status: "connecting",
        });

        // Extract QR from create response
        const qrFromCreate = createResult.data?.qrcode?.base64
          || createResult.data?.hash?.qrcode
          || null;

        if (typeof qrFromCreate === "string" && qrFromCreate.length > 10) {
          return new Response(JSON.stringify({
            status: "connecting",
            qr_code: qrFromCreate,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        // Existing but not connected — update status
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connecting" })
          .eq("tenant_id", tenantId);
      }

      // Generate QR via connect endpoint
      const connectResult = await tryFetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: evoHeaders,
      });
      console.log("Connect response:", JSON.stringify(connectResult.data).substring(0, 500));

      let qrString: string | null = null;
      const cd = connectResult.data;
      qrString = cd?.base64 || cd?.code || cd?.qrcode?.base64 || null;
      if (typeof qrString !== "string" || qrString.length < 10) qrString = null;

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

      const statusResult = await tryFetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
        method: "GET",
        headers: evoHeaders,
      });
      console.log("Status check response:", JSON.stringify(statusResult.data).substring(0, 500));

      const stateData = statusResult.ok ? statusResult.data : {};
      const state = stateData?.instance?.state;
      const connected = state === "open";
      const owner = stateData?.instance?.owner || stateData?.instance?.profileName || "";
      console.log("Parsed connected:", connected, "state:", state, "owner:", owner);

      if (connected && instance.status !== "connected") {
        const cleanPhone = typeof owner === "string"
          ? owner.replace(/@.*/, "").replace(/:/g, "").replace(/[^0-9]/g, "")
          : "";
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", phone_number: cleanPhone || "connected" })
          .eq("tenant_id", tenantId);

        return new Response(JSON.stringify({
          status: "connected",
          phone_number: cleanPhone,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!connected) {
        if (instance.status === "connected") {
          await adminClient
            .from("whatsapp_instances")
            .update({ status: "disconnected", phone_number: null })
            .eq("tenant_id", tenantId);
          console.log("Updated instance status to disconnected in DB");
        }

        // Try to get fresh QR
        let qrString: string | null = null;
        const connectResult = await tryFetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
          method: "GET",
          headers: evoHeaders,
        });
        if (connectResult.ok) {
          const cd = connectResult.data;
          const val = cd?.base64 || cd?.code || cd?.qrcode?.base64 || null;
          if (typeof val === "string" && val.length > 10) qrString = val;
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
        // Logout
        const logoutResult = await tryFetch(`${EVOLUTION_URL}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: evoHeaders,
        });
        console.log("Logout response:", JSON.stringify(logoutResult.data).substring(0, 500));

        // Delete instance
        const deleteResult = await tryFetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers: evoHeaders,
        });
        console.log("Delete instance response:", JSON.stringify(deleteResult.data).substring(0, 500));

        // Remove DB record
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
