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
import { useEncryption } from "@/hooks/useEncryption";
import { EncryptionSetup } from "@/components/EncryptionSetup";
import { FirstTimeEncryption } from "@/components/FirstTimeEncryption";

export const FinancifyApp = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);
  const { 
    user, 
    isAuthenticated, 
    setUser, 
    setSession, 
    loadTransactions, 
    loadProfile,
    isEncryptionEnabled,
    encryptionKey
  } = useFinancifyStore();
  const { isKeySetup, isKeyLoading } = useEncryption();

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
            // Only load transactions if encryption is disabled
            // or already unlocked (key present + enabled)
            if (!isEncryptionEnabled || encryptionKey) {
              loadTransactions();
            }
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
          if (!isEncryptionEnabled || encryptionKey) {
            loadTransactions();
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, loadTransactions, loadProfile]);

  // After unlock: when encryption is enabled and key is available, ensure we load encrypted transactions immediately.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isEncryptionEnabled && encryptionKey) {
      setTimeout(() => {
        loadTransactions();
      }, 0);
    }
  }, [isAuthenticated, isEncryptionEnabled, encryptionKey, loadTransactions]);

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

  // Show encryption setup/unlock if needed before entering the app
  // Show the gate only when the auto-restore has finished (isKeyLoading === false)
  // and we still have no active key while encryption is enabled or set up.
  const needsEncryptionGate = isAuthenticated && !isKeyLoading && (!encryptionKey) && (isEncryptionEnabled || isKeySetup);
  if (needsEncryptionGate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto bg-background min-h-screen">
          {/* Header with app name */}
          <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
            <div className="px-4 py-4">
              <h1 className="text-xl font-bold text-primary">Financify</h1>
            </div>
          </div>

          {/* Encryption Setup */}
          <main className="px-4 py-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Welcome to Financify</h1>
                <p className="text-muted-foreground">Set up end-to-end encryption to protect your financial data</p>
              </div>
              {/* If encryption not set up yet, generate and display password once */}
              {!isKeySetup ? <FirstTimeEncryption /> : <EncryptionSetup />}
            </div>
          </main>
        </div>
      </div>
    );
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