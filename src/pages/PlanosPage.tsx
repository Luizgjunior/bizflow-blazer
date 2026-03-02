import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Zap, Crown, Rocket, Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import useDocumentTitle from '@/hooks/useDocumentTitle';

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: 47,
    leads: 6000,
    icon: Zap,
    features: ['6.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Suporte por email'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 97,
    leads: 14000,
    icon: Crown,
    popular: true,
    features: ['14.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Automações', 'Suporte prioritário'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 197,
    leads: 32000,
    icon: Rocket,
    features: ['32.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Automações', 'Webhook personalizado', 'Suporte dedicado'],
  },
];

export default function PlanosPage() {
  useDocumentTitle('Planos');
  const { session } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      toast.error('Faça login para assinar um plano');
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan_id: planId },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar checkout');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground mb-3">Escolha seu plano</h1>
          <p className="text-muted-foreground">Assinatura mensal via cartão de crédito. Cancele quando quiser.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl border bg-card p-6 flex flex-col ${
                  plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px]">Mais popular</Badge>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-lg ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Icon className={`w-5 h-5 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold text-foreground">R$ {plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full gap-2"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {loadingPlan === plan.id ? 'Aguarde...' : 'Assinar'}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
