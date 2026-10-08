import type { DisplaySpec } from "@/types/verification";

/**
 * Display configuration for verified documents — single source of truth.
 * The server uses it to slice each ERP document down to only these fields
 * before it ever leaves the Worker; the card renders exactly what it receives.
 *
 * Per-doctype specs can be overridden WITHOUT code changes by putting a list
 * in the `options` field of each doctype's `verification_data` Custom Field:
 *
 *   customer,posting_date,due_date,grand_total
 *   items:item_name,qty
 *
 * (top-level fields comma-separated; child tables as fieldname:sub1,sub2)
 *
 * Item (child) tables such as the invoice `items` table are OFF by default —
 * see SHOW_CHILD_TABLES below.
 */

/**
 * Whether child tables (e.g. `items`) reach a verified document.
 *
 * A verified document shows its header fields only.
 *
 * This is enforced in resolveDisplaySpec rather than in the renderer because
 * that is the one point every display config passes through. Hiding the tables
 * in the card instead would not hold: a doctype whose `options` in ERPNext still
 * lists `items:item_name,qty` resolves to a spec that has child tables again, so
 * the table would come back on its own.
 *
 * With this off, sliceDocument() stops copying child rows as well, so item
 * names never leave the Worker at all — that is the privacy- and payload-sized
 * half of the win, and the reason the flag belongs here rather than in the UI.
 *
 * Set to true to restore the child table rendering; no other change is needed.
 */
export const SHOW_CHILD_TABLES = false;

export const CODE_DISPLAY_SPECS: Record<string, DisplaySpec> = {
  "Sales Invoice": {
    fields: ["customer", "posting_date", "due_date", "grand_total"],
    childTables: { items: ["item_name", "qty"] },
  },
  "Delivery Note": {
    fields: ["customer", "posting_date", "grand_total"],
    childTables: { items: ["item_name", "qty"] },
  },
  "Sales Order": {
    fields: ["customer", "transaction_date", "delivery_date", "grand_total"],
    childTables: { items: ["item_name", "qty"] },
  },
  Quotation: {
    fields: ["customer_name", "transaction_date", "valid_till", "grand_total"],
    childTables: { items: ["item_name", "qty"] },
  },
  "Purchase Receipt": {
    fields: ["supplier", "posting_date", "grand_total"],
    childTables: { items: ["item_name", "qty"] },
  },
  "Purchase Order": {
    fields: ["supplier", "transaction_date", "schedule_date", "grand_total"],
    childTables: { items: ["item_name", "qty"] },
  },
};

/** Used for any doctype not in CODE_DISPLAY_SPECS and not configured in ERP. */
export const GENERIC_DISPLAY_SPEC: DisplaySpec = {
  fields: ["status", "posting_date", "transaction_date", "currency", "grand_total"],
  childTables: { items: ["item_name", "qty"] },
};

/** Parses the `options` string of the verification_data Custom Field. */
export function parseDisplaySpec(options?: string): DisplaySpec | undefined {
  if (!options) return undefined;
  const lines = options
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return undefined;

  const fields: string[] = [];
  const childTables: Record<string, string[]> = {};
  let any = false;

  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon !== -1) {
      const childField = line.slice(0, colon).trim();
      const subs = line
        .slice(colon + 1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (childField && subs.length) {
        childTables[childField] = subs;
        any = true;
      }
    } else {
      fields.push(
        ...line
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
      any = true;
    }
  }

  return any ? { fields, childTables } : undefined;
}

/** ERP options win; otherwise the curated code map; otherwise the generic spec. */
export function resolveDisplaySpec(doctype: string, fromErp?: DisplaySpec): DisplaySpec {
  const spec = fromErp ?? CODE_DISPLAY_SPECS[doctype] ?? GENERIC_DISPLAY_SPEC;
  return SHOW_CHILD_TABLES ? spec : { ...spec, childTables: {} };
}
