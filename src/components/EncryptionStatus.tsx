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
import { Shield, Lock, Key, AlertTriangle, CheckCircle } from 'lucide-react';

export const EncryptionStatus = () => {
  const [showDisableWarning, setShowDisableWarning] = useState(false);
  
  const { toast } = useToast();
  const { 
    isKeySetup, 
    clearEncryption, 
    getBackupCodes,
    clearBackupCodes 
  } = useEncryption();
  
  const { isEncryptionEnabled, setEncryptionEnabled, setEncryptionKey } = useFinancifyStore();

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
