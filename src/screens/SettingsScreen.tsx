import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFinancifyStore } from "@/store";
import { User, LogOut, Shield, HelpCircle, ExternalLink, Moon, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EncryptionStatus } from "@/components/EncryptionStatus";
import { useEncryption } from "@/hooks/useEncryption";

export const SettingsScreen = () => {
  const { user, profile, signOut, setProfile } = useFinancifyStore();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  const { isKeySetup, isKeyLoading } = useEncryption();
  const { toast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSecurityExpanded, setIsSecurityExpanded] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      // Error signing out
    }
  };

  const settingsItems = [
    {
      icon: User,
      title: "Profile Information",
      description: "Manage your account details",
      action: () => {
        setFullName(profile?.full_name || "");
        setEmail(user?.email || "");
        setIsProfileOpen(true);
      },
      disabled: false
    },
    {
      icon: Moon,
      title: "Appearance",
      description: "Toggle dark mode",
      action: () => {},
      disabled: false
    },
    {
      icon: HelpCircle,
      title: "Help & Support",
      description: "Get help and contact support",
      action: () => window.open('mailto:support@financify.com', '_blank'),
      disabled: false
    }
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      {user ? (
        <Card className="financial-card p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="text-lg font-semibold">{profile?.full_name || user?.email?.split('@')[0] || 'User'}</h3>
              <p className="text-muted-foreground">{user?.email || 'user@example.com'}</p>
              <p className="text-sm text-muted-foreground">
                Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US') : new Date().toLocaleDateString('id-ID')}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="financial-card p-6 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Not Signed In</h3>
              <p className="text-muted-foreground mb-4">Sign in to access all features</p>
              <Button className="btn-primary">
                Sign In
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Security & Privacy Section - Expandable */}
      {user && (
        <div className="space-y-4">
          <Card className="financial-card p-0 overflow-hidden">
            {/* Security & Privacy Header - Clickable */}
            <button
              onClick={() => setIsSecurityExpanded(!isSecurityExpanded)}
              className="w-full p-6 text-left hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Security & Privacy</h2>
                    <p className="text-sm text-muted-foreground">Protect your financial data with end-to-end encryption</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isKeySetup && (
                    <div className="flex items-center gap-1 text-xs text-success px-2 py-1 bg-success/10 rounded-full">
                      <div className="w-2 h-2 bg-success rounded-full"></div>
                      <span>Encrypted</span>
                    </div>
                  )}
                  {isSecurityExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </button>

            {/* Expandable Content */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              isSecurityExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="px-6 pt-4 pb-6 border-t border-border">
                {isKeyLoading ? (
                  <div className="flex items-center justify-center space-y-4 py-8">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading encryption status...</p>
                  </div>
                ) : (
                  <EncryptionStatus />
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Settings Items */}
      <div className="space-y-3">
        {settingsItems.map((item, index) => (
          <Card 
            key={index}
            className={`financial-card p-4 ${!item.disabled ? 'cursor-pointer hover:shadow-[var(--shadow-float)] transition-all' : 'opacity-60'}`}
            onClick={!item.disabled ? item.action : undefined}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              {item.title === 'Appearance' ? (
                <AnimatedSwitch checked={theme === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />
              ) : (
                !item.disabled && item.title !== 'Profile Information' && <ExternalLink className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile Information</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <label className="text-sm text-muted-foreground">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!user) return;
                const name = fullName.trim();
                if (!name) {
                  toast({ title: 'Name is required', variant: 'destructive' });
                  return;
                }
                setIsSavingProfile(true);
                try {
                  const { data, error } = await supabase
                    .from('profiles')
                    .update({ full_name: name })
                    .eq('id', user.id)
                    .select('*')
                    .maybeSingle();
                  if (error) throw error;
                  if (data) setProfile(data as any);
                  toast({ title: 'Profile updated' });
                  setIsProfileOpen(false);
                } catch (e) {
                  toast({ title: 'Failed to update profile', variant: 'destructive' });
                } finally {
                  setIsSavingProfile(false);
                }
              }}
              disabled={isSavingProfile}
              className="btn-primary"
            >
              {isSavingProfile ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Out */}
      {user && (
        <Button 
          variant="destructive" 
          onClick={handleSignOut}
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      )}
    </div>
  );
};

// Custom Animated Switch Component
interface AnimatedSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const AnimatedSwitch = ({ checked, onCheckedChange }: AnimatedSwitchProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const switchRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setIsAnimating(true);
    onCheckedChange(!checked);
    
    // Reset animation state after glow animation completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 400);
  };

  return (
    <button
      ref={switchRef}
      onClick={handleToggle}
      className={`
        relative w-12 h-6 rounded-full transition-colors duration-300 ease-out
        ${checked 
          ? 'bg-primary' 
          : 'bg-muted'
        }
        focus:outline-none focus:ring-2 focus:ring-primary/20
        ${isAnimating ? 'animate-pulse-glow' : ''}
      `}
      style={{
        transition: 'background-color 300ms ease-out'
      }}
    >
      {/* Glow pulse effect when toggled ON */}
      {isAnimating && checked && (
        <div 
          className="absolute inset-0 rounded-full bg-primary/30 animate-glow-pulse"
          style={{
            animation: 'glowPulse 400ms ease-out'
          }}
        />
      )}
      
      {/* Knob */}
      <div
        className={`
          absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-160
          ${checked ? 'translate-x-6' : 'translate-x-0.5'}
        `}
        style={{
          transition: 'transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1)'
        }}
      />
    </button>
  );
};