import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFinancifyStore } from '@/store';
import { Shield, ArrowLeft, Key } from 'lucide-react';

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
  
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUsingBackup, setIsUsingBackup] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    if (!isUsingBackup && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isUsingBackup]);

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
        const code = verificationCode.join('');
        if (code.length === 6) {
          handleVerifyCode();
        }
      }
    }
  };

  const isCodeComplete = verificationCode.every(digit => digit !== '');
  const isBackupCodeComplete = backupCode.length === 8;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* App Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-primary mb-6">Financify</h1>
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {isUsingBackup ? 'Backup Code' : 'Verification Code'}
          </h2>
          <p className="text-muted-foreground">
            {isUsingBackup 
              ? 'Enter one of your backup codes. Each code can only be used once.'
              : 'Enter the 6-digit code from your authenticator app.'
            }
          </p>
        </div>

        {/* Verification Form */}
        <div className="space-y-8">
          {!isUsingBackup ? (
            <>
              {/* 6-Digit Code Input */}
              <div className="flex justify-center gap-3">
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

              {/* Verify Button */}
              <Button
                onClick={handleVerifyCode}
                disabled={isVerifying || !isCodeComplete}
                className="w-full h-12 btn-primary disabled:opacity-50"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </>
          ) : (
            <>
              {/* Backup Code Input */}
              <div>
                <Input
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedData = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                    setBackupCode(pastedData);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="ABC12345"
                  className="w-full h-12 text-center text-lg font-mono tracking-widest border-input rounded-lg focus:border-primary focus:ring-primary"
                  maxLength={8}
                  autoFocus
                  disabled={isVerifying}
                />
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleBackupCode}
                disabled={isVerifying || !isBackupCodeComplete}
                className="w-full h-12 btn-primary disabled:opacity-50"
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </>
          )}

          {/* Toggle between verification methods */}
          <div className="text-center">
            <Button
              variant="link"
              onClick={() => {
                setIsUsingBackup(!isUsingBackup);
                setVerificationCode(['', '', '', '', '', '']);
                setBackupCode('');
                setTimeout(() => {
                  if (!isUsingBackup) {
                    inputRefs.current[0]?.focus();
                  }
                }, 100);
              }}
              className="text-primary hover:text-primary-light p-0 h-auto"
              disabled={isVerifying}
            >
              {isUsingBackup ? 'Use authenticator app instead' : 'Use backup code instead'}
            </Button>
          </div>

          {/* Resend Code / Help */}
          <div className="text-center text-muted-foreground">
            <span>Having trouble? </span>
            <button
              onClick={() => {
                if (isUsingBackup) {
                  toast({
                    title: "Backup Code Help",
                    description: "Make sure you're using a valid backup code that hasn't been used before.",
                  });
                } else {
                  toast({
                    title: "Verification Code Help",
                    description: "Check your authenticator app for the current 6-digit code.",
                  });
                }
              }}
              className="text-primary hover:text-primary-light underline"
              disabled={isVerifying}
            >
              Get help
            </button>
          </div>

          {/* Cancel Button */}
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full h-12 border-border text-muted-foreground hover:bg-muted"
            disabled={isVerifying}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

