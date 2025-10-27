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
      toast({ title: 'Failed to send email', description: error?.message || 'Try again later.', variant: 'destructive' });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        }
      });

      if (error) throw error;
      
      // Note: The user will be redirected to Google and then back to our app
      // The auth state change will be handled by the listener in FinancifyApp
    } catch (error: any) {
      toast({
        title: "Google sign-in failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
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
        
        // Auth state change will be handled by FinancifyApp
        // 2FA verification will also be handled there
        toast({
          title: "Signing in...",
          description: "Please wait while we verify your account.",
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
              throw resendErr;
            }
          }
          throw error;
        }

        // Proceed immediately without blocking on email confirmation
        toast({ title: "Account created", description: "You can start using the app now. Check your email to confirm later." });
        onAuthSuccess();
      }
    } catch (error: any) {
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

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign In Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
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