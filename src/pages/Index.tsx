import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';
import LandingPage from './LandingPage';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { session, loading, profileLoading, isAdmin, subscription } = useAuth();

  if (loading) {
    return null;
  }

  if (!session) {
    return <LandingPage />;
  }

  if (profileLoading) {
    return null;
  }

  // Non-admin without subscription goes to plans
  if (!isAdmin && !subscription.subscribed) {
    return <LandingPage />;
  }

  return <Dashboard />;
};

export default Index;
