import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFinancifyStore } from '@/store';
import { Shield, AlertCircle, ArrowLeft } from 'lucide-react';

interface TwoFactorVerificationScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const TwoFactorVerificationScreen: React.FC<TwoFactorVerificationScreenProps> = ({ 
  onSuccess, 
  onCancel 
}) => {
  const { verifyTwoFactorToken, useBackupCode } = useFinancifyStore();
  const { toast } = useToast();
  
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUsingBackup, setIsUsingBackup] = useState(false);

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) return;
    
    setIsVerifying(true);
    try {
      const isValid = await verifyTwoFactorToken(verificationCode);
      
      if (isValid) {
        toast({
          title: "Verification Successful",
          description: "Two-factor authentication verified successfully.",
        });
        onSuccess();
      } else {
        toast({
          title: "Invalid Code",
          description: "The verification code is incorrect. Please try again.",
          variant: "destructive",
        });
        setVerificationCode('');
      }
    } catch (error) {
      toast({
        title: "Verification Error",
        description: "Failed to verify code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackupCode = async () => {
    if (!backupCode || backupCode.length !== 8) return;
    
    setIsVerifying(true);
    try {
      const isValid = await useBackupCode(backupCode);
      
      if (isValid) {
        toast({
          title: "Backup Code Accepted",
          description: "You have successfully signed in using a backup code.",
        });
        onSuccess();
      } else {
        toast({
          title: "Invalid Backup Code",
          description: "The backup code is incorrect or has already been used.",
          variant: "destructive",
        });
        setBackupCode('');
      }
    } catch (error) {
      toast({
        title: "Verification Error",
        description: "Failed to verify backup code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isUsingBackup) {
        if (backupCode.length === 8) {
          handleBackupCode();
        }
      } else {
        if (verificationCode.length === 6) {
          handleVerifyCode();
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* App Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Financify</h1>
          <p className="text-muted-foreground">Two-Factor Authentication</p>
        </div>

        {/* Verification Card */}
        <Card className="financial-card p-6">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">
                {isUsingBackup ? 'Enter Backup Code' : 'Verify Your Identity'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isUsingBackup 
                  ? 'Enter one of your backup codes. Each code can only be used once.'
                  : 'Enter the 6-digit code from your authenticator app to complete sign in.'
                }
              </p>
            </div>

            {!isUsingBackup ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Verification Code</label>
                  <Input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyPress={handleKeyPress}
                    placeholder="123456"
                    className="text-center text-2xl font-mono tracking-widest h-14"
                    maxLength={6}
                    autoFocus
                    disabled={isVerifying}
                  />
                </div>
                
                <Button
                  onClick={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="w-full btn-primary h-12"
                >
                  {isVerifying ? 'Verifying...' : 'Verify Code'}
                </Button>

                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setIsUsingBackup(true)}
                    className="text-sm"
                    disabled={isVerifying}
                  >
                    Use backup code instead
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">Backup Code</label>
                  <Input
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                    onKeyPress={handleKeyPress}
                    placeholder="ABC12345"
                    className="text-center text-2xl font-mono tracking-widest h-14"
                    maxLength={8}
                    autoFocus
                    disabled={isVerifying}
                  />
                </div>
                
                <Button
                  onClick={handleBackupCode}
                  disabled={isVerifying || backupCode.length !== 8}
                  className="w-full btn-primary h-12"
                >
                  {isVerifying ? 'Verifying...' : 'Verify Backup Code'}
                </Button>

                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={() => setIsUsingBackup(false)}
                    className="text-sm"
                    disabled={isVerifying}
                  >
                    Use authenticator app instead
                  </Button>
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Security Notice</p>
                  <p>If you're having trouble accessing your authenticator app, you can use a backup code. These codes were provided during setup.</p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full"
              disabled={isVerifying}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel and Sign Out
            </Button>
          </div>
        </Card>

        {/* Info Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Two-factor authentication helps keep your financial data secure
          </p>
        </div>
      </div>
    </div>
  );
};

