import { Link } from "@tanstack/react-router";
import { FileSearch, QrCode, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import type { VerificationErrorKind } from "@/types/verification";

interface Copy {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: "retry" | "again";
}

const COPY: Record<VerificationErrorKind, Copy> = {
  invalid_hash: {
    icon: QrCode,
    title: "Invalid QR Code",
    description: "Unable to read a valid verification code from this QR code.",
    action: "again",
  },
  not_found: {
    icon: FileSearch,
    title: "Document Not Found",
    description: "The verification code does not match any registered document.",
    action: "again",
  },
  failed: {
    icon: ShieldAlert,
    title: "Verification Failed",
    description: "Unable to verify this document at the moment. Please try again later.",
    action: "retry",
  },
  rate_limited: {
    icon: ShieldAlert,
    title: "Too Many Attempts",
    description: "Too many verification requests. Please wait a moment and try again.",
    action: "retry",
  },
  network: {
    icon: WifiOff,
    title: "Connection Error",
    description: "Unable to connect to the verification service. Check your internet connection.",
    action: "retry",
  },
};

export function ErrorState({
  kind,
  onRetry,
}: {
  kind: VerificationErrorKind;
  onRetry?: () => void;
}) {
  const copy = COPY[kind];
  const Icon = copy.icon;

  return (
    <div className="animate-rise overflow-hidden rounded-2xl border border-border bg-card p-8 text-center shadow-card">
      <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-destructive-muted text-destructive">
        <Icon className="size-7" />
      </span>
      <h2 className="text-base font-bold text-foreground">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        {onRetry && (
          <Button onClick={onRetry} className="gap-2 rounded-xl">
            <RefreshCw className="size-3.5" />
            {copy.action === "retry" ? "Retry" : "Try Again"}
          </Button>
        )}
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
