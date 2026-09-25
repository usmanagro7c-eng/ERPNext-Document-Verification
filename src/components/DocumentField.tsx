import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { fieldLabel } from "@/config/verification";
import { Badge } from "@/components/ui/badge";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return JSON.stringify(value);
}

function getStatusBadge(val: string) {
  const lower = val.toLowerCase();
  if (
    ["paid", "submitted", "active", "completed", "approved", "verified"].some((s) =>
      lower.includes(s),
    )
  ) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/30 dark:text-emerald-300">
        ● {val}
      </Badge>
    );
  }
  if (["unpaid", "pending", "draft", "in progress"].some((s) => lower.includes(s))) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/30 dark:text-amber-300">
        ● {val}
      </Badge>
    );
  }
  if (["cancelled", "rejected", "overdue", "void"].some((s) => lower.includes(s))) {
    return (
      <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 border-rose-500/30 dark:text-rose-300">
        ● {val}
      </Badge>
    );
  }
  return null;
}

export function DocumentField({ name, value }: { name: string; value: unknown }) {
  const [copied, setCopied] = useState(false);
  const formatted = formatValue(value);
  const isStatus = name === "status" || name === "docstatus";
  const isName = name === "name" || name === "id";
  const isTotal = name === "grand_total" || name === "total" || name === "rounded_total";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const statusBadge = isStatus && typeof value === "string" ? getStatusBadge(value) : null;

  return (
    <div className="group flex flex-col justify-between py-3.5 sm:flex-row sm:items-center sm:gap-4 transition-colors hover:bg-muted/20 px-2 rounded-lg">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground flex items-center gap-1.5">
        <span>{fieldLabel(name)}</span>
      </dt>

      <dd className="field-value mt-1 flex items-center gap-2 text-sm font-medium sm:mt-0">
        {statusBadge ? (
          statusBadge
        ) : isTotal ? (
          <span className="font-bold text-base text-foreground font-mono bg-primary/5 px-2.5 py-0.5 rounded-lg border border-primary/10">
            {formatted}
          </span>
        ) : (
          <span className={isName ? "font-mono font-semibold text-primary" : "text-foreground"}>
            {formatted}
          </span>
        )}

        {isName && formatted !== "—" && (
          <button
            type="button"
            onClick={() => void handleCopy()}
            title="Copy ID"
            className="opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </dd>
    </div>
  );
}
