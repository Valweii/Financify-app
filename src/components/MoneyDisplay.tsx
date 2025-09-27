import { cn } from "@/lib/utils";
import { useCounterAnimation } from "@/hooks/useCounterAnimation";

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  animate?: boolean;
}

export const MoneyDisplay = ({ 
  amount, 
  currency = "IDR", 
  className,
  showSign = false,
  size = "md",
  animate = true
}: MoneyDisplayProps) => {
  const { currentValue } = useCounterAnimation(amount, {
    duration: 1200,
    startDelay: 200,
    easeOut: true
  });

  const displayAmount = animate ? currentValue : amount;
  const formatAmount = (value: number) => {
    // Format as Indonesian Rupiah without forcing absolute value
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getSizeClass = () => {
    switch (size) {
      case "sm": return "text-sm";
      case "md": return "text-base";
      case "lg": return "text-lg font-semibold";
      case "xl": return "text-2xl font-bold";
      default: return "text-base";
    }
  };

  const getColorClass = () => {
    // Always show colors for transaction amounts
    return amount >= 0 ? "money-positive" : "money-negative";
  };

  return (
    <span
      className={cn(
        "font-mono tabular-nums whitespace-nowrap max-w-full truncate",
        getSizeClass(),
        getColorClass(),
        className
      )}
      title={formatAmount(amount)}
    >
      {formatAmount(displayAmount)}
    </span>
  );
};