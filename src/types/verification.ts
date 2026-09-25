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

/** Which fields are shown for a doctype (and how child tables render). */
export interface DisplaySpec {
  /** Top-level fields, in display order (doctype/name are always rendered). */
  fields: string[];
  /** Child table field -> subfields to render (e.g. items -> [item_name, qty]). */
  childTables: Record<string, string[]>;
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
  /** Display specs used to slice the returned documents, keyed by doctype. */
  displayByDoctype?: Record<string, DisplaySpec>;
  hash: string;
  verifiedAt: string;
  message?: string;
}

export type VerificationErrorKind =
  "invalid_hash" | "not_found" | "failed" | "rate_limited" | "network";
