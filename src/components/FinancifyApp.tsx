import { useState, useEffect, useRef } from "react";
import { Navigation, NavigationTab } from "./Navigation";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { ImportScreen } from "@/screens/ImportScreen";
import { SplitBillScreen } from "@/screens/SplitBillScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { AuthScreen } from "./AuthScreen";
import { FloatingActionButton } from "./FloatingActionButton";
import { TransactionInputDialog } from "./TransactionInputDialog";
import { PDFUploadForm } from "./PDFUploadForm";
import { useFinancifyStore } from "@/store";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/hooks/useEncryption";
import { EncryptionSetup } from "@/components/EncryptionSetup";
import { FirstTimeEncryption } from "@/components/FirstTimeEncryption";

export const FinancifyApp = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousTab, setPreviousTab] = useState<NavigationTab>("dashboard");
  const [showImportScreen, setShowImportScreen] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
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
            // Wait for encryption state to be initialized before loading transactions
            console.log('🔄 FinancifyApp (auth change): Checking transaction load conditions:', {
              isKeyLoading,
              isEncryptionEnabled,
              hasEncryptionKey: !!encryptionKey,
              shouldLoad: !isKeyLoading && (!isEncryptionEnabled || encryptionKey)
            });
            if (!isKeyLoading && (!isEncryptionEnabled || encryptionKey)) {
              console.log('📥 FinancifyApp (auth change): Loading transactions...');
              loadTransactions();
            } else {
              console.log('⏸️ FinancifyApp (auth change): Skipping transaction load - waiting for encryption state');
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
          console.log('🔄 FinancifyApp: Checking transaction load conditions:', {
            isKeyLoading,
            isEncryptionEnabled,
            hasEncryptionKey: !!encryptionKey,
            shouldLoad: !isKeyLoading && (!isEncryptionEnabled || encryptionKey)
          });
          if (!isKeyLoading && (!isEncryptionEnabled || encryptionKey)) {
            console.log('📥 FinancifyApp: Loading transactions...');
            loadTransactions();
          } else {
            console.log('⏸️ FinancifyApp: Skipping transaction load - waiting for encryption state');
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setSession, loadTransactions, loadProfile, isEncryptionEnabled, encryptionKey, isKeyLoading]);

  // After unlock: when encryption is enabled and key is available, ensure we load encrypted transactions immediately.
  useEffect(() => {
    console.log('🔄 FinancifyApp (encryption state change):', {
      isAuthenticated,
      isEncryptionEnabled,
      hasEncryptionKey: !!encryptionKey
    });
    
    if (!isAuthenticated) return;
    if (isEncryptionEnabled && encryptionKey) {
      console.log('📥 FinancifyApp (encryption state change): Loading transactions due to encryption state change...');
      setTimeout(() => {
        loadTransactions();
      }, 0);
    }
  }, [isAuthenticated, isEncryptionEnabled, encryptionKey, loadTransactions]);

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
    
    setPreviousTab(activeTab);
    setIsTransitioning(true);
    
    // Calculate scroll position based on tab order
    const tabOrder = ["dashboard", "split", "reports", "settings"];
    const tabIndex = tabOrder.indexOf(newTab);
    
    // Calculate scroll position accounting for gap (2rem = 32px)
    const gap = 32; // 2rem in pixels
    const scrollPosition = ((contentRef.current?.offsetWidth || 0) + gap) * tabIndex;
    
    // Scroll to the new position
    if (contentRef.current) {
      contentRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
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
    }, 100);
    
    // End transition
    setTimeout(() => {
      setIsTransitioning(false);
    }, 350);
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

  const renderScreen = (tab: NavigationTab) => {
    switch (tab) {
      case "dashboard":
        return <DashboardScreen onNavigate={handleTabChange} />;
      case "split":
        return <SplitBillScreen />;
      case "reports":
        return <ReportsScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onNavigate={handleTabChange} />;
    }
  };

  const handleImportPDF = () => {
    setShowPDFUpload(true);
  };

  const handleInputTransaction = () => {
    setShowTransactionDialog(true);
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
        <main className="px-4 py-4 relative overflow-hidden">
          <div 
            ref={contentRef}
            className="horizontal-scroll-container"
            style={{
              width: '100%',
              height: '100%'
            }}
          >
            {/* Dashboard Screen */}
            <div className="horizontal-scroll-item">
              {renderScreen("dashboard")}
            </div>
            
            {/* Split Bill Screen */}
            <div className="horizontal-scroll-item">
              {renderScreen("split")}
            </div>
            
            {/* Reports Screen */}
            <div className="horizontal-scroll-item">
              {renderScreen("reports")}
            </div>
            
            {/* Settings Screen */}
            <div className="horizontal-scroll-item">
              {renderScreen("settings")}
            </div>
          </div>
        </main>

        {/* Floating Action Button - Single instance, fixed position */}
        <FloatingActionButton 
          onImportPDF={handleImportPDF}
          onInputTransaction={handleInputTransaction}
        />

        {/* Bottom Navigation */}
        <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {/* Transaction Input Dialog */}
      <TransactionInputDialog 
        isOpen={showTransactionDialog}
        onClose={() => setShowTransactionDialog(false)}
      />

      {/* PDF Upload Modal */}
      {showPDFUpload && (
        <div className="fixed inset-0 bg-background z-50">
          <div className="max-w-md mx-auto bg-background min-h-screen">
            {/* Header */}
            <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
              <div className="px-4 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-primary">Import PDF</h1>
                <button 
                  onClick={() => setShowPDFUpload(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* PDF Upload Content */}
            <div className="px-4 py-4">
              <PDFUploadForm onClose={() => setShowPDFUpload(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Import Screen Modal */}
      {showImportScreen && (
        <div className="fixed inset-0 bg-background z-50">
          <div className="max-w-md mx-auto bg-background min-h-screen">
            {/* Header */}
            <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
              <div className="px-4 py-4 flex items-center justify-between">
                <h1 className="text-xl font-bold text-primary">Import Transactions</h1>
                <button 
                  onClick={() => setShowImportScreen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* Import Screen Content */}
            <div className="px-4 py-4">
              <ImportScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};