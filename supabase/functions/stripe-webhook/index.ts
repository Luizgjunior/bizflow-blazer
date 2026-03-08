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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not set" }), { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let event: Stripe.Event;

  if (webhookSecret) {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }
  } else {
    const body = await req.json();
    event = body as Stripe.Event;
  }

  console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!customerEmail) {
          console.error("No email in checkout session");
          break;
        }

        // Get subscription to find price/plan
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0].price.id;
        const planInfo = PRICE_TO_PLAN[priceId] || { plano: "pro", limites: 6000 };

        // Check if user exists
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, tenant_id")
          .eq("email", customerEmail)
          .maybeSingle();

        if (existingProfile?.tenant_id) {
          // Existing user - update tenant
          await supabase.from("tenants").update({
            ativo: true,
            plano: planInfo.plano,
            limites_consulta: planInfo.limites,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_status: "active",
          }).eq("id", existingProfile.tenant_id);
          console.log(`Tenant updated for ${customerEmail}`);
        } else {
          // New user - create via admin API
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            user_metadata: {
              nome: customerEmail.split("@")[0],
              empresa_nome: customerEmail.split("@")[0],
              plano: planInfo.plano,
            },
          });

          if (authError && !authError.message?.includes("already been registered")) {
            console.error("Error creating user:", authError);
            break;
          }

          // Wait for trigger to create tenant
          await new Promise((r) => setTimeout(r, 1500));

          const userId = authUser?.user?.id;
          if (userId) {
            const { data: newProfile } = await supabase
              .from("profiles")
              .select("tenant_id")
              .eq("id", userId)
              .maybeSingle();

            if (newProfile?.tenant_id) {
              await supabase.from("tenants").update({
                ativo: true,
                plano: planInfo.plano,
                limites_consulta: planInfo.limites,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                stripe_status: "active",
              }).eq("id", newProfile.tenant_id);
            }
          }
          console.log(`New user+tenant created for ${customerEmail}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenant) {
          await supabase.from("tenants").update({
            ativo: true,
            stripe_status: "active",
          }).eq("id", tenant.id);
          console.log(`Tenant kept active after invoice.paid for ${customerId}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenant) {
          await supabase.from("tenants").update({
            ativo: false,
            stripe_status: "payment_failed",
          }).eq("id", tenant.id);
          console.log(`Tenant deactivated after payment_failed for ${customerId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (tenant) {
          await supabase.from("tenants").update({
            ativo: false,
            stripe_status: "canceled",
          }).eq("id", tenant.id);
          console.log(`Tenant deactivated after subscription deleted for ${customerId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response(JSON.stringify({ error: "Processing error" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
