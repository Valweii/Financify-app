import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEncryption } from "@/hooks/useEncryption";
import { useFinancifyStore } from "@/store";

function generatePassword(length: number = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export const FirstTimeEncryption = () => {
  const { setupEncryption } = useEncryption();
  const { toast } = useToast();
  const [generated, setGenerated] = useState<string>("");
  const [isSetting, setIsSetting] = useState(false);
  const [didSetup, setDidSetup] = useState(false);

  useEffect(() => {
    const pwd = generatePassword();
    setGenerated(pwd);
    (async () => {
      setIsSetting(true);
      try {
        const res = await setupEncryption(pwd);
        if (!res.success) {
          toast({ title: "Failed to set up encryption", variant: "destructive" });
        } else {
          setDidSetup(true);
        }
      } finally {
        setIsSetting(false);
      }
    })();
  }, [setupEncryption, toast]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generated);
      toast({ title: "Copied", description: "Encryption password copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Card className="financial-card p-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Your Encryption Password</h2>
          <p className="text-sm text-muted-foreground">Copy and store this password safely. You will need it for future sign-ins.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input value={generated} readOnly className="font-mono" />
          <Button onClick={copyToClipboard} variant="outline">Copy</Button>
        </div>
        <Button
          className="btn-primary w-full"
          disabled={!didSetup || isSetting}
          onClick={() => {
            toast({ title: "Encryption Ready", description: "You can now use the app." });
          }}
        >
          I have copied it – Continue
        </Button>
      </div>
    </Card>
  );
};


