import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { useEncryption } from "@/hooks/useEncryption";
import { useFinancifyStore } from "@/store";
import { AlertTriangle, Key, RefreshCw, Shield } from "lucide-react";

interface EncryptionRecoveryProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EncryptionRecovery = ({ isOpen, onClose, onSuccess }: EncryptionRecoveryProps) => {
  const [backupCode, setBackupCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [showNewBackupCodes, setShowNewBackupCodes] = useState(false);
  
  const { toast } = useToast();
  const { resetWithBackupCode, setupEncryption } = useEncryption();
  const { setEncryptionKey, loadTransactions } = useFinancifyStore();

  const handleRecovery = async () => {
    if (!backupCode.trim()) {
      toast({
        title: "Backup code required",
        description: "Please enter your backup code to recover your encryption key.",
        variant: "destructive"
      });
      return;
    }

    setIsRecovering(true);
    try {
      const result = await resetWithBackupCode(backupCode.trim());
      
      if (result.success && result.key) {
        setEncryptionKey(result.key);
        await loadTransactions();
        
        if (result.backupCodes) {
          // New backup codes were generated (either for existing key or new key)
          setNewBackupCodes(result.backupCodes);
          setShowNewBackupCodes(true);
          
          toast({
            title: "Encryption recovered",
            description: "Your encryption key has been successfully recovered! New backup codes have been generated.",
          });
        } else {
          toast({
            title: "Encryption recovered",
            description: "Your encryption key has been successfully recovered!",
          });
          
          onSuccess();
          onClose();
        }
      } else {
        toast({
          title: "Recovery failed",
          description: result.error || "Invalid backup code. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Recovery failed",
        description: "An error occurred during recovery. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRecovering(false);
    }
  };

  const handleGenerateNew = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Password required",
        description: "Please enter and confirm your new password.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Please use at least 8 characters for your encryption password.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingNew(true);
    try {
      const result = await setupEncryption(newPassword);
      
      if (result.success && result.backupCodes) {
        setEncryptionKey(result.key!);
        await loadTransactions();
        
        toast({
          title: "New encryption generated",
          description: "A new encryption key has been generated. Your previous encrypted data will be inaccessible.",
          variant: "destructive"
        });
        
        // Show backup codes
        const backupCodesText = result.backupCodes.join('\n');
        navigator.clipboard.writeText(backupCodesText);
        
        toast({
          title: "Backup codes copied",
          description: "Your new backup codes have been copied to clipboard. Save them safely!",
        });
        
        onSuccess();
        onClose();
      } else {
        toast({
          title: "Setup failed",
          description: result.error || "Failed to generate new encryption key.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Setup failed",
        description: "An error occurred during setup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingNew(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-orange-500" />
            Encryption Key Recovery
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your encryption key is missing from this device. You can recover it using your backup codes or generate a new one.
            </AlertDescription>
          </Alert>

          {!showNewPasswordForm ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Backup Code</label>
                <Input
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)}
                  placeholder="Enter your backup code"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one of your backup codes to recover your encryption key
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleRecovery}
                  disabled={isRecovering || !backupCode.trim()}
                  className="flex-1"
                >
                  {isRecovering ? "Recovering..." : "Recover Key"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNewPasswordForm(true)}
                  className="flex-1"
                >
                  Generate New
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Generating a new encryption key will make all your previous encrypted data inaccessible. Only do this if you've lost your backup codes.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateNew}
                  disabled={isGeneratingNew || !newPassword || !confirmPassword}
                  variant="destructive"
                  className="flex-1"
                >
                  {isGeneratingNew ? "Generating..." : "Generate New Key"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNewPasswordForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {/* New Backup Codes Dialog */}
      <Dialog open={showNewBackupCodes} onOpenChange={() => setShowNewBackupCodes(false)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              New Backup Codes Generated
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                New backup codes have been generated. Save these codes safely - you'll need them for future recovery!
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold">Your New Backup Codes</h3>
              </div>
              <div className="space-y-2">
                {newBackupCodes.map((code, index) => (
                  <div key={index} className="p-2 bg-muted rounded font-mono text-sm">
                    {code}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Store these codes safely. You'll need them to recover your encryption key if you lose access to this device.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(newBackupCodes.join('\n'));
                  toast({
                    title: "Backup codes copied",
                    description: "Your backup codes have been copied to clipboard.",
                  });
                }}
                variant="outline"
                className="flex-1"
              >
                Copy All Codes
              </Button>
              <Button
                onClick={() => {
                  setShowNewBackupCodes(false);
                  setNewBackupCodes([]);
                  onSuccess();
                  onClose();
                }}
                className="flex-1"
              >
                I've Saved My Codes - Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
