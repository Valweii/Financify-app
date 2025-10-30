import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
  
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUsingBackup, setIsUsingBackup] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when dialog opens
  useEffect(() => {
    if (isOpen && !isUsingBackup && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen, isUsingBackup]);

  // Auto-submit when all digits are filled
  useEffect(() => {
    const isComplete = verificationCode.every(digit => digit !== '');
    if (isComplete && !isVerifying && !isUsingBackup) {
      // Small delay for better UX - user can see all digits filled
      const timer = setTimeout(() => {
        handleVerifyCode();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [verificationCode, isVerifying, isUsingBackup]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setVerificationCode(newCode);
    
    // Focus the next empty input or the last one
    const nextEmptyIndex = newCode.findIndex(digit => digit === '');
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    inputRefs.current[focusIndex]?.focus();
  };

  const handleVerifyCode = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) return;
    
    setIsVerifying(true);
    try {
      const isValid = await verifyTwoFactorToken(code);
      
      if (isValid) {
        toast({
          title: "Verification Successful",
          description: "Two-factor authentication verified successfully.",
        });
        onSuccess();
        // Don't call onClose() here - let the parent component handle the dialog state
        // This prevents the dialog from closing prematurely or triggering cancel handlers
      } else {
        toast({
          title: "Invalid Code",
          description: "The verification code is incorrect. Please try again.",
          variant: "destructive",
        });
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
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
        // Don't call onClose() here - let the parent component handle the dialog state
        // This prevents the dialog from closing prematurely or triggering cancel handlers
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
    setVerificationCode(['', '', '', '', '', '']);
    setBackupCode('');
    setIsUsingBackup(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit code from your authenticator app to complete sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isUsingBackup ? (
            <>
              <div className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app or paste it.
              </div>
              
              <div>
                <label className="text-sm font-medium mb-3 block">Verification Code</label>
                <div className="flex justify-center gap-2">
                  {verificationCode.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      value={digit}
                      onChange={(e) => handleDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      className="w-12 h-12 text-center text-xl font-semibold border-input rounded-lg focus:border-primary focus:ring-primary"
                      maxLength={1}
                      disabled={isVerifying}
                    />
                  ))}
                </div>
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
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                    setBackupCode(pastedData);
                  }}
                  placeholder="ABC12345"
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={8}
                  autoFocus
                  disabled={isVerifying}
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
              (isUsingBackup ? backupCode.length !== 8 : !verificationCode.every(digit => digit !== ''))
            }
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
