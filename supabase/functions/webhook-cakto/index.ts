import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const { event, data, secret } = payload;

    // Optional secret validation
    const webhookSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
    if (webhookSecret && secret !== webhookSecret) {
      console.error("Invalid webhook secret");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event || !data) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = data.customer?.email;
    const customerName = data.customer?.name || "";
    const offerName = data.offer?.name || "Plano";
    const subscriptionId = data.subscription?.id || null;

    if (!customerEmail) {
      return new Response(
        JSON.stringify({ error: "No customer email found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Determine action based on event
    const activateEvents = ["purchase_approved", "subscription_renewed"];
    const deactivateEvents = ["subscription_canceled", "refund", "chargeback"];

    if (activateEvents.includes(event)) {
      // Check if user already exists by email in profiles
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, tenant_id")
        .eq("email", customerEmail)
        .maybeSingle();

      if (existingProfile?.tenant_id) {
        // User already exists — just activate tenant
        await supabase
          .from("tenants")
          .update({
            ativo: true,
            cakto_customer_email: customerEmail,
            cakto_subscription_id: subscriptionId,
          })
          .eq("id", existingProfile.tenant_id);

        console.log(`Tenant reactivated for ${customerEmail}`);
        return new Response(
          JSON.stringify({ success: true, action: "reactivated", email: customerEmail }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also check by cakto_customer_email on tenants
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("cakto_customer_email", customerEmail)
        .maybeSingle();

      if (existingTenant) {
        await supabase
          .from("tenants")
          .update({ ativo: true, cakto_subscription_id: subscriptionId })
          .eq("id", existingTenant.id);

        console.log(`Tenant reactivated (by cakto email) for ${customerEmail}`);
        return new Response(
          JSON.stringify({ success: true, action: "reactivated", email: customerEmail }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // NEW USER: Create auth user (no password — user will set via "Primeiro Acesso")
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
        user_metadata: {
          nome: customerName,
          empresa_nome: customerName,
          plano: "pro",
        },
      });

      if (authError) {
        // If user already exists in auth but not in profiles (edge case)
        if (authError.message?.includes("already been registered")) {
          console.log(`Auth user already exists for ${customerEmail}, skipping creation`);
          return new Response(
            JSON.stringify({ success: true, action: "user_exists", email: customerEmail }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error("Error creating auth user:", authError);
        return new Response(
          JSON.stringify({ error: "Failed to create user", details: authError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // The handle_new_user trigger will auto-create tenant + profile + role.
      // Now update tenant with cakto fields
      // Small delay to let trigger complete
      await new Promise((r) => setTimeout(r, 1000));

      const { data: newProfile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", authUser.user.id)
        .maybeSingle();

      if (newProfile?.tenant_id) {
        await supabase
          .from("tenants")
          .update({
            ativo: true,
            cakto_customer_email: customerEmail,
            cakto_subscription_id: subscriptionId,
          })
          .eq("id", newProfile.tenant_id);
      }

      console.log(`New user+tenant created for ${customerEmail}`);
      return new Response(
        JSON.stringify({
          success: true,
          action: "created",
          email: customerEmail,
          user_id: authUser.user.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (deactivateEvents.includes(event)) {
      // Find tenant and deactivate
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("email", customerEmail)
        .maybeSingle();

      let tenantId = profile?.tenant_id;

      if (!tenantId) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("cakto_customer_email", customerEmail)
          .maybeSingle();
        tenantId = tenant?.id;
      }

      if (tenantId) {
        await supabase
          .from("tenants")
          .update({ ativo: false })
          .eq("id", tenantId);

        console.log(`Tenant deactivated for ${customerEmail}, event=${event}`);
        return new Response(
          JSON.stringify({ success: true, action: "deactivated", email: customerEmail }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`No tenant found to deactivate for ${customerEmail}`);
      return new Response(
        JSON.stringify({ warning: "No tenant found", email: customerEmail }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unhandled event
    console.log(`Unhandled event: ${event}`);
    return new Response(
      JSON.stringify({ success: true, action: "ignored", event }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
