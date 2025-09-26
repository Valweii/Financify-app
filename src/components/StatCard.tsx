import { Card } from "@/components/ui/card";
import { MoneyDisplay } from "./MoneyDisplay";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useCounterAnimation } from "@/hooks/useCounterAnimation";

interface StatCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  icon?: LucideIcon;
  type?: "income" | "expense" | "neutral";
  className?: string;
  animate?: boolean;
}

export const StatCard = ({ 
  title, 
  amount, 
  subtitle, 
  icon: Icon,
  type = "neutral",
  className,
  animate = true
}: StatCardProps) => {
  const { currentValue } = useCounterAnimation(amount, {
    duration: 1000,
    startDelay: 300,
    easeOut: true
  });

  const displayAmount = animate ? currentValue : amount;
  const getTypeStyles = () => {
    switch (type) {
      case "income":
        return "border border-green-500/25 dark:bg-neutral-900/70 bg-card";
      case "expense":
        return "border border-red-500/25 dark:bg-neutral-900/70 bg-card";
      default:
        return "stat-card dark:bg-neutral-900/70";
    }
  };

  return (
    <Card className={cn(
      "p-4 space-y-2",
      getTypeStyles(),
      className
    )}>
      {/* Header: Title (left), Icon (right) */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>

      {/* Amount (without currency) */}
      {(() => {
        const formatted = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(displayAmount));
        const colorClass = type === "income" ? "text-green-600 dark:text-green-400" : type === "expense" ? "text-red-600 dark:text-red-400" : "text-foreground";
        return (
          <div className={cn("px-0.5", colorClass)}>
            <div className="text-base sm:text-lg md:text-xl font-semibold leading-tight">{formatted}</div>
          </div>
        );
      })()}

      {/* Footer: Subtitle (left), Currency (right) */}
      <div className="flex items-center justify-between">
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : (
          <span className="text-xs text-muted-foreground">This month</span>
        )}
        <span className="text-xs text-muted-foreground">IDR</span>
      </div>
    </Card>
  );
};