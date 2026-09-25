/**
 * Presentation configuration for verified documents.
 * The backend decides which fields to return; this only controls how they render.
 */

/** Rendered first, in this order, when present. */
export const PRIMARY_FIELDS = ["doctype", "name", "status", "date", "posting_date", "creation"];

/** Never rendered, even if the backend returns them. */
export const HIDDEN_FIELDS = new Set([
  "verification_data",
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
  posting_date: "Issued Date",
  creation: "Created",
  modified: "Last Updated",
  customer: "Customer",
  customer_name: "Customer",
  supplier: "Supplier",
  company: "Company",
  grand_total: "Total",
  currency: "Currency",
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
