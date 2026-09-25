import { fieldLabel } from "@/config/verification";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return JSON.stringify(value);
}

export function DocumentField({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="border-b border-border/70 py-3 last:border-b-0 sm:grid sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {fieldLabel(name)}
      </dt>
      <dd className="field-value mt-1 text-sm font-medium sm:mt-0">{formatValue(value)}</dd>
    </div>
  );
}
