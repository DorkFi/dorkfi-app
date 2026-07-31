import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Minimal Suspense fallback for lazy Index tabs / App routes. */
export function LazyRouteFallback({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("w-full space-y-3 p-4", className)}
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-48 max-w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/** Minimal Suspense fallback while a lazy Markets action modal chunk loads. */
export function LazyModalFallback() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-busy="true"
      aria-label="Loading modal"
    >
      <div className="w-full max-w-md space-y-3 rounded-lg border border-border bg-background p-6 shadow-lg">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
