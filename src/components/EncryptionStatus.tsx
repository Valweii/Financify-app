/**
 * Encryption Status Component
 * Shows current encryption status and allows management
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useEncryption } from '@/hooks/useEncryption';
import { useFinancifyStore } from '@/store';
import { Shield, Lock, Key, CheckCircle, Smartphone } from 'lucide-react';

export const EncryptionStatus = () => {
  const [showSetupFromDevice, setShowSetupFromDevice] = useState(false);
  
  const { toast } = useToast();
  const { 
    isKeySetup, 
    getBackupCodes,
    clearBackupCodes,
    resetWithBackupCode
  } = useEncryption();
  
  const { setEncryptionKey, loadTransactions } = useFinancifyStore();

  const handleShowBackupCodes = () => {
    const codes = getBackupCodes();
    if (codes) {
      // In a real app, you'd show these in a modal
      navigator.clipboard.writeText(codes.join('\n'));
      toast({
        title: "Backup codes copied",
        description: "Your backup codes have been copied to clipboard.",
      });
    }
  };

  const handleSetupFromDevice = () => {
    setShowSetupFromDevice(true);
  };

  const handleResetWithBackupCode = async (backupCode: string) => {
    if (!resetWithBackupCode) return;
    
    const result = await resetWithBackupCode(backupCode);
    if (result.success) {
      setShowSetupFromDevice(false);
      
      if (result.backupCodes) {
        // New backup codes were generated
        toast({ 
          title: 'Encryption restored', 
          description: 'Your encryption key has been restored! New backup codes have been generated.' 
        });
        
        // Copy new backup codes to clipboard
        navigator.clipboard.writeText(result.backupCodes.join('\n'));
        toast({
          title: "New backup codes copied",
          description: "Your new backup codes have been copied to clipboard.",
        });
      } else {
        toast({ 
          title: 'Encryption restored', 
          description: 'Your encryption key has been restored from backup code.' 
        });
      }
      
      // Force reload transactions after a short delay to ensure state is updated
      setTimeout(async () => {
        try { 
          await loadTransactions(); 
        } catch (error) {
          // Failed to reload transactions after backup recovery
        }
      }, 100);
    } else {
      toast({ 
        title: 'Reset failed', 
        description: result.error || 'Invalid backup code.', 
        variant: 'destructive' 
      });
    }
  };


  if (!isKeySetup) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">End-to-End Encryption</h3>
            <p className="text-sm text-muted-foreground">Not enabled</p>
          </div>
        </div>
        <Button size="sm" className="btn-primary">
          <Shield className="w-4 h-4 mr-1" />
          Enable
        </Button>
      </div>
    );
  }

  if (showSetupFromDevice) {
    return <SetupFromDeviceForm onCancel={() => setShowSetupFromDevice(false)} onComplete={handleResetWithBackupCode} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">End-to-End Encryption</h3>
            <p className="text-sm text-muted-foreground">
              Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-600 font-medium">Protected</span>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Your financial data is encrypted with AES-256-GCM. Only you can decrypt and view your data.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        <Button 
          onClick={handleShowBackupCodes}
          variant="outline"
          size="sm"
        >
          <Key className="w-4 h-4 mr-1" />
          Backup Codes
        </Button>
        <Button 
          onClick={handleSetupFromDevice}
          variant="outline"
          size="sm"
        >
          <Smartphone className="w-4 h-4 mr-1" />
          Sync
        </Button>
      </div>
    </div>
  );
};

// Setup from Another Device Form Component
interface SetupFromDeviceFormProps {
  onCancel: () => void;
  onComplete: (backupCode: string) => Promise<void>;
}

const SetupFromDeviceForm = ({ onCancel, onComplete }: SetupFromDeviceFormProps) => {
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!backupCode.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await onComplete(backupCode.trim());
    } catch (error) {
      // Failed to setup from device
    } finally {
      setIsLoading(false);
    }
  };

  const isAlphanumeric = (str: string) => {
    return /^[A-Z0-9]+$/.test(str);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Smartphone className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Setup from Another Device</h3>
        <p className="text-sm text-muted-foreground">
          Enter the backup code from your other device to restore your encryption key.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-muted-foreground">Backup Code</label>
          <input
            type="text"
            value={backupCode}
            onChange={(e) => setBackupCode(e.target.value)}
            placeholder="Enter backup code from another device"
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={onCancel}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={backupCode.length != 8 || !isAlphanumeric(backupCode)}
          size="sm"
          className="flex-1 btn-primary"
        >
          {isLoading ? 'Setting up...' : 'Setup Encryption'}
        </Button>
      </div>
    </div>
  );
};
