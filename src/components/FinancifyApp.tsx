import { useState, useEffect, useRef } from "react";
import { Navigation, NavigationTab } from "./Navigation";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { SplitBillScreen } from "@/screens/SplitBillScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { AuthScreen } from "./AuthScreen";
import { FloatingActionButton } from "./FloatingActionButton";
import { TransactionInputDialog } from "./TransactionInputDialog";
import { useFinancifyStore } from "@/store";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/hooks/useEncryption";
import { EncryptionSetup } from "@/components/EncryptionSetup";
import { FirstTimeEncryption } from "@/components/FirstTimeEncryption";
import { useNavigate } from "react-router-dom";

export const FinancifyApp = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [splitBillResetFn, setSplitBillResetFn] = useState<(() => void) | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { 
    user, 
    isAuthenticated, 
    setUser, 
    setSession, 
    loadTransactions, 
    loadProfile,
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
            // Wait for encryption state to be initialized before loading transactions
            if (!isKeyLoading && encryptionKey) {
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
          // Wait for encryption state to be initialized before loading transactions
          if (!isKeyLoading && encryptionKey) {
            loadTransactions();
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, loadTransactions, loadProfile, encryptionKey, isKeyLoading]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (encryptionKey) {
      setTimeout(() => {
        loadTransactions();
      }, 0);
    }
  }, [isAuthenticated, encryptionKey, loadTransactions]);

  // Set initial scroll position and handle scroll position changes
  useEffect(() => {
    if (!contentRef.current) return;
    
    const tabOrder = ["dashboard", "split", "reports", "settings"];
    const tabIndex = tabOrder.indexOf(activeTab);
    
    // Calculate scroll position accounting for gap (2rem = 32px)
    const gap = 32; // 2rem in pixels
    const scrollPosition = (contentRef.current.offsetWidth + gap) * tabIndex;
    
    // Set scroll position without animation for initial load
    contentRef.current.scrollLeft = scrollPosition;
    
    // Scroll to top of the current page
    const currentPageElement = contentRef.current.children[tabIndex] as HTMLElement;
    if (currentPageElement) {
      currentPageElement.scrollTop = 0;
    }
  }, [activeTab]);

  const handleAuthSuccess = () => {
    // Auth state change will be handled by the listener
  };

  const handleTabChange = (newTab: NavigationTab) => {
    if (newTab === activeTab || isTransitioning) return;
    
    if (activeTab === "split" && newTab !== "split" && splitBillResetFn) {
      splitBillResetFn();
    }
    
    setIsTransitioning(true);
    
    // Calculate scroll position based on tab order
    const tabOrder = ["dashboard", "split", "reports", "settings"];
    const tabIndex = tabOrder.indexOf(newTab);
    
    // Calculate scroll position accounting for gap (2rem = 32px)
    const gap = 32; // 2rem in pixels
    const scrollPosition = ((contentRef.current?.offsetWidth || 0) + gap) * tabIndex;
    
    // Fast custom scroll animation
    if (contentRef.current) {
      const startTime = performance.now();
      const startScrollLeft = contentRef.current.scrollLeft;
      const distance = scrollPosition - startScrollLeft;
      const duration = 200; // Faster animation (200ms instead of default ~300ms)
      
      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use ease-out cubic-bezier for snappy feel
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentScrollLeft = startScrollLeft + (distance * easeOut);
        
        if (contentRef.current) {
          contentRef.current.scrollLeft = currentScrollLeft;
        }
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };
      
      requestAnimationFrame(animateScroll);
    }
    
    // Update active tab immediately
    setActiveTab(newTab);
    
    // Scroll to top of the page content
    setTimeout(() => {
      const currentPageElement = contentRef.current?.children[tabIndex] as HTMLElement;
      if (currentPageElement) {
        currentPageElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 50);
    
    // End transition
    setTimeout(() => {
      setIsTransitioning(false);
    }, 200);
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
  const needsEncryptionGate = isAuthenticated && !isKeyLoading && (!encryptionKey) && isKeySetup;
  if (needsEncryptionGate) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto bg-background min-h-screen">
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

  const renderScreen = (tab: NavigationTab) => {
    switch (tab) {
      case "dashboard":
        return <DashboardScreen onNavigate={handleTabChange} />;
      case "split":
        return <SplitBillScreen onReset={setSplitBillResetFn} isActive={activeTab === "split"} />;
      case "reports":
        return <ReportsScreen isActive={activeTab === "reports"} />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={handleTabChange} />;
    }
  };

  const handleInputTransaction = () => {
    setShowTransactionDialog(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
          <div className="px-4 py-4">
            <h1 className="text-xl font-bold text-primary">Financify</h1>
          </div>
        </div>

        <main className="px-4 py-4 relative overflow-hidden">
          <div 
            ref={contentRef}
            className="horizontal-scroll-container"
            style={{
              width: '100%',
              height: '100%'
            }}
          >
            <div className="horizontal-scroll-item">
              {renderScreen("dashboard")}
            </div>
            
            <div className="horizontal-scroll-item">
              {renderScreen("split")}
            </div>
            
            <div className="horizontal-scroll-item">
              {renderScreen("reports")}
            </div>
            
            <div className="horizontal-scroll-item">
              {renderScreen("settings")}
            </div>
          </div>
        </main>

        <FloatingActionButton 
          onInputTransaction={handleInputTransaction}
        />

        <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      <TransactionInputDialog 
        isOpen={showTransactionDialog}
        onClose={() => setShowTransactionDialog(false)}
      />

    </div>
  );
};