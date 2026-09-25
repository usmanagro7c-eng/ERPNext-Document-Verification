import { Trash2 } from "lucide-react";
import {
  BadgeCheck,
  CircleSlash,
  Clock,
  FileQuestion,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { maskHash } from "@/lib/verification-hash";
import type { ScanHistoryEntry, ScanStatus } from "@/lib/scan-history";

const STATUS_COPY: Record<
  ScanStatus,
  { icon: ComponentType<{ className?: string }>; label: string }
> = {
  verified: { icon: BadgeCheck, label: "Verified" },
  not_found: { icon: FileQuestion, label: "Not found" },
  invalid: { icon: CircleSlash, label: "Invalid" },
  failed: { icon: ShieldAlert, label: "Failed" },
  rate_limited: { icon: RotateCcw, label: "Too many attempts" },
  network: { icon: WifiOff, label: "Offline" },
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
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold tracking-tight">Recent Checks</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 gap-1 text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        </div>

        <ul className="divide-y divide-border/70">
          {entries.map((entry) => {
            const copy = STATUS_COPY[entry.status];
            const Icon = copy.icon;
            return (
              <li
                key={`${entry.hash}-${entry.verifiedAt}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <code className="block truncate font-mono text-sm">{maskHash(entry.hash)}</code>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.verifiedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={
                      entry.status === "verified"
                        ? "flex items-center gap-1 text-xs font-medium text-success"
                        : "flex items-center gap-1 text-xs font-medium text-destructive"
                    }
                  >
                    <Icon className="size-3.5" />
                    {copy.label}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => onReverify(entry.hash)}
                  >
                    <RefreshCw className="size-3.5" />
                    Re-verify
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
