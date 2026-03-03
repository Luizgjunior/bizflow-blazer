import { useState } from 'react';
import { Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Mode = 'login' | 'first-access';

export default function LoginPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (session) {
    navigate('/', { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error('Email ou senha incorretos');
      } else {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Email enviado! Verifique sua caixa de entrada para definir sua senha.');
      }
    } finally {
      setLoading(false);
    }
  };

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

              <button
                onClick={() => { setMode('first-access'); setEmail(''); }}
                className="w-full mt-4 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Primeiro acesso? Definir senha
              </button>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-1">Primeiro Acesso</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Informe o email que você usou na compra. Enviaremos um link para definir sua senha.
              </p>

              <form onSubmit={handleFirstAccess} className="space-y-4">
                <div>
                  <Label htmlFor="email-first">Email de compra</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email-first" type="email" placeholder="email@usado-na-compra.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link de acesso'}
                  {!loading && <KeyRound className="w-4 h-4" />}
                </Button>
              </form>

              <button
                onClick={() => { setMode('login'); setEmail(''); setPassword(''); }}
                className="w-full mt-4 text-sm text-muted-foreground hover:text-primary transition-colors text-center"
              >
                Já tem senha? Entrar
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
