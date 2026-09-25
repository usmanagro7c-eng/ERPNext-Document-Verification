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
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { maskHash } from "@/lib/verification-hash";
import type { ScanHistoryEntry, ScanStatus } from "@/lib/scan-history";
import { cn } from "@/lib/utils";

const STATUS: Record<
  ScanStatus,
  {
    icon: ComponentType<{ className?: string }>;
    label: string;
    bg: string;
    text: string;
    border: string;
  }
> = {
  verified: {
    icon: BadgeCheck,
    label: "Verified",
    bg: "bg-success-muted",
    text: "text-success",
    border: "border-success/20",
  },
  not_found: {
    icon: FileQuestion,
    label: "Not found",
    bg: "bg-destructive-muted",
    text: "text-destructive",
    border: "border-destructive/20",
  },
  invalid: {
    icon: CircleSlash,
    label: "Invalid",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  failed: {
    icon: ShieldAlert,
    label: "Failed",
    bg: "bg-destructive-muted",
    text: "text-destructive",
    border: "border-destructive/20",
  },
  rate_limited: {
    icon: RotateCcw,
    label: "Rate limited",
    bg: "bg-warning-muted",
    text: "text-warning",
    border: "border-warning/20",
  },
  network: {
    icon: WifiOff,
    label: "Offline",
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
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
  const [filter, setFilter] = useState<"all" | "verified">("all");

  if (entries.length === 0) return null;

  const filtered = filter === "verified" ? entries.filter((e) => e.status === "verified") : entries;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Recent Verifications</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
            {entries.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {entries.some((e) => e.status === "verified") && (
            <div className="flex rounded-lg border border-border/70 bg-background/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "rounded-md px-2 py-0.5 font-medium transition-colors",
                  filter === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter("verified")}
                className={cn(
                  "rounded-md px-2 py-0.5 font-medium transition-colors",
                  filter === "verified"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Verified
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {/* List */}
      <ul className="divide-y divide-border/40">
        {filtered.map((entry) => {
          const s = STATUS[entry.status];
          const Icon = s.icon;
          return (
            <li
              key={`${entry.hash}-${entry.verifiedAt}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-xl border",
                  s.bg,
                  s.border,
                )}
              >
                <Icon className={cn("size-4", s.text)} />
              </div>

              <div className="min-w-0 flex-1">
                <code className="block truncate font-mono text-xs font-semibold text-foreground">
                  {maskHash(entry.hash)}
                </code>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(entry.verifiedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              <span
                className={cn(
                  "hidden rounded-md px-2 py-0.5 text-[11px] font-semibold sm:inline-block",
                  s.bg,
                  s.text,
                )}
              >
                {s.label}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 rounded-xl border-border/80 px-3 text-xs font-medium transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                onClick={() => onReverify(entry.hash)}
              >
                <RefreshCw className="size-3" />
                <span>Check</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
