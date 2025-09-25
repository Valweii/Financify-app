import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen = ({ onAuthSuccess }: AuthScreenProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const redirectUrl = `${window.location.origin}/`;

  const handleResend = async () => {
    try {
      if (!email) {
        toast({ title: 'Enter your email first', variant: 'destructive' });
        return;
      }
      await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl } });
      toast({ title: 'Confirmation Email Sent', description: 'Check your inbox (and spam folder).' });
    } catch (error: any) {
      console.error('Resend error:', error);
      toast({ title: 'Failed to send email', description: error?.message || 'Try again later.', variant: 'destructive' });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in.",
        });
        onAuthSuccess();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: fullName,
            }
          }
        });

        if (error) {
          // If the user was deleted only in public tables or already exists in auth,
          // Supabase returns "User already registered". In that case, re-send the
          // confirmation email so the user can confirm again.
          if (typeof error.message === 'string' && error.message.toLowerCase().includes('already')) {
            try {
              await supabase.auth.resend({
                type: 'signup',
                email,
                options: { emailRedirectTo: redirectUrl },
              });
              toast({
                title: 'Confirmation Email Re-sent',
                description: 'We have re-sent the verification link to your email.',
              });
              return;
            } catch (resendErr: any) {
              console.error('Resend error:', resendErr);
              throw resendErr;
            }
          }
          throw error;
        }

        toast({
          title: "Account created!",
          description: "Please check your email to confirm your account.",
        });
        // Offer quick resend action in case email delivery is slow
        toast({ title: 'Didn\'t get it?', description: 'Click below to resend the email.' });
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast({
        title: "Authentication Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail("");
    setPassword("");
    setFullName("");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* App Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Financify</h1>
          <p className="text-muted-foreground">Smart Financial Management</p>
        </div>

        {/* Auth Form */}
        <Card className="financial-card p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">
                {isLogin ? "Sign In" : "Create Account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isLogin 
                  ? "Welcome back to your financial dashboard" 
                  : "Start managing your finances today"
                }
              </p>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full btn-primary"
              disabled={isLoading || !email || !password || (!isLogin && !fullName)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isLogin ? "Signing In..." : "Creating Account..."}
                </>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>

            {!isLogin && (
              <div className="text-center">
                <button type="button" onClick={handleResend} className="text-sm text-primary hover:underline" disabled={isLoading || !email}>
                  Resend confirmation email
                </button>
              </div>
            )}

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={toggleMode}
                className="text-primary hover:underline text-sm"
                disabled={isLoading}
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </form>
        </Card>

        {/* Info Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Your financial data is secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
};