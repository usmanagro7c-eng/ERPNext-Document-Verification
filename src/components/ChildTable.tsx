import { fieldLabel } from "@/config/verification";

function cellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
    <div className="overflow-hidden rounded-lg border border-border/70">
      <p className="border-b border-border/70 bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {fieldLabel(field)}
      </p>
      {rows.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              {subfields.map((sub) => (
                <th
                  key={sub}
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {fieldLabel(sub)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-border/50 last:border-b-0">
                {subfields.map((sub) => (
                  <td key={sub} className="px-4 py-2 font-medium">
                    {cellValue((row as Record<string, unknown>)?.[sub])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">—</p>
      )}
    </div>
  );
}
