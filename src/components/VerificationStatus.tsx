import { BadgeCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerificationStatus({ verified }: { verified: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl px-6 py-8 text-center",
        verified ? "bg-success-muted" : "bg-warning-muted",
      )}
    >
      {/* Subtle corner accent */}
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-25 blur-2xl",
          verified ? "bg-success" : "bg-warning",
        )}
      />

      <div className="relative flex flex-col items-center gap-4">
        <span
          className={cn(
            "animate-seal flex size-16 items-center justify-center rounded-2xl shadow-lg",
            verified
              ? "bg-success text-success-foreground shadow-success/20"
              : "bg-warning text-warning-foreground shadow-warning/20",
          )}
        >
          {verified ? <BadgeCheck className="size-9" /> : <ShieldAlert className="size-9" />}
        </span>

        <div>
          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.2em]",
              verified ? "text-success" : "text-warning",
            )}
          >
            {verified ? "✓ Verified" : "⚠ Not Verified"}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">
            {verified ? "Document Verified" : "Could Not Verify"}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {verified
              ? "This document is authentic and matches official records."
              : "This document could not be confirmed against official records."}
          </p>
        </div>
      </div>
    </div>
  );
}
