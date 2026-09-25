import { Loader2, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Verifying document integrity..." }: { label?: string }) {
  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
      <div className="relative flex flex-col items-center gap-4 px-6 py-12 text-center overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-10 size-40 rounded-full bg-primary/10 blur-2xl" />

        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/20 via-primary/10 to-transparent p-3 ring-8 ring-primary/5">
          <Loader2 className="size-8 animate-spin text-primary" />
          <ShieldCheck className="absolute size-4 text-primary" />
        </div>

        <div className="space-y-1.5 z-10">
          <p className="text-base font-bold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            Cryptographically validating hash against official ERPNext records...
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2 text-[11px] font-medium text-muted-foreground">
          <span className="flex size-2 rounded-full bg-primary animate-ping" />
          <span>Real-time Secure Query</span>
        </div>
      </div>

      <div className="border-t border-border/60 bg-muted/20 space-y-3.5 px-6 py-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-28 shrink-0 rounded-md" />
            <Skeleton
              className="h-4 flex-1 rounded-md"
              style={{ width: `${60 + ((i * 13) % 35)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
