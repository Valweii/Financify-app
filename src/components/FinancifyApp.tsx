import { useState, useEffect, useRef } from "react";
import { Navigation, NavigationTab } from "./Navigation";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { SplitBillScreen } from "@/screens/SplitBillScreen";
import { ReportsScreen } from "@/screens/ReportsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { AuthScreen } from "./AuthScreen";
import { FloatingActionButton } from "./FloatingActionButton";
import { TransactionInputDialog } from "./TransactionInputDialog";
import { EncryptionRecovery } from "./EncryptionRecovery";
import { MandatoryTwoFactorSetup } from "./MandatoryTwoFactorSetup";
import { TwoFactorVerification } from "./TwoFactorVerification";
import { useFinancifyStore } from "@/store";
import { supabase } from "@/integrations/supabase/client";
import { useEncryption } from "@/hooks/useEncryption";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Key, Shield, AlertTriangle } from "lucide-react";

export const FinancifyApp = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [splitBillResetFn, setSplitBillResetFn] = useState<(() => void) | null>(null);
  const [showEncryptionRecovery, setShowEncryptionRecovery] = useState(false);
  const [isInitializingEncryption, setIsInitializingEncryption] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showMandatoryTwoFactorSetup, setShowMandatoryTwoFactorSetup] = useState(false);
  const [isTwoFactorRequired, setIsTwoFactorRequired] = useState(false);
  const [isTwoFactorVerified, setIsTwoFactorVerified] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    user, 
    isAuthenticated, 
    setUser, 
    setSession, 
    loadTransactions, 
    loadProfile,
    encryptionKey,
    setEncryptionKey,
    twoFactorSetupRequired,
    checkTwoFactorSetup,
    loadTwoFactorSettings
  } = useFinancifyStore();
  const { isKeySetup, isKeyLoading, initializeAutoEncryption } = useEncryption();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Reset 2FA verification state when user signs out
        if (!session?.user) {
          setIsTwoFactorVerified(false);
          setIsTwoFactorRequired(false);
        }
        
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

  // Handle automatic encryption initialization for new users
  useEffect(() => {
    const handleEncryptionInitialization = async () => {
      if (!isAuthenticated || isKeyLoading || isInitializingEncryption) return;
      
      // If user is authenticated but has no encryption key and no key setup, initialize auto encryption
      if (!encryptionKey && !isKeySetup) {
        setIsInitializingEncryption(true);
        try {
          const result = await initializeAutoEncryption();
          if (result.success && result.backupCodes) {
            setBackupCodes(result.backupCodes);
            setShowBackupCodes(true);
            // Note: initializeAutoEncryption sets the encryption key internally
            await loadTransactions();
            
            toast({
              title: "Encryption initialized",
              description: "Your data is now automatically encrypted!",
            });
          } else {
            toast({
              title: "Encryption setup failed",
              description: result.error || "Failed to initialize encryption",
              variant: "destructive"
            });
          }
        } catch (error) {
          toast({
            title: "Encryption setup failed",
            description: "An error occurred during encryption setup",
            variant: "destructive"
          });
        } finally {
          setIsInitializingEncryption(false);
        }
      }
      // If user is authenticated but has no encryption key but key is set up, show recovery
      else if (!encryptionKey && isKeySetup) {
        setShowEncryptionRecovery(true);
      }
    };

    handleEncryptionInitialization();
  }, [isAuthenticated, isKeyLoading, encryptionKey, isKeySetup, initializeAutoEncryption, setEncryptionKey, loadTransactions, toast]);

  // Check for mandatory 2FA setup and verification
  useEffect(() => {
    const checkMandatoryTwoFactor = async () => {
      if (!isAuthenticated || !user) return;
      
      // Don't check again if already verified in this session
      if (isTwoFactorVerified) return;
      
      try {
        const isTwoFactorSetup = await checkTwoFactorSetup();
        if (!isTwoFactorSetup) {
          // User needs to set up 2FA
          setShowMandatoryTwoFactorSetup(true);
          setIsTwoFactorVerified(false);
        } else {
          // User has 2FA set up, load their settings and require verification
          await loadTwoFactorSettings();
          // Only set required if not already verified
          if (!isTwoFactorVerified) {
            setIsTwoFactorRequired(true);
            setIsTwoFactorVerified(false);
          }
        }
      } catch (error) {
        // Silently handle errors (e.g., if table doesn't exist yet)
      }
    };

    checkMandatoryTwoFactor();
  }, [isAuthenticated, user, checkTwoFactorSetup, loadTwoFactorSettings, isTwoFactorVerified]);

  const handleMandatoryTwoFactorComplete = async () => {
    setShowMandatoryTwoFactorSetup(false);
    // Load the 2FA settings that were just saved
    await loadTwoFactorSettings();
    // After setup is complete, user needs to verify
    setIsTwoFactorRequired(true);
    setIsTwoFactorVerified(false);
  };

  const handleTwoFactorVerified = () => {
    setIsTwoFactorRequired(false);
    setIsTwoFactorVerified(true);
    toast({
      title: "Welcome back!",
      description: "Two-factor authentication verified successfully.",
    });
  };

  const handleTwoFactorCancel = async () => {
    // Only sign out if verification was not successful
    // This prevents signing out after successful verification when the dialog closes
    if (!isTwoFactorVerified) {
      setIsTwoFactorRequired(false);
      setIsTwoFactorVerified(false);
      // Sign out the user since they didn't complete 2FA
      await supabase.auth.signOut();
      toast({
        title: "Sign in cancelled",
        description: "Two-factor authentication is required to access the app.",
        variant: "destructive",
      });
    }
  };

  const handleEncryptionRecoverySuccess = async () => {
    setShowEncryptionRecovery(false);
    await loadTransactions();
  };

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

  // Show 2FA verification screen if required and not yet verified
  if (isTwoFactorRequired && !isTwoFactorVerified) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md w-full p-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Financify</h1>
            <p className="text-muted-foreground">Two-factor authentication required</p>
          </div>
          <TwoFactorVerification
            isOpen={true}
            onClose={handleTwoFactorCancel}
            onSuccess={handleTwoFactorVerified}
            onBackupCode={() => {}}
          />
        </div>
      </div>
    );
  }

  // Show loading screen during encryption initialization
  if (isInitializingEncryption || (isKeyLoading && !encryptionKey)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-2">Financify</h1>
          <p className="text-muted-foreground">
            {isInitializingEncryption ? "Setting up encryption..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Show backup codes for new users
  if (showBackupCodes && backupCodes.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto bg-background min-h-screen">
          <div className="sticky top-0 bg-background/80 backdrop-blur-sm border-b border-border z-40">
            <div className="px-4 py-4">
              <h1 className="text-xl font-bold text-primary">Financify</h1>
            </div>
          </div>

          <main className="px-4 py-4">
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Shield className="w-6 h-6 text-green-500" />
                  Encryption Ready
                </h1>
                <p className="text-muted-foreground">
                  Your data is now automatically encrypted. Save these backup codes safely!
                </p>
              </div>

              <Card className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-orange-500" />
                    <h3 className="font-semibold">Backup Codes</h3>
                  </div>
                  <div className="space-y-2">
                    {backupCodes.map((code, index) => (
                      <div key={index} className="p-2 bg-muted rounded font-mono text-sm">
                        {code}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Store these codes safely. You'll need them to recover your encryption key if you lose access to this device.
                  </p>
                </div>
              </Card>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  toast({
                    title: "Backup codes copied",
                    description: "Your backup codes have been copied to clipboard.",
                  });
                }}
                variant="outline"
                className="w-full"
              >
                Copy All Codes
              </Button>

              <Button
                onClick={() => {
                  setShowBackupCodes(false);
                  setBackupCodes([]);
                }}
                className="w-full"
              >
                I've Saved My Codes - Continue
              </Button>
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

      <EncryptionRecovery
        isOpen={showEncryptionRecovery}
        onClose={() => setShowEncryptionRecovery(false)}
        onSuccess={handleEncryptionRecoverySuccess}
      />

      <MandatoryTwoFactorSetup
        isOpen={showMandatoryTwoFactorSetup}
        onComplete={handleMandatoryTwoFactorComplete}
      />

    </div>
  );
};