import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileSearch,
  HelpCircle,
  QrCode,
  RefreshCw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import type { VerificationErrorKind } from "@/types/verification";

interface Copy {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tip: string;
  action: "retry" | "again";
  color: "destructive" | "warning" | "muted";
}

const COPY: Record<VerificationErrorKind, Copy> = {
  invalid_hash: {
    icon: QrCode,
    title: "Invalid Verification Code",
    description: "The provided code or link is not in a recognized verification format.",
    tip: "Tip: Make sure the complete QR code was scanned without glare or truncation.",
    action: "again",
    color: "destructive",
  },
  not_found: {
    icon: FileSearch,
    title: "Document Record Not Found",
    description: "This verification code does not match any active document in official records.",
    tip: "Tip: The document may have been cancelled, or issued by an unregistered instance.",
    action: "again",
    color: "destructive",
  },
  failed: {
    icon: ShieldAlert,
    title: "Verification Service Unavailable",
    description: "Unable to complete the verification check at this moment.",
    tip: "Tip: The ERP server might be temporarily undergoing maintenance.",
    action: "retry",
    color: "warning",
  },
  rate_limited: {
    icon: ShieldAlert,
    title: "Too Many Requests",
    description: "Too many verification requests received from your IP address.",
    tip: "Tip: For security reasons, please wait 30 seconds before attempting again.",
    action: "retry",
    color: "warning",
  },
  network: {
    icon: WifiOff,
    title: "Network Connection Issue",
    description: "Unable to establish a secure connection to the verification server.",
    tip: "Tip: Check your mobile data or Wi-Fi connectivity and try refreshing.",
    action: "retry",
    color: "muted",
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
    <div className="animate-rise overflow-hidden rounded-2xl border border-border/80 bg-card p-6 text-center shadow-card sm:p-8">
      <div className="relative mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive-muted/80 text-destructive shadow-sm ring-4 ring-destructive/10">
        <Icon className="size-8" />
      </div>

      <h2 className="text-xl font-bold tracking-tight text-foreground">{copy.title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {copy.description}
      </p>

      {/* Helpful tip box */}
      <div className="mx-auto mt-5 max-w-md rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-left flex items-start gap-2.5">
        <HelpCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{copy.tip}</p>
      </div>

      <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
        {onRetry && (
          <Button
            onClick={onRetry}
            size="lg"
            className="h-11 gap-2 rounded-xl bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90"
          >
            <RefreshCw className="size-4" />
            {copy.action === "retry" ? "Retry Verification" : "Try Again"}
          </Button>
        )}

        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-11 gap-2 rounded-xl border-border/80"
        >
          <Link to="/">
            <ArrowLeft className="size-4" />
            Return to Portal Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
