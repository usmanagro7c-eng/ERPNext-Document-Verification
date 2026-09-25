import type { VerificationErrorKind, VerificationResult } from "@/types/verification";
import { isLikelyHash } from "@/lib/verification-hash";
import { verifyDocumentServer } from "@/services/verifyProxy";

export class VerificationError extends Error {
  kind: VerificationErrorKind;

  constructor(kind: VerificationErrorKind, message: string) {
    super(message);
    this.name = "VerificationError";
    this.kind = kind;
  }
}

export async function verifyDocument(hash: string): Promise<VerificationResult> {
  const trimmed = (hash ?? "").trim();
  if (!isLikelyHash(trimmed)) {
    throw new VerificationError("invalid_hash", "Verification code is not valid.");
  }

  const result = await verifyDocumentServer({ data: { hash: trimmed } });

  if (!result.ok) {
    throw new VerificationError(result.kind, result.message || "Unable to verify this document.");
  }

  return {
    verified: true,
    ...(result.document ? { document: result.document } : {}),
    ...(result.documents ? { documents: result.documents } : {}),
    ...(result.displayByDoctype ? { displayByDoctype: result.displayByDoctype } : {}),
    hash: trimmed,
    verifiedAt: new Date().toISOString(),
    ...(result.message ? { message: result.message } : {}),
  };
}
