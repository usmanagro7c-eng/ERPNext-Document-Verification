/**
 * Session-wide scan history, persisted in localStorage.
 * Pure storage helpers (no React) so any module can record an entry.
 */

export type ScanStatus =
  "verified" | "not_found" | "invalid" | "failed" | "rate_limited" | "network";

export interface ScanHistoryEntry {
  hash: string;
  status: ScanStatus;
  verifiedAt: string;
}

const STORAGE_KEY = "verification:history";
const MAX_ENTRIES = 10;

export function loadScanHistory(): ScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function recordScanHistory(hash: string, status: ScanStatus): ScanHistoryEntry[] {
  const entry: ScanHistoryEntry = { hash, status, verifiedAt: new Date().toISOString() };
  const next = [entry, ...loadScanHistory()].slice(0, MAX_ENTRIES);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full or blocked — keep in-memory copy only.
    }
  }
  return next;
}

export function clearScanHistory(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }
}

function isEntry(value: unknown): value is ScanHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry["hash"] === "string" &&
    typeof entry["status"] === "string" &&
    typeof entry["verifiedAt"] === "string"
  );
}
