import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { VerificationCard } from "@/components/VerificationCard";
import { isLikelyHash } from "@/lib/verification-hash";
import { recordScanHistory, type ScanStatus } from "@/lib/scan-history";
import { VerificationError, verifyDocument } from "@/services/verificationService";
import type { VerificationErrorKind } from "@/types/verification";

export function VerifyView({ hash }: { hash: string | undefined }) {
  const valid = Boolean(hash && isLikelyHash(hash));

  const query = useQuery({
    queryKey: ["verify", hash],
    queryFn: () => verifyDocument(hash as string),
    enabled: valid,
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!valid || !hash || query.isPending || query.isFetching) return;
    const status: ScanStatus = query.isError
      ? query.error instanceof VerificationError
        ? query.error.kind === "invalid_hash"
          ? "invalid"
          : query.error.kind
        : "failed"
      : query.data?.verified
        ? "verified"
        : "not_found";
    recordScanHistory(hash, status);
  }, [hash, valid, query.isPending, query.isFetching, query.isError, query.error, query.data]);

  if (!valid) return <ErrorState kind="invalid_hash" />;
  if (query.isPending || query.isFetching) return <LoadingState />;

  if (query.isError) {
    const kind: VerificationErrorKind =
      query.error instanceof VerificationError ? query.error.kind : "failed";
    return <ErrorState kind={kind} onRetry={() => void query.refetch()} />;
  }

  if (!query.data?.verified) {
    return <ErrorState kind="not_found" onRetry={() => void query.refetch()} />;
  }

  return <VerificationCard result={query.data} />;
}
