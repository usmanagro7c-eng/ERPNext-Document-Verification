import type { VerificationErrorKind, VerificationResult } from "@/types/verification";
import { isLikelyHash } from "@/lib/verification-hash";
import { verifyDocumentServer } from "@/services/verifyProxy";

/** Isolated development fallback. Set VITE_USE_MOCK_VERIFICATION=false (or remove) to disable. */
const USE_MOCK = import.meta.env["VITE_USE_MOCK_VERIFICATION"] === "true";

export class VerificationError extends Error {
  kind: VerificationErrorKind;

  constructor(kind: VerificationErrorKind, message: string) {
    super(message);
    this.name = "VerificationError";
    this.kind = kind;
  }
}

export function isMockMode(): boolean {
  return USE_MOCK;
}

export function isApiConfigured(): boolean {
  // The same-origin server proxy (Cloudflare Worker) is always available.
  return true;
}

export async function verifyDocument(hash: string): Promise<VerificationResult> {
  const trimmed = (hash ?? "").trim();
  if (!isLikelyHash(trimmed)) {
    throw new VerificationError("invalid_hash", "Verification code is not valid.");
  }

  if (USE_MOCK) return mockVerify(trimmed);

  const result = await verifyDocumentServer({ data: { hash: trimmed } });

  if (!result.ok) {
    throw new VerificationError(result.kind, result.message || "Unable to verify this document.");
  }

  return {
    verified: true,
    ...(result.document ? { document: result.document } : {}),
    ...(result.documents ? { documents: result.documents } : {}),
    hash: trimmed,
    verifiedAt: new Date().toISOString(),
    ...(result.message ? { message: result.message } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Development-only fallback — disabled unless VITE_USE_MOCK_VERIFICATION=true */
/* ------------------------------------------------------------------ */
async function mockVerify(hash: string): Promise<VerificationResult> {
  await new Promise((r) => setTimeout(r, 900));
  if (hash.toLowerCase().startsWith("notfound")) {
    throw new VerificationError("not_found", "No document matches this verification code.");
  }
  return {
    verified: true,
    document: {
      doctype: "Sales Invoice",
      name: "ACC-SINV-2026-00042",
      status: "Submitted",
      posting_date: "2026-09-01",
      company: "Example Industries",
      customer_name: "Northwind Traders",
    },
    hash,
    verifiedAt: new Date().toISOString(),
  };
}
