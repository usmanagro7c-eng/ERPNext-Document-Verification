import { CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerificationStatus({ verified }: { verified: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-6 sm:p-8 text-center shadow-elevated transition-all",
        verified
          ? "border-success/30 bg-gradient-to-b from-success-muted/80 via-card to-card text-foreground"
          : "border-warning/30 bg-gradient-to-b from-warning-muted/80 via-card to-card text-foreground",
      )}
    >
      {/* Background ambient glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 size-48 rounded-full opacity-20 blur-3xl",
          verified ? "bg-success" : "bg-warning",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -left-12 -bottom-12 size-48 rounded-full opacity-15 blur-3xl",
          verified ? "bg-success" : "bg-warning",
        )}
      />

      <div className="relative flex flex-col items-center gap-3.5">
        {/* Animated Stamp Seal */}
        <div className="relative">
          <div
            className={cn(
              "animate-seal flex size-18 items-center justify-center rounded-2xl shadow-xl transition-transform",
              verified
                ? "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/25 ring-4 ring-emerald-500/20"
                : "bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-amber-500/25 ring-4 ring-amber-500/20",
            )}
          >
            {verified ? <ShieldCheck className="size-10" /> : <ShieldAlert className="size-10" />}
          </div>

          {verified && (
            <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm dark:bg-slate-900">
              <CheckCircle2 className="size-5 fill-emerald-500 text-white dark:text-slate-900" />
            </span>
          )}
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
            <span
              className={cn(
                "size-1.5 rounded-full",
                verified ? "bg-success animate-pulse" : "bg-warning",
              )}
            />
            <span className={verified ? "text-success font-bold" : "text-warning font-bold"}>
              {verified ? "Official Record Verified" : "Authentication Notice"}
            </span>
          </div>

          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {verified ? "Authentic Document" : "Could Not Verify Document"}
          </h2>

          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {verified
              ? "This document's cryptographic signature perfectly matches the official ERPNext record. No tampering has been detected."
              : "This document could not be matched against official ERPNext database records. Please double-check the QR code or link."}
          </p>
        </div>
      </div>
    </div>
  );
}
