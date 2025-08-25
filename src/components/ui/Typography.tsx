
import { cn } from "@/lib/utils";
import React from "react";

// Usage: <H1>Text</H1>
export const H1: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h1
    className={cn("text-3xl md:text-4xl font-bold dorkfi-text-primary mb-4", className)}
    {...props}
  />
);

export const H2: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h2
    className={cn("text-xl md:text-2xl font-semibold dorkfi-text-primary mb-2", className)}
    {...props}
  />
);

export const H3: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3
    className={cn("text-lg font-semibold dorkfi-text-primary", className)}
    {...props}
  />
);

export const Body: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p
    className={cn("text-sm md:text-base font-normal dorkfi-text-secondary", className)}
    {...props}
  />
);

export const Caption: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <span
    className={cn("text-xs md:text-sm font-medium text-muted-foreground", className)}
    {...props}
  />
);
