import { Link } from "@tanstack/react-router";
import { ArrowLeft, HelpCircle, MessageSquareWarning, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ReportQueryDialog } from "@/components/ReportQueryDialog";
import { VerificationStatus } from "@/components/VerificationStatus";
import { Button } from "@/components/ui/button";
import { maskHash } from "@/lib/verification-hash";

/**
 * Shown when a code is well-formed but matches no official record.
 *
 * Deliberately separate from ErrorState: a service outage or a rate limit is
 * not evidence that a document is unverified, and telling a visitor their
 * document is unverified when our own server is down would be wrong.
 */
type NotVerifiedKind = "not_found" | "invalid_hash";

const COPY: Record<NotVerifiedKind, { tip: string }> = {
  not_found: {
    tip: "The document may have been cancelled, or it may have been issued by an instance that is not registered on this portal.",
  },
  invalid_hash: {
    tip: "The code could not be read as a verification hash. Re-scan the QR code in good light, or enter the code manually.",
  },
};

export function NotVerifiedState({
  kind,
  hash,
  onRetry,
}: {
  kind: NotVerifiedKind;
  hash: string;
  onRetry?: () => void;
}) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="animate-rise space-y-4">
      <VerificationStatus verified={false} />

      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
        <div className="p-5 space-y-4 sm:p-6">
          {/* The code that was actually checked, so the visitor can quote it. */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Code checked
            </p>
            <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5 font-mono text-xs font-medium text-foreground">
              {hash ? maskHash(hash) : "Not available"}
            </p>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5">
            <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{COPY[kind].tip}</p>
          </div>

          <div className="flex flex-col justify-center gap-2.5 sm:flex-row">
            <Button
              onClick={() => setReportOpen(true)}
              size="lg"
              className="h-11 gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <MessageSquareWarning className="size-4" />
              Report Query
            </Button>

            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="lg"
                className="h-11 gap-2 rounded-xl border-border/80 text-sm font-semibold"
              >
                <RefreshCw className="size-4" />
                Check Again
              </Button>
            )}

            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 gap-2 rounded-xl border-border/80 text-sm font-semibold"
            >
              <Link to="/">
                <ArrowLeft className="size-4" />
                Return to Portal Home
              </Link>
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Think this is wrong? Send us the details and our records team will check it.
          </p>
        </div>
      </div>

      <ReportQueryDialog open={reportOpen} onOpenChange={setReportOpen} hash={hash} reason={kind} />
    </div>
  );
}
