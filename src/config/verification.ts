/**
 * Presentation configuration for verified documents.
 * Which fields are shown is decided by the server's display specs
 * (src/config/displaySpecs.ts). This file only supplies labels and a
 * defensive hidden set.
 */

/** Never rendered, even if a broken client receives them. */
export const HIDDEN_FIELDS = new Set([
  "verification_data",
  "verification_qr_code",
  "api_key",
  "api_secret",
  "password",
  "token",
  "owner_email",
]);

export const FIELD_LABELS: Record<string, string> = {
  doctype: "Document Type",
  name: "Document ID",
  status: "Status",
  docstatus: "Status",
  date: "Issued Date",
  posting_date: "Posting Date",
  transaction_date: "Transaction Date",
  delivery_date: "Delivery Date",
  schedule_date: "Schedule Date",
  valid_till: "Valid Till",
  due_date: "Due Date",
  creation: "Created",
  modified: "Last Updated",
  customer: "Customer",
  customer_name: "Customer",
  supplier: "Supplier",
  company: "Company",
  grand_total: "Grand Total",
  currency: "Currency",
  item_name: "Item Name",
  qty: "Quantity",
};

export function fieldLabel(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim()
  );
}

/**
 * Visitor-facing names for ERP doctypes.
 *
 * The ERP identifies its own document types, but the portal presents itself
 * under the company's own name, so doctypes are renamed rather than shown raw.
 * Anything not listed here still goes through `doctypeLabel`, which strips the
 * words that would give the backing system away.
 */
export const DOCTYPE_LABELS: Record<string, string> = {
  "Sales Invoice": "Invoice",
  "Delivery Note": "Delivery Note",
  "Sales Order": "Sales Order",
  Quotation: "Quotation",
  "Purchase Receipt": "Vendor Receipt",
  "Purchase Order": "Vendor Order",
};

/** Words that identify the backing ERP and must never reach a visitor. */
const ERP_FINGERPRINTS = /\b(erpnext|frappe|desk|doctype|erp)\b/gi;

export function doctypeLabel(doctype: string | undefined): string {
  const raw = (doctype ?? "").trim();
  if (!raw) return "Document";
  if (DOCTYPE_LABELS[raw]) return DOCTYPE_LABELS[raw];

  const generic = raw
    .replace(ERP_FINGERPRINTS, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return generic ? fieldLabel(generic.toLowerCase()) : "Document";
}
