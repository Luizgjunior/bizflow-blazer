import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import {
  ArrowRight, BarChart3, Bot, CheckCircle2, ChevronDown,
  Crown, Database, Download, Filter, Globe, Layers, LineChart,
  Lock, MessageSquare, Rocket, Search, Shield, Sparkles, Target, Users, Zap,
  Webhook, Clock, TrendingUp, Mail
} from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import useDocumentTitle from '@/hooks/useDocumentTitle';

/* ───────────────────── helpers ───────────────────── */

function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
    >
      {inView ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {target.toLocaleString('pt-BR')}{suffix}
        </motion.span>
      ) : '0'}
    </motion.span>
  );
}

/* ───────────────────── data ───────────────────── */

const FEATURES = [
  { icon: Target, title: 'ICPs Inteligentes', desc: 'Defina seu Perfil de Cliente Ideal com filtros avançados — CNAE, UF, porte, faturamento e muito mais.' },
  { icon: Search, title: 'Prospecção Automática', desc: 'Execute buscas e receba leads qualificados com dados reais e atualizados de empresas brasileiras.' },
  { icon: BarChart3, title: 'Score de Qualidade', desc: 'Cada lead recebe uma pontuação baseada em aderência ao seu ICP, priorizando os melhores contatos.' },
  { icon: Bot, title: 'Automações', desc: 'Agende execuções recorrentes. O sistema busca leads automaticamente conforme sua frequência.' },
  { icon: Download, title: 'Exportação CSV', desc: 'Exporte seus leads em CSV para integrar com qualquer CRM ou ferramenta do seu time de vendas.' },
  { icon: Webhook, title: 'Webhooks', desc: 'Receba leads em tempo real via webhook e integre com n8n, Make, Zapier ou seu próprio sistema.' },
  { icon: MessageSquare, title: 'Disparos WhatsApp', desc: 'Conecte seu WhatsApp e envie mensagens em massa para seus leads — texto, mídia e templates.' },
];

const STEPS = [
  { num: '01', title: 'Crie seu ICP', desc: 'Defina os filtros do seu cliente ideal — segmento, localização, porte e mais.', icon: Filter },
  { num: '02', title: 'Execute a Busca', desc: 'Com um clique, o sistema prospecta milhares de empresas que se encaixam no perfil.', icon: Rocket },
  { num: '03', title: 'Receba Leads Qualificados', desc: 'Leads com score, CNPJ, razão social e dados completos prontos para prospecção.', icon: TrendingUp },
  { num: '04', title: 'Exporte ou Integre', desc: 'Baixe em CSV ou receba via webhook direto no seu CRM.', icon: Globe },
  { num: '05', title: 'Dispare pelo WhatsApp', desc: 'Conecte seu número e envie mensagens em massa para seus leads diretamente pelo sistema.', icon: MessageSquare },
];

const PLANS = [
  {
    id: 'pro', name: 'Pro', price: 47, leads: '6.000',
    icon: Zap, features: ['6.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Suporte por email'],
  },
  {
    id: 'premium', name: 'Premium', price: 97, leads: '14.000',
    icon: Crown, popular: true,
    features: ['14.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Automações', 'Disparos WhatsApp', 'Suporte prioritário'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 197, leads: '32.000',
    icon: Rocket,
    features: ['32.000 leads/mês', 'ICPs ilimitados', 'Exportações CSV', 'Automações', 'Disparos WhatsApp', 'Webhook personalizado', 'Suporte dedicado'],
  },
];

const FAQ = [
  { q: 'De onde vêm os dados dos leads?', a: 'Utilizamos bases públicas oficiais do governo brasileiro (Receita Federal) combinadas com enriquecimento inteligente para garantir dados atualizados e confiáveis.' },
  { q: 'Preciso instalar alguma coisa?', a: 'Não! O LeadFlow é 100% na nuvem. Basta acessar pelo navegador no celular ou computador e começar a prospectar.' },
  { q: 'Como funciona o score dos leads?', a: 'Cada lead recebe uma pontuação de 0 a 100 baseada na aderência ao seu ICP. Quanto maior o score, mais alinhado ao seu perfil ideal de cliente.' },
  { q: 'Posso cancelar a qualquer momento?', a: 'Sim! Não existe fidelidade. Você pode cancelar sua assinatura quando quiser, sem multas ou burocracia.' },
  { q: 'Os leads são exclusivos?', a: 'Os dados são baseados em informações públicas. O diferencial está nos filtros do seu ICP e no score de qualificação, que tornam sua prospecção muito mais assertiva.' },
  { q: 'Posso integrar com meu CRM?', a: 'Sim! Você pode exportar leads em CSV ou usar webhooks para enviar dados em tempo real para qualquer ferramenta — CRM, n8n, Make, Zapier e mais.' },
  { q: 'O sistema funciona no celular?', a: 'Sim! O LeadFlow foi construído 100% mobile-first. Toda a experiência é otimizada para uso no smartphone.' },
  { q: 'Como funciona o suporte?', a: 'No plano Pro o suporte é por email. No Premium, você tem prioridade. No Enterprise, suporte dedicado com atendimento exclusivo.' },
];

const STATS = [
  { value: 50000, suffix: '+', label: 'Leads gerados' },
  { value: 99, suffix: '%', label: 'Dados atualizados' },
  { value: 30, suffix: 's', label: 'Tempo médio de busca' },
  { value: 4.9, suffix: '★', label: 'Avaliação' },
];

/* ───────────────────── component ───────────────────── */

export default function LandingPage() {
  useDocumentTitle('Prospecção B2B Inteligente');
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="LeadFlow" className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-bold text-foreground text-sm">LeadFlow</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate('/planos')} className="gap-1.5">
              Começar <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative pt-16 pb-20 px-4">
        {/* bg glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-accent/6 blur-[100px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <FadeIn>
            <Badge variant="outline" className="mb-6 text-xs py-1 px-3 border-primary/30 text-primary">
              <Sparkles className="w-3 h-3 mr-1.5" /> Prospecção B2B com IA
            </Badge>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
              Encontre seus{' '}
              <span className="gradient-text">clientes ideais</span>{' '}
              em segundos
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Plataforma inteligente de prospecção B2B. Defina seu ICP, execute buscas
              e receba leads qualificados com CNPJ, score e dados completos — tudo pelo celular.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={() => navigate('/planos')} className="w-full sm:w-auto gap-2 text-base">
                Começar Agora <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })} className="w-full sm:w-auto gap-2 text-base">
                Como Funciona
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-12 border-y border-border/50 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground">
                  <CountUp target={s.value} suffix={s.suffix} />
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">Funcionalidades</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Tudo que você precisa para{' '}
              <span className="gradient-text">prospectar melhor</span>
            </h2>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm sm:text-base">
              Ferramentas poderosas pensadas para times de vendas que querem escalar resultados.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={i} delay={i * 0.06}>
                  <div className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1.5 text-sm">{f.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" className="py-20 px-4 bg-muted/20">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">Passo a Passo</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Como o <span className="gradient-text">LeadFlow</span> funciona?
            </h2>
          </FadeIn>

          <div className="space-y-6">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
                    <div className="shrink-0 w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">{step.num}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground text-sm mb-1">{step.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                    <Icon className="shrink-0 w-5 h-5 text-primary/40 hidden sm:block mt-1" />
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── SECURITY ─── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-10">
            <Badge variant="outline" className="mb-4 text-xs">Segurança</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Seus dados estão <span className="gradient-text">protegidos</span>
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { icon: Shield, title: 'Criptografia End-to-End', desc: 'Todos os dados trafegam com criptografia TLS e são armazenados de forma segura.' },
              { icon: Lock, title: 'Acesso Restrito', desc: 'Cada empresa acessa apenas seus próprios dados com isolamento total entre contas.' },
              { icon: Database, title: 'Backup Contínuo', desc: 'Backups automáticos garantem que seus dados nunca serão perdidos.' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="text-center p-5 rounded-2xl border border-border bg-card">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PLANS ─── */}
      <section className="py-20 px-4 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <Badge variant="outline" className="mb-4 text-xs">Planos</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Escolha o plano ideal para seu{' '}
              <span className="gradient-text">crescimento</span>
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">Cancele quando quiser. Sem fidelidade.</p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan, i) => {
              const Icon = plan.icon;
              return (
                <FadeIn key={plan.id} delay={i * 0.1}>
                  <div className={`relative rounded-2xl border bg-card p-6 flex flex-col ${
                    plan.popular ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20' : 'border-border'
                  }`}>
                    {plan.popular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px]">Mais popular</Badge>
                    )}
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`p-2 rounded-lg ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`w-5 h-5 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    </div>

                    <div className="mb-5">
                      <span className="text-3xl font-extrabold text-foreground">R$ {plan.price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>

                    <ul className="space-y-2.5 mb-6 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full gap-2"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => navigate('/planos')}
                    >
                      Escolher {plan.name} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <FadeIn className="text-center mb-12">
            <Badge variant="outline" className="mb-4 text-xs">Dúvidas</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Perguntas <span className="gradient-text">Frequentes</span>
            </h2>
          </FadeIn>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <FadeIn key={i} delay={i * 0.04}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-foreground text-sm">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`} />
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed pr-6">
                      {item.a}
                    </p>
                  </motion.div>
                </button>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-4">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center rounded-2xl gradient-primary p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3">
              Pronto para escalar suas vendas?
            </h2>
            <p className="text-primary-foreground/80 mb-8 text-sm sm:text-base max-w-md mx-auto">
              Comece agora e descubra leads qualificados para o seu negócio em poucos minutos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => navigate('/planos')}
                className="w-full sm:w-auto gap-2 text-base font-semibold"
              >
                Começar Agora <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="LeadFlow" className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-bold text-foreground text-sm">LeadFlow Intelligence</span>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/login')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Login
              </button>
              <button onClick={() => navigate('/planos')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Planos
              </button>
            </div>
          </div>
          <div className="text-center mt-6">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} LeadFlow Intelligence. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
