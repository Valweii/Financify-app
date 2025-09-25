/**
 * Encryption Setup Component
 * Handles initial encryption key setup and unlocking
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useEncryption } from '@/hooks/useEncryption';
import { useFinancifyStore } from '@/store';
import { Shield, Lock, Key, AlertCircle, CheckCircle } from 'lucide-react';

interface EncryptionSetupProps {
  onComplete?: () => void;
}

export const EncryptionSetup = ({ onComplete }: EncryptionSetupProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  
  const { toast } = useToast();
  const { 
    isKeySetup, 
    isKeyLoading, 
    currentKey,
    setupEncryption, 
    unlockEncryption,
    encrypt,
    decrypt
  } = useEncryption();
  
  const { setEncryptionKey, setEncryptionEnabled, loadTransactions } = useFinancifyStore();

  // Sync currentKey with store whenever it changes
  useEffect(() => {
    if (currentKey) {
      setEncryptionKey(currentKey);
    }
  }, [currentKey, setEncryptionKey]);

  const handleSetup = async () => {
    console.log('🔍 handleSetup called with password length:', password.length);
    
    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Please use at least 8 characters for your encryption password.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive"
      });
      return;
    }

    console.log('🔐 Starting encryption setup...');
    const result = await setupEncryption(password);
    console.log('🔐 setupEncryption result:', result);
    
    if (result.success && result.backupCodes) {
      console.log('✅ Encryption setup successful');
      setBackupCodes(result.backupCodes);
      setShowBackupCodes(true);
      setEncryptionEnabled(true);
      // currentKey will be set by the hook after setup completes
      
      toast({
        title: "Encryption enabled",
        description: "Your data is now end-to-end encrypted!",
      });
    } else {
      console.log('❌ Encryption setup failed:', result.error);
      toast({
        title: "Setup failed",
        description: result.error || "Failed to setup encryption",
        variant: "destructive"
      });
    }
  };

  const handleUnlock = async () => {
    console.log('🔍 handleUnlock called with password length:', password.length);
    
    // Check if encryption is actually set up
    if (!isKeySetup) {
      console.log('❌ No encryption setup found');
      toast({
        title: "No encryption setup",
        description: "Please set up encryption first.",
        variant: "destructive"
      });
      return;
    }
    
    setIsUnlocking(true);
    
    const result = await unlockEncryption(password);
    console.log('🔐 unlockEncryption result:', result);
    
    if (result.success) {
      console.log('✅ Unlock successful');
      setEncryptionEnabled(true);
      toast({
        title: "Encryption unlocked",
        description: "Your encrypted data is now accessible.",
      });
      // Ensure encrypted transactions are fetched immediately for reports/dashboard
      try {
        await loadTransactions();
      } catch (e) {
        console.error('Failed reloading transactions after unlock:', e);
      }
      onComplete?.();
    } else {
      console.log('❌ Unlock failed:', result.error);
      toast({
        title: "Unlock failed",
        description: result.error || "Invalid password",
        variant: "destructive"
      });
    }
    
    setIsUnlocking(false);
  };

  const handleBackupCodesComplete = () => {
    setShowBackupCodes(false);
    onComplete?.();
  };

  if (showBackupCodes) {
    return (
      <Card className="financial-card p-6 max-w-md mx-auto">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Key className="w-8 h-8 text-primary" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold">Save Your Backup Codes</h3>
            <p className="text-sm text-muted-foreground">
              These codes can help you recover your encryption key if you forget your password.
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Save these codes in a secure place. Without them, you cannot recover your encrypted data if you forget your password.
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              {backupCodes.map((code, index) => (
                <div key={index} className="p-2 bg-background rounded border">
                  {code}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleBackupCodesComplete} className="btn-primary w-full">
            <CheckCircle className="w-4 h-4 mr-2" />
            I've Saved These Codes
          </Button>
        </div>
      </Card>
    );
  }

  if (isKeySetup) {
    return (
      <Card className="financial-card p-6 max-w-md mx-auto">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold">Unlock Encryption</h3>
            <p className="text-sm text-muted-foreground">
              Enter your encryption password to access your encrypted data.
            </p>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Enter your encryption password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            />
          </div>

          <Button 
            onClick={handleUnlock} 
            disabled={!password || isUnlocking}
            className="btn-primary w-full"
          >
            {isUnlocking ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                Unlocking...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Unlock
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="financial-card p-6 max-w-md mx-auto">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold">Enable End-to-End Encryption</h3>
          <p className="text-sm text-muted-foreground">
            Protect your financial data with military-grade encryption. Only you can access your data.
          </p>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Zero-Knowledge:</strong> Your data is encrypted before leaving your device. Even we cannot see your financial information.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Create encryption password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Confirm encryption password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
          />
        </div>

        <Button 
          onClick={handleSetup} 
          disabled={!password || !confirmPassword || isKeyLoading}
          className="btn-primary w-full"
        >
          {isKeyLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
              Setting up...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 mr-2" />
              Enable Encryption
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
