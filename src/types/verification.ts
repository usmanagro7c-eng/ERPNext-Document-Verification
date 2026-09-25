/**
 * Shapes returned by the verification backend.
 * Keep this file in sync with the backend contract only — no UI concerns here.
 */

export interface VerifiedDocument {
  doctype: string;
  name: string;
  /** Any additional safe fields the backend chooses to return. */
  [key: string]: unknown;
}

export interface VerificationResponse {
  success: boolean;
  verified: boolean;
  document?: VerifiedDocument;
  /** Present when the hash resolves to more than one registered document. */
  documents?: VerifiedDocument[];
  error?: string;
  message?: string;
}

export interface VerificationResult {
  verified: boolean;
  document?: VerifiedDocument;
  /** Present when the hash resolves to more than one registered document. */
  documents?: VerifiedDocument[];
  hash: string;
  verifiedAt: string;
  message?: string;
}

export type VerificationErrorKind =
  "invalid_hash" | "not_found" | "failed" | "rate_limited" | "network";
