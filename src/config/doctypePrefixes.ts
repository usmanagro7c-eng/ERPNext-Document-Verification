/**
 * Doctype prefixes printed on the document QR code, e.g. `SIN-e006e6dc…`.
 *
 * The prefix is not a decoration around the hash: ERPNext stores the WHOLE
 * prefixed string in `verification_data`, and that stored string is what the
 * verification filter compares against. So `SIN-e006e6dc…` is the value ERPNext
 * knows, and the bare hash on its own matches nothing.
 *
 * Two jobs come out of this map:
 *   1. Route a scanned code to the one doctype it can possibly belong to, so
 *      verification stops searching every doctype on every site.
 *   2. Name the ERPNext Issue Type a query about that document is filed under.
 *
 * Routing logic rather than presentation, which is why it lives beside — not
 * inside — `config/verification.ts`.
 */

/** doctype -> the prefix printed for it. Single source of truth. */
export const DOCTYPE_PREFIXES: Record<string, string> = {
  "Sales Invoice": "SIN",
  "Sales Order": "SO",
  "Delivery Note": "DN",
  "Purchase Order": "PO",
  "Purchase Receipt": "PR",
  "Purchase Invoice": "PIN",
  "Stock Entry": "SE",
};

/**
 * The inverse, because the hot path looks up BY prefix. Built once from
 * DOCTYPE_PREFIXES so the two can never drift apart; if two doctypes were ever
 * given the same prefix, the last one silently wins — prefixes must stay unique.
 */
export const DOCTYPE_BY_PREFIX: Record<string, string> = Object.fromEntries(
  Object.entries(DOCTYPE_PREFIXES).map(([doctype, prefix]) => [prefix, doctype]),
);

/** The doctype a printed prefix belongs to, or undefined when unrecognised. */
export function doctypeForPrefix(prefix: string | null | undefined): string | undefined {
  const normalized = (prefix ?? "").trim().toUpperCase();
  return normalized ? DOCTYPE_BY_PREFIX[normalized] : undefined;
}

/** The prefix printed for a doctype, or undefined when it has none. */
export function prefixForDoctype(doctype: string | null | undefined): string | undefined {
  const normalized = (doctype ?? "").trim();
  return normalized ? DOCTYPE_PREFIXES[normalized] : undefined;
}
