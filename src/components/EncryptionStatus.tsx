/**
 * Encryption Status Component
 * Shows current encryption status and allows management
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useEncryption } from '@/hooks/useEncryption';
import { useFinancifyStore } from '@/store';
import { Shield, Lock, Key, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';

export const EncryptionStatus = () => {
  const [showDisableWarning, setShowDisableWarning] = useState(false);
  const [showSetupFromDevice, setShowSetupFromDevice] = useState(false);
  
  const { toast } = useToast();
  const { 
    isKeySetup, 
    clearEncryption, 
    getBackupCodes,
    clearBackupCodes,
    resetWithBackupCode
  } = useEncryption();
  
  const { isEncryptionEnabled, setEncryptionEnabled, setEncryptionKey, loadTransactions } = useFinancifyStore();

  const handleDisableEncryption = () => {
    setShowDisableWarning(true);
  };

  const confirmDisableEncryption = () => {
    clearEncryption();
    setEncryptionEnabled(false);
    setEncryptionKey(null);
    setShowDisableWarning(false);
    
    toast({
      title: "Encryption disabled",
      description: "Your data will no longer be encrypted. Existing encrypted data remains encrypted.",
      variant: "destructive"
    });
  };

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

  const handleResetWithBackupCode = async (backupCode: string, newPassword: string) => {
    if (!resetWithBackupCode) return;
    
    const result = await resetWithBackupCode(backupCode, newPassword);
    if (result.success) {
      setEncryptionEnabled(true);
      setShowSetupFromDevice(false);
      toast({ 
        title: 'Encryption reset', 
        description: 'Your encryption key has been restored from backup code.' 
      });
      try { await loadTransactions(); } catch {}
    } else {
      toast({ 
        title: 'Reset failed', 
        description: result.error || 'Invalid backup code.', 
        variant: 'destructive' 
      });
    }
  };

  if (showDisableWarning) {
    return (
      <Card className="financial-card p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="text-lg font-semibold">Disable Encryption?</h3>
          </div>
          
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Disabling encryption will make your data visible to anyone with database access. 
              Your existing encrypted data will remain encrypted and inaccessible without your key.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button 
              onClick={confirmDisableEncryption}
              variant="destructive"
              size="sm"
            >
              Yes, Disable Encryption
            </Button>
            <Button 
              onClick={() => setShowDisableWarning(false)}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!isKeySetup) {
    return (
      <Card className="financial-card p-4">
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
      </Card>
    );
  }

  if (showSetupFromDevice) {
    return <SetupFromDeviceForm onCancel={() => setShowSetupFromDevice(false)} onComplete={handleResetWithBackupCode} />;
  }

  return (
    <Card className="financial-card p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">End-to-End Encryption</h3>
              <p className="text-sm text-muted-foreground">
                {isEncryptionEnabled ? 'Active' : 'Locked'}
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
            View Backup Codes
          </Button>
          <Button 
            onClick={handleSetupFromDevice}
            variant="outline"
            size="sm"
          >
            <Smartphone className="w-4 h-4 mr-1" />
            Setup from Another Device
          </Button>
          <Button 
            onClick={handleDisableEncryption}
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Disable
          </Button>
        </div>
      </div>
    </Card>
  );
};

// Setup from Another Device Form Component
interface SetupFromDeviceFormProps {
  onCancel: () => void;
  onComplete: (backupCode: string, newPassword: string) => Promise<void>;
}

const SetupFromDeviceForm = ({ onCancel, onComplete }: SetupFromDeviceFormProps) => {
  const [backupCode, setBackupCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!backupCode.trim()) {
      return;
    }
    if (newPassword.length < 8) {
      return;
    }
    if (newPassword !== confirmPassword) {
      return;
    }

    setIsLoading(true);
    try {
      await onComplete(backupCode, newPassword);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="financial-card p-6">
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
          <div>
            <label className="text-sm text-muted-foreground">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create new encryption password (min 8 characters)"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new encryption password"
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
            disabled={!backupCode.trim() || newPassword.length < 8 || newPassword !== confirmPassword || isLoading}
            size="sm"
            className="flex-1 btn-primary"
          >
            {isLoading ? 'Setting up...' : 'Setup Encryption'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
