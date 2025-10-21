
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = 
  | "primary"
  | "secondary"
  | "danger"
  | "danger-outline"
  | "critical"
  | "high"
  | "moderate"
  | "safe"
  | "borrow"
  | "borrow-outline"
  | "mint";

interface DorkFiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-ocean-teal hover:bg-ocean-teal/90 text-white",
  secondary: "border border-ocean-teal text-ocean-teal hover:bg-ocean-teal/10",
  danger: "bg-red-500 hover:bg-red-600 text-white",
  "danger-outline": "border border-red-500 text-red-500 hover:bg-red-500 hover:text-white",
  critical: "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none",
  high: "bg-accent text-accent-foreground hover:bg-accent/90 border-none",
  moderate: "bg-whale-gold text-white hover:bg-whale-gold/90 border-none",
  safe: "bg-ocean-teal text-white hover:bg-ocean-teal/90 border-none",
  borrow: "bg-whale-gold text-white hover:bg-whale-gold/90 border-none",
  "borrow-outline": "border border-whale-gold text-whale-gold hover:bg-whale-gold hover:text-white",
  mint: "border border-pink-500 text-pink-500 hover:bg-pink-500 hover:text-white"
};

// All buttons standardized: min-h-[44px] min-w-[92px] px-4 py-2 text-sm font-semibold rounded-lg btn-hover-lift shadow-sm/hover:shadow-md transition-all, flex/center content, gap-1
const DorkFiButton = React.forwardRef<HTMLButtonElement, DorkFiButtonProps>(
  ({ variant = "primary", size = 'md', className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "rounded-lg font-semibold min-h-[44px] min-w-[92px] btn-hover-lift shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1",
        size === 'sm' ? 'px-3 py-1.5 text-xs' : size === 'lg' ? 'px-5 py-3 text-base' : 'px-4 py-2 text-sm',
        variantClasses[variant],
        className
      )}
      type={props.type || "button"}
      tabIndex={props.onClick ? 0 : -1}
      style={{ pointerEvents: props.onClick ? "auto" : "none" }}
      {...props}
    >
      {children}
    </button>
  )
);

DorkFiButton.displayName = "DorkFiButton";
export default DorkFiButton;
