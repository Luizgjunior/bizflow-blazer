import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Zap, Crown, Rocket, Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import useDocumentTitle from '@/hooks/useDocumentTitle';
import logoImg from '@/assets/logo.png';

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    price: 97,
    leads: 6000,
    icon: Zap,
    caktoUrl: 'https://pay.cakto.com.br/3az982s_802315',
    features: ['6.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Suporte por email'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 197,
    leads: 14000,
    icon: Crown,
    popular: true,
    caktoUrl: 'https://pay.cakto.com.br/n2jz5qi',
    features: ['14.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Automações', 'Suporte prioritário'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 297,
    leads: 32000,
    icon: Rocket,
    caktoUrl: 'https://pay.cakto.com.br/msyt9mj',
    features: ['32.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Automações', 'Webhook personalizado', 'Suporte dedicado'],
  },
];

export default function PlanosPage() {
  useDocumentTitle('Planos');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const autoCheckoutDone = useRef(false);

  const selectedPlan = searchParams.get('selected');

  // Auto-trigger checkout ONCE if user just logged in/signed up with a plan selection
  useEffect(() => {
    if (session && selectedPlan && !autoCheckoutDone.current) {
      autoCheckoutDone.current = true;
      // Clear the selected param to prevent re-triggers
      setSearchParams({}, { replace: true });
      handleSubscribe(selectedPlan);
    }
  }, [session, selectedPlan]);

  const handleSubscribe = async (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan?.caktoUrl) {
      toast.error('Link de pagamento não encontrado');
      return;
    }

    if (!session) {
      // Redirect to login with plan selection, then will redirect to Cakto after login
      navigate(`/login?plan=${planId}`);
      return;
    }

    // Logged in: open Cakto checkout directly
    window.open(plan.caktoUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="LeadFlow" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-foreground text-sm">LeadFlow</span>
          </div>
        </div>

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
