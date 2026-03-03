import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';
import LandingPage from './LandingPage';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { session, loading, profileLoading, isAdmin, subscription } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // Non-admin without subscription goes to plans
  if (!isAdmin && !subscription.subscribed) {
    return <LandingPage />;
  }

  return <Dashboard />;
};

export default Index;
