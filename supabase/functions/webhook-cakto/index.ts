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
    // Optional secret validation
    const webhookSecret = Deno.env.get("CAKTO_WEBHOOK_SECRET");
    if (webhookSecret) {
      const body = await req.clone().json();
      if (body.secret !== webhookSecret) {
        console.error("Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = await req.json();
    const { event, data } = payload;

    if (!event || !data) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = data.customer?.email;
    if (!customerEmail) {
      console.error("No customer email in payload");
      return new Response(
        JSON.stringify({ error: "No customer email found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find tenant by profile email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("email", customerEmail)
      .maybeSingle();

    // If no profile found, try matching by cakto_customer_email on tenants
    let tenantId = profile?.tenant_id;

    if (!tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("cakto_customer_email", customerEmail)
        .maybeSingle();
      tenantId = tenant?.id;
    }

    if (!tenantId) {
      console.log(`No tenant found for email: ${customerEmail}`);
      return new Response(
        JSON.stringify({
          warning: "No tenant found for this email",
          email: customerEmail,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Determine action based on event
    const activateEvents = ["purchase_approved", "subscription_renewed"];
    const deactivateEvents = [
      "subscription_canceled",
      "refund",
      "chargeback",
    ];

    let action = "none";
    const updateData: Record<string, unknown> = {
      cakto_customer_email: customerEmail,
    };

    if (activateEvents.includes(event)) {
      action = "activate";
      updateData.ativo = true;
      if (data.subscription?.id) {
        updateData.cakto_subscription_id = data.subscription.id;
      }
    } else if (deactivateEvents.includes(event)) {
      action = "deactivate";
      updateData.ativo = false;
    }

    if (action !== "none") {
      const { error: updateError } = await supabase
        .from("tenants")
        .update(updateData)
        .eq("id", tenantId);

      if (updateError) {
        console.error("Error updating tenant:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update tenant" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log(
      `Cakto webhook processed: event=${event}, email=${customerEmail}, tenant=${tenantId}, action=${action}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        event,
        action,
        tenant_id: tenantId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
