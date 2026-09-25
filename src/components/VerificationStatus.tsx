import { BadgeCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerificationStatus({ verified }: { verified: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl px-6 py-7 text-center",
        verified ? "bg-success-muted" : "bg-warning-muted",
      )}
    >
      <span
        className={cn(
          "animate-seal flex size-14 items-center justify-center rounded-full",
          verified ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground",
        )}
      >
        {verified ? <BadgeCheck className="size-8" /> : <ShieldAlert className="size-8" />}
      </span>
      <div>
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.18em]",
            verified ? "text-success" : "text-warning",
          )}
        >
          {verified ? "Verified" : "Not Verified"}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
          {verified ? "Document Verified Successfully" : "Document Could Not Be Verified"}
        </h2>
      </div>
    </div>
  );
}
