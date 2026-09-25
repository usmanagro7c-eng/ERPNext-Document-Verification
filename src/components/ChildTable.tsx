import { Layers } from "lucide-react";
import { fieldLabel } from "@/config/verification";

function cellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isNumericColumn(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("qty") ||
    lower.includes("rate") ||
    lower.includes("amount") ||
    lower.includes("total") ||
    lower.includes("price") ||
    lower.includes("discount")
  );
}

export function ChildTable({
  field,
  subfields,
  rows,
}: {
  field: string;
  subfields: string[];
  rows: unknown[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-primary" />
          <p className="text-xs font-bold uppercase tracking-wider text-foreground">
            {fieldLabel(field)}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/20 text-muted-foreground">
                {subfields.map((sub) => {
                  const num = isNumericColumn(sub);
                  return (
                    <th
                      key={sub}
                      className={`whitespace-nowrap px-4 py-2.5 font-semibold uppercase tracking-wider ${
                        num ? "text-right" : "text-left"
                      }`}
                    >
                      {fieldLabel(sub)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-muted/30 even:bg-muted/10">
                  {subfields.map((sub) => {
                    const num = isNumericColumn(sub);
                    return (
                      <td
                        key={sub}
                        className={`whitespace-nowrap px-4 py-2.5 font-medium ${
                          num ? "text-right font-mono" : "text-foreground"
                        }`}
                      >
                        {cellValue((row as Record<string, unknown>)?.[sub])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-4 text-center text-xs text-muted-foreground">
          No records listed in this section.
        </p>
      )}
    </div>
  );
}
