/**
 * Shapes returned by the verification backend.
 * Keep this file in sync with the backend contract only — no UI concerns here.
 */

export interface VerifiedDocument {
  doctype: string;
  name: string;
  /** Id of the ERPNext site this document was found on. Set by the server. */
  siteId?: string;
  /** Company that issued it, resolved from that site. Null when unresolvable. */
  sourceName?: string | null;
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
  /** Company that issued the document, for branding. */
  brandName?: string | null;
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
  /**
   * Company that issued the document. The portal verifies documents from more
   * than one site, so the issuer is only known once a site has answered — until
   * then the UI stays brand-neutral rather than naming the first configured site.
   */
  brandName?: string | null;
  /** Ids of every site that returned a match, in configuration order. */
  matchedSites?: string[];
  hash: string;
  verifiedAt: string;
  message?: string;
}

export type VerificationErrorKind =
  "invalid_hash" | "not_found" | "failed" | "rate_limited" | "network";
