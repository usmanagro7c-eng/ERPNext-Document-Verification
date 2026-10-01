import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useCompanyName } from "@/components/CompanyProvider";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { NotVerifiedState } from "@/components/NotVerifiedState";
import { VerificationCard } from "@/components/VerificationCard";
import { isLikelyHash } from "@/lib/verification-hash";
import { recordScanHistory, type ScanStatus } from "@/lib/scan-history";
import { VerificationError, verifyDocument } from "@/services/verificationService";
import type { VerificationErrorKind } from "@/types/verification";

export function VerifyView({ hash }: { hash: string | undefined }) {
  const valid = Boolean(hash && isLikelyHash(hash));
  const recordedHashRef = useRef<string | null>(null);
  const { setCompanyName } = useCompanyName();

  const query = useQuery({
    queryKey: ["verify", hash],
    queryFn: () => verifyDocument(hash as string),
    enabled: valid,
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Branding follows the document: the result names the company that issued it,
  // which is not necessarily the first configured site. Cleared on unmount so
  // that going back to the portal does not leave it branded with the issuer of
  // the last document that happened to be scanned.
  const brandName = query.data?.brandName ?? null;
  useEffect(() => {
    setCompanyName(brandName);
  }, [brandName, setCompanyName]);
  useEffect(() => () => setCompanyName(null), [setCompanyName]);

  useEffect(() => {
    if (!valid || !hash || query.isPending || query.isFetching) return;

    // Prevent duplicate recording for the same hash in this view session
    if (recordedHashRef.current === hash) return;

    const status: ScanStatus = query.isError
      ? query.error instanceof VerificationError
        ? query.error.kind === "invalid_hash"
          ? "invalid"
          : query.error.kind
        : "failed"
      : query.data?.verified
        ? "verified"
        : "not_found";

    recordedHashRef.current = hash;
    recordScanHistory(hash, status);
  }, [hash, valid, query.isPending, query.isFetching, query.isError, query.error, query.data]);

  if (!valid) return <NotVerifiedState kind="invalid_hash" hash={hash ?? ""} />;
  if (query.isPending || query.isFetching) return <LoadingState />;

  if (query.isError) {
    const kind: VerificationErrorKind =
      query.error instanceof VerificationError ? query.error.kind : "failed";
    if (kind === "not_found" || kind === "invalid_hash") {
      return (
        <NotVerifiedState kind={kind} hash={hash ?? ""} onRetry={() => void query.refetch()} />
      );
    }
    return <ErrorState kind={kind} onRetry={() => void query.refetch()} />;
  }

  if (!query.data?.verified) {
    return (
      <NotVerifiedState kind="not_found" hash={hash ?? ""} onRetry={() => void query.refetch()} />
    );
  }

  return <VerificationCard result={query.data} />;
}
