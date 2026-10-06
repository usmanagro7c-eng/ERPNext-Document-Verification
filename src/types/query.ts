/**
 * Contract for the "Raise a Query" submission on a VERIFIED document, which
 * creates an ERPNext Issue against the site that issued the document.
 *
 * Kept separate from ./report on purpose: that file is the unverified-code
 * reporting contract (a CRM Lead on the default site), this one is the
 * post-verification support contract (an Issue on the issuing site).
 */

export interface CreateQueryInput {
  /** The verification code that resolved to the document being queried. */
  hash: string;
  /** Site the document was found on; the Issue is created there. */
  siteId?: string | undefined;
  doctype: string;
  docname: string;
  /**
   * Customer the visitor believes owns the document. Display-only: the server
   * re-reads the document by hash and uses ITS customer, never this value.
   */
  customer?: string | undefined;
  description: string;
  pageUrl?: string | undefined;
  /** Honeypot — see ReportQueryInput.website. */
  website?: string | undefined;
  /** Browser-measured form fill duration — see ReportQueryInput.fillMs. */
  fillMs?: number | undefined;
}

export type CreateQueryField = "description";

export type CreateQueryResult =
  | {
      ok: true;
      /** ERPNext document name of the created Issue, e.g. "ISS-2026-00012". */
      issueName: string;
    }
  | {
      ok: false;
      message: string;
      field?: CreateQueryField | undefined;
    };
