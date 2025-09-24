import { useState, useEffect } from "react";
import { Navigation, NavigationTab } from "./Navigation";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ImportScreen } from "@/screens/ImportScreen";
import { SplitBillScreen } from "@/screens/SplitBillScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { AuthScreen } from "./AuthScreen";
import { useFinancifyStore } from "@/store";
import { supabase } from "@/integrations/supabase/client";

export const FinancifyApp = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);
  const { 
    user, 
    isAuthenticated, 
    setUser, 
    setSession, 
    loadTransactions, 
    loadProfile 
  } = useFinancifyStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Load user data when authenticated
        if (session?.user) {
          setTimeout(() => {
            loadProfile();
            loadTransactions();
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsInitialized(true);
      
      // Load user data if already authenticated
      if (session?.user) {
        setTimeout(() => {
          loadProfile();
          loadTransactions();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, loadTransactions, loadProfile]);

  const handleAuthSuccess = () => {
    // Auth state change will be handled by the listener
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-2">Financify</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardScreen onNavigate={setActiveTab} />;
      case "import":
        return <ImportScreen />;
      case "split":
        return <SplitBillScreen />;
      case "reports":
        return <ReportsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-background min-h-screen">
        {/* Header with app name */}
        <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold text-primary">Financify</h1>
          </div>
        </div>

        {/* Main Content */}
        <main className="px-4 py-4">
          {renderScreen()}
        </main>

        {/* Bottom Navigation */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};