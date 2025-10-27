import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFinancifyStore } from '@/store';
import { Shield, AlertCircle, Key } from 'lucide-react';

interface TwoFactorVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onBackupCode: () => void;
}

export const TwoFactorVerification: React.FC<TwoFactorVerificationProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onBackupCode 
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
        onClose();
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
        onClose();
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

  const resetForm = () => {
    setVerificationCode('');
    setBackupCode('');
    setIsUsingBackup(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isUsingBackup ? (
            <>
              <div className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </div>
              
              <div>
                <label className="text-sm font-medium">Verification Code</label>
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={6}
                />
              </div>
              
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setIsUsingBackup(true)}
                  className="text-sm"
                >
                  Use backup code instead
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Enter one of your backup codes. Each code can only be used once.
              </div>
              
              <div>
                <label className="text-sm font-medium">Backup Code</label>
                <Input
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  placeholder="ABC12345"
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={8}
                />
              </div>
              
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setIsUsingBackup(false)}
                  className="text-sm"
                >
                  Use authenticator app instead
                </Button>
              </div>
            </>
          )}
          
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Security Notice:</p>
                <p>If you're having trouble accessing your authenticator app, you can use a backup code or contact support.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={isUsingBackup ? handleBackupCode : handleVerifyCode}
            disabled={
              isVerifying || 
              (isUsingBackup ? backupCode.length !== 8 : verificationCode.length !== 6)
            }
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
