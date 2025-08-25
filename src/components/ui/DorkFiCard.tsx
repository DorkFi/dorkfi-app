
import { cn } from "@/lib/utils";
import React from "react";

interface DorkFiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  elevation?: "none" | "sm" | "md" | "lg";
  children: React.ReactNode;
}

const elevationClasses = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

const DorkFiCard = React.forwardRef<HTMLDivElement, DorkFiCardProps>(
  ({ hoverable = true, elevation = "md", className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-gray-200/50 dark:border-ocean-teal/20 p-4",
        elevationClasses[elevation],
        hoverable && "card-hover hover:shadow-lg hover:border-ocean-teal/40 transition-all",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

DorkFiCard.displayName = "DorkFiCard";
export default DorkFiCard;
