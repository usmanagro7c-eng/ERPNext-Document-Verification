/**
 * Contract for the "Report Query" submission that creates an ERPNext Lead.
 *
 * Kept separate from ./verification on purpose: that file mirrors the document
 * verification contract, this one mirrors the reporting contract.
 */

/** A user-supplied file, already read into memory by the browser. */
export interface ReportAttachment {
  /** Raw file bytes as base64, WITHOUT a `data:` prefix. */
  base64: string;
  fileName: string;
  mimeType: string;
  /** Client-reported size in bytes. The server re-checks the real payload length. */
  size: number;
}

export interface ReportQueryInput {
  name: string;
  email: string;
  mobile: string;
  /** The verification code that failed, recorded in the Lead remarks. */
  hash: string;
  /** Which failure the visitor landed on, e.g. "not_found" | "invalid_hash". */
  reason: string;
  /** Where the submission was made from, recorded in the Lead remarks. */
  pageUrl?: string | undefined;
  /**
   * Honeypot. Must stay hidden, `tabIndex={-1}` and out of the accessibility
   * tree. Real visitors never fill it, naive bots usually do.
   */
  website?: string | undefined;
  /**
   * Milliseconds between the form being opened and submitted, measured
   * entirely on the browser's clock. Deliberately a duration and not a
   * timestamp: the Worker and the visitor's device do not share a clock, so
   * comparing the two directly trapped nobody locally and everybody in
   * production.
   */
  fillMs?: number | undefined;
  attachment?: ReportAttachment | null | undefined;
}

export type ReportQueryField = "name" | "email" | "mobile" | "attachment";

export type ReportQueryResult =
  | {
      ok: true;
      /** ERPNext document name of the created Lead, e.g. "LEAD-00012". */
      leadName: string;
      /**
       * The Lead exists but the file could not be stored. Reported honestly
       * rather than pretending the whole submission failed.
       */
      attachmentFailed?: boolean | undefined;
    }
  | {
      ok: false;
      message: string;
      field?: ReportQueryField | undefined;
    };
