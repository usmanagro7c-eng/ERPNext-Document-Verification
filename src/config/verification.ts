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
