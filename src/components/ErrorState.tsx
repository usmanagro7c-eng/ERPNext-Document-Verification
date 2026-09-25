import { Link } from "@tanstack/react-router";
import { FileSearch, QrCode, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    description: "Too many verification attempts were made. Please wait a moment and try again.",
    action: "retry",
  },
  network: {
    icon: WifiOff,
    title: "Connection Error",
    description: "Unable to connect to the verification service.",
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
    <Card className="animate-rise shadow-card">
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
        <span className="flex size-14 items-center justify-center rounded-full bg-destructive-muted text-destructive">
          <Icon className="size-7" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {onRetry ? (
            <Button onClick={onRetry} size="lg" className="w-full sm:w-auto">
              <RefreshCw className="size-4" />
              {copy.action === "retry" ? "Retry" : "Try Again"}
            </Button>
          ) : null}
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to="/">Back to start</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
