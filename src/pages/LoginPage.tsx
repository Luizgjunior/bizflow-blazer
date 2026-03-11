import { useState, useEffect } from 'react';
import { Mail, Lock, ArrowRight, UserPlus, MessageCircle } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Mode = 'login' | 'signup';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');

  const planParam = searchParams.get('plan');

  // If user has a plan param in signup context, default to signup mode
  useEffect(() => {
    if (planParam && !session) {
      setMode('signup');
    }
  }, [planParam, session]);

  useEffect(() => {
    if (session) {
      if (planParam) {
        navigate(`/planos?selected=${planParam}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [session, planParam, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('Email ou senha incorretos');
      }
      // redirect handled by useEffect
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome: nome || email.split('@')[0] },
        },
      });
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado. Faça login.');
          setMode('login');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Conta criada com sucesso!');
      }
      // redirect handled by useEffect
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = 'https://wa.me/5565981078369';


  if (session) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoImg} alt="LeadFlow" className="w-12 h-12 rounded-xl object-cover mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">LeadFlow</h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Intelligence</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          {mode === 'login' ? (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Entrar</h2>
              <p className="text-sm text-muted-foreground mb-6">Acesse sua conta para continuar</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="seu@email.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? 'Aguarde...' : 'Entrar'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>

              <div className="mt-4 space-y-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors text-center font-medium"
                >
                  <MessageCircle className="w-4 h-4" />
                  Precisa de ajuda? Fale conosco
                </a>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Criar Conta</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {planParam ? 'Crie sua conta para continuar com o plano escolhido' : 'Crie sua conta para começar'}
              </p>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <div className="relative mt-1.5">
                    <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="nome" type="text" placeholder="Seu nome" className="pl-9" value={nome} onChange={(e) => setNome(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email-signup">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email-signup" type="email" placeholder="seu@email.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="password-signup">Senha</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password-signup" type="password" placeholder="Mínimo 6 caracteres" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar Conta'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>

              <button
                onClick={() => { setMode('login'); setPassword(''); setNome(''); }}
                className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Já tem conta? Entrar
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          © 2025 LeadFlow Intelligence
        </p>
      </div>
    </div>
  );
}
