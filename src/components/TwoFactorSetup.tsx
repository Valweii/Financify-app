import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFinancifyStore } from '@/store';
import { generateTwoFactorSecret, generateQRCodeDataURL, verifyTwoFactorToken, generateBackupCodes } from '@/lib/two-factor-auth';
import { Shield, Copy, CheckCircle, AlertCircle } from 'lucide-react';

interface TwoFactorSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, saveTwoFactorSettings } = useFinancifyStore();
  const { toast } = useToast();
  
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [secret, setSecret] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [manualEntryKey, setManualEntryKey] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && step === 'setup') {
      generateSecret();
    }
  }, [isOpen, step]);

  const generateSecret = async () => {
    if (!user?.email) return;
    
    setIsLoading(true);
    try {
      const twoFactorSecret = generateTwoFactorSecret({
        issuer: 'Financify',
        accountName: user.email,
      });
      
      setSecret(twoFactorSecret.secret);
      setManualEntryKey(twoFactorSecret.manualEntryKey);
      
      const qrCodeDataURL = await generateQRCodeDataURL(twoFactorSecret.qrCodeUrl);
      setQrCodeUrl(qrCodeDataURL);
    } catch (error) {
      toast({
        title: "Setup Error",
        description: "Failed to generate 2FA secret. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!secret || !verificationCode) return;
    
    setIsVerifying(true);
    try {
      const isValid = verifyTwoFactorToken(secret, verificationCode);
      
      if (isValid) {
        // Generate backup codes
        const codes = generateBackupCodes(8);
        setBackupCodes(codes);
        setStep('backup');
      } else {
        toast({
          title: "Invalid Code",
          description: "The verification code is incorrect. Please try again.",
          variant: "destructive",
        });
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

  const handleCompleteSetup = async () => {
    if (!secret) return;
    
    setIsLoading(true);
    try {
      await saveTwoFactorSettings(secret, backupCodes);
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled for your account.",
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Setup Failed",
        description: "Failed to save 2FA settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const resetSetup = () => {
    setStep('setup');
    setSecret(null);
    setQrCodeUrl('');
    setManualEntryKey('');
    setVerificationCode('');
    setBackupCodes([]);
    setCopiedCode(null);
  };

  const handleClose = () => {
    resetSetup();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {step === 'setup' && 'Setup Two-Factor Authentication'}
            {step === 'verify' && 'Verify Setup'}
            {step === 'backup' && 'Backup Codes'}
          </DialogTitle>
        </DialogHeader>

        {step === 'setup' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : qrCodeUrl ? (
              <div className="flex flex-col items-center space-y-4">
                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                
                <div className="w-full">
                  <label className="text-sm font-medium">Manual Entry Key</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={manualEntryKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(manualEntryKey);
                        toast({ title: "Copied", description: "Manual entry key copied to clipboard" });
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium">Important:</p>
                  <p>Save your backup codes in a secure location. You'll need them if you lose access to your authenticator app.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app to verify the setup.
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
          </div>
        )}

        {step === 'backup' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Save these backup codes in a secure location. Each code can only be used once.
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{code}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyBackupCode(code)}
                    >
                      {copiedCode === code ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">Warning:</p>
                  <p>These codes are only shown once. Make sure to save them securely.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'setup' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={() => setStep('verify')} disabled={!qrCodeUrl}>
                Next
              </Button>
            </>
          )}
          
          {step === 'verify' && (
            <>
              <Button variant="outline" onClick={() => setStep('setup')}>
                Back
              </Button>
              <Button onClick={handleVerifyCode} disabled={verificationCode.length !== 6 || isVerifying}>
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>
            </>
          )}
          
          {step === 'backup' && (
            <>
              <Button variant="outline" onClick={() => setStep('verify')}>
                Back
              </Button>
              <Button onClick={handleCompleteSetup} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Complete Setup'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
