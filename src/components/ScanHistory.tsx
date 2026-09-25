import {
  BadgeCheck,
  CircleSlash,
  Clock,
  FileQuestion,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  WifiOff,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { maskHash } from "@/lib/verification-hash";
import type { ScanHistoryEntry, ScanStatus } from "@/lib/scan-history";
import { cn } from "@/lib/utils";

const STATUS: Record<
  ScanStatus,
  { icon: ComponentType<{ className?: string }>; label: string; color: string }
> = {
  verified: { icon: BadgeCheck, label: "Verified", color: "text-success" },
  not_found: { icon: FileQuestion, label: "Not found", color: "text-destructive" },
  invalid: { icon: CircleSlash, label: "Invalid", color: "text-muted-foreground" },
  failed: { icon: ShieldAlert, label: "Failed", color: "text-destructive" },
  rate_limited: { icon: RotateCcw, label: "Rate limited", color: "text-warning" },
  network: { icon: WifiOff, label: "Offline", color: "text-muted-foreground" },
};

export function ScanHistory({
  entries,
  onReverify,
  onClear,
}: {
  entries: ScanHistoryEntry[];
  onReverify: (hash: string) => void;
  onClear: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-muted-foreground" />
          <p className="text-[13px] font-semibold text-foreground">Recent Checks</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3" />
          Clear
        </Button>
      </div>

      {/* List */}
      <ul className="divide-y divide-border/50">
        {entries.map((entry) => {
          const s = STATUS[entry.status];
          const Icon = s.icon;
          return (
            <li
              key={`${entry.hash}-${entry.verifiedAt}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/20"
            >
              <Icon className={cn("size-4 shrink-0", s.color)} />
              <div className="min-w-0 flex-1">
                <code className="block truncate font-mono text-xs text-foreground">
                  {maskHash(entry.hash)}
                </code>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(entry.verifiedAt).toLocaleString()}
                </p>
              </div>
              <span className={cn("hidden shrink-0 text-xs font-medium sm:block", s.color)}>
                {s.label}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1 rounded-lg px-2.5 text-xs"
                onClick={() => onReverify(entry.hash)}
              >
                <RefreshCw className="size-3" />
                Re-verify
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
