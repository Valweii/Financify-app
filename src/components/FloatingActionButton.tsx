import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onImportPDF: () => void;
  onInputTransaction: () => void;
}

export const FloatingActionButton = ({ onImportPDF, onInputTransaction }: FloatingActionButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleImportPDF = () => {
    setIsOpen(false);
    onImportPDF();
  };

  const handleInputTransaction = () => {
    setIsOpen(false);
    onInputTransaction();
  };

  return (
    <div className="fab-container">
      {/* Action Menu */}
      <div className={cn(
        "absolute bottom-16 right-0 space-y-2 transition-all duration-300 ease-out",
        isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
      )}>
        {/* Import PDF Option */}
        <Card className="financial-card p-3 shadow-lg">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto p-3"
            onClick={handleImportPDF}
          >
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Upload className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-medium">Import PDF</div>
              <div className="text-xs text-muted-foreground">Bank statement</div>
            </div>
          </Button>
        </Card>

        {/* Input Transaction Option */}
        <Card className="financial-card p-3 shadow-lg">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-auto p-3"
            onClick={handleInputTransaction}
          >
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="font-medium">Input Transaction</div>
              <div className="text-xs text-muted-foreground">Manual entry</div>
            </div>
          </Button>
        </Card>
      </div>

      {/* Main FAB Button */}
      <Button
        onClick={handleToggle}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg transition-all duration-300 ease-out",
          "bg-gradient-to-r from-primary to-primary-light hover:from-primary-light hover:to-primary",
          "hover:scale-105 active:scale-95",
          isOpen && "rotate-45"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-primary-foreground" />
        ) : (
          <Plus className="w-6 h-6 text-primary-foreground" />
        )}
      </Button>
    </div>
  );
};
