import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(userError.message);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin_global") {
      throw new Error("Unauthorized: admin access required");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all active subscriptions
    const allActiveSubs: Stripe.Subscription[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;
    while (hasMore) {
      const params: any = { status: "active", limit: 100, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;
      const subs = await stripe.subscriptions.list(params);
      allActiveSubs.push(...subs.data);
      hasMore = subs.has_more;
      if (subs.data.length > 0) startingAfter = subs.data[subs.data.length - 1].id;
    }

    // Fetch canceled subscriptions (last 90 days)
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    const canceledSubs: Stripe.Subscription[] = [];
    hasMore = true;
    startingAfter = undefined;
    while (hasMore) {
      const params: any = { status: "canceled", limit: 100, created: { gte: ninetyDaysAgo } };
      if (startingAfter) params.starting_after = startingAfter;
      const subs = await stripe.subscriptions.list(params);
      canceledSubs.push(...subs.data);
      hasMore = subs.has_more;
      if (subs.data.length > 0) startingAfter = subs.data[subs.data.length - 1].id;
    }

    // Price mapping
    const PRICE_TO_PLAN: Record<string, { plano: string; price: number }> = {
      "price_1T6Wu13j4H2XXSTTlIR84BiV": { plano: "pro", price: 4700 },
      "price_1T6WuC3j4H2XXSTTpt0ZgrG1": { plano: "premium", price: 9700 },
      "price_1T6WuD3j4H2XXSTTuhwL1f8k": { plano: "enterprise", price: 19700 },
    };

    // Calculate MRR
    let mrr = 0;
    const planBreakdown: Record<string, { count: number; revenue: number }> = {
      pro: { count: 0, revenue: 0 },
      premium: { count: 0, revenue: 0 },
      enterprise: { count: 0, revenue: 0 },
    };

    for (const sub of allActiveSubs) {
      const priceId = sub.items.data[0]?.price?.id;
      const planInfo = PRICE_TO_PLAN[priceId];
      if (planInfo) {
        mrr += planInfo.price;
        planBreakdown[planInfo.plano].count += 1;
        planBreakdown[planInfo.plano].revenue += planInfo.price;
      } else {
        // Fallback: use the amount from subscription
        const amount = sub.items.data[0]?.price?.unit_amount || 0;
        mrr += amount;
      }
    }

    // Fetch recent invoices for payment history
    const recentInvoices = await stripe.invoices.list({
      limit: 50,
      status: "paid",
      created: { gte: ninetyDaysAgo },
    });

    // Monthly revenue by month (last 6 months)
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[key] = 0;
    }

    for (const inv of recentInvoices.data) {
      if (inv.status === "paid" && inv.amount_paid > 0) {
        const d = new Date((inv.status_transitions?.paid_at || inv.created) * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in monthlyRevenue) {
          monthlyRevenue[key] += inv.amount_paid;
        }
      }
    }

    // Fetch failed payments
    const failedInvoices = await stripe.invoices.list({
      limit: 20,
      status: "open",
    });

    const overdueCount = failedInvoices.data.filter(
      (inv) => inv.attempted && !inv.paid
    ).length;

    // Churn rate (last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const recentCanceled = canceledSubs.filter(
      (s) => s.canceled_at && s.canceled_at >= thirtyDaysAgo
    ).length;

    const totalActiveStart = allActiveSubs.length + recentCanceled;
    const churnRate = totalActiveStart > 0
      ? ((recentCanceled / totalActiveStart) * 100).toFixed(1)
      : "0.0";

    // Subscriber details with customer info
    const subscribers = allActiveSubs.map((sub) => {
      const priceId = sub.items.data[0]?.price?.id;
      const planInfo = PRICE_TO_PLAN[priceId];
      const customer = sub.customer as Stripe.Customer;
      return {
        customer_id: customer.id,
        customer_email: customer.email || "N/A",
        customer_name: customer.name || customer.email || "N/A",
        plan: planInfo?.plano || "unknown",
        amount: (sub.items.data[0]?.price?.unit_amount || 0) / 100,
        currency: sub.items.data[0]?.price?.currency || "brl",
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        created: new Date(sub.created * 1000).toISOString(),
      };
    });

    // Annual revenue projection
    const arr = mrr * 12;

    const result = {
      mrr: mrr / 100,
      arr: arr / 100,
      active_subscribers: allActiveSubs.length,
      canceled_last_90d: canceledSubs.length,
      churn_rate_30d: parseFloat(churnRate),
      overdue_invoices: overdueCount,
      plan_breakdown: Object.entries(planBreakdown).map(([plan, data]) => ({
        plan,
        count: data.count,
        revenue: data.revenue / 100,
      })),
      monthly_revenue: Object.entries(monthlyRevenue).map(([month, amount]) => ({
        month,
        amount: amount / 100,
      })),
      subscribers,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[STRIPE-FINANCIAL] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
