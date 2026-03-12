import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import LandingPage from './LandingPage';

const Index = () => {
  const { session, loading, profileLoading, isAdmin, subscription } = useAuth();

  if (loading || profileLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session) {
    return <LandingPage />;
  }

  // Non-admin without subscription goes to plans
  if (!isAdmin && !subscription.subscribed) {
    return <LandingPage />;
  }

  // Redirect authenticated users to CRM Dashboard
  return <Navigate to="/crm-dashboard" replace />;
};

export default Index;
