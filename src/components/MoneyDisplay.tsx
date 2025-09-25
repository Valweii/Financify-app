import { cn } from "@/lib/utils";

interface MoneyDisplayProps {
  amount: number;
  currency?: string;
  className?: string;
  showSign?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

export const MoneyDisplay = ({ 
  amount, 
  currency = "IDR", 
  className,
  showSign = false,
  size = "md"
}: MoneyDisplayProps) => {
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
    if (!showSign) return "";
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
      {formatAmount(amount)}
    </span>
  );
};