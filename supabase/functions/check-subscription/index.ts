import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_TO_PLAN: Record<string, { plano: string; limites: number }> = {
  "price_1T6Wu13j4H2XXSTTlIR84BiV": { plano: "pro", limites: 6000 },
  "price_1T6WuC3j4H2XXSTTpt0ZgrG1": { plano: "premium", limites: 14000 },
  "price_1T6WuD3j4H2XXSTTuhwL1f8k": { plano: "enterprise", limites: 32000 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) {
      console.error("[CHECK-SUBSCRIPTION] Error:", userError.message);
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First check tenant status from DB
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    const tenantId = profile?.tenant_id;
    let tenantData: any = null;

    if (tenantId) {
      const { data } = await supabase
        .from("tenants")
        .select("ativo, plano, limites_consulta, stripe_customer_id, stripe_subscription_id, stripe_status")
        .eq("id", tenantId)
        .maybeSingle();
      tenantData = data;
    }

    // Try Stripe check
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        const subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
        const priceId = sub.items.data[0].price.id;
        const planInfo = PRICE_TO_PLAN[priceId];
        const plano = planInfo?.plano || "pro";

        // Sync tenant with Stripe status
        if (tenantId) {
          await supabase.from("tenants").update({
            ativo: true,
            plano,
            limites_consulta: planInfo?.limites || 6000,
            stripe_customer_id: customerId,
            stripe_subscription_id: sub.id,
            stripe_status: "active",
          }).eq("id", tenantId);
        }

        return new Response(JSON.stringify({
          subscribed: true,
          plano,
          subscription_end: subscriptionEnd,
          price_id: priceId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fallback: check tenant ativo status (e.g. Cakto or manually activated)
    if (tenantData?.ativo) {
      return new Response(JSON.stringify({
        subscribed: true,
        plano: tenantData.plano || "pro",
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ subscribed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[CHECK-SUBSCRIPTION] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
