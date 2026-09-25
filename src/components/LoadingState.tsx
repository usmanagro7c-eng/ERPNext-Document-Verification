import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Verifying document..." }: { label?: string }) {
  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Checking against official ERPNext records...
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 bg-muted/30 space-y-3 px-6 py-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24 shrink-0 rounded-md" />
            <Skeleton className="h-3 flex-1 rounded-md" style={{ width: `${55 + i * 10}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
