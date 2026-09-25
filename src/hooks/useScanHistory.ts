import { useCallback, useState } from "react";
import {
  clearScanHistory,
  loadScanHistory,
  recordScanHistory,
  type ScanHistoryEntry,
  type ScanStatus,
} from "@/lib/scan-history";

export function useScanHistory() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>(loadScanHistory);

  const record = useCallback((hash: string, status: ScanStatus) => {
    setEntries(recordScanHistory(hash, status));
  }, []);

  const clear = useCallback(() => {
    clearScanHistory();
    setEntries([]);
  }, []);

  return { entries, record, clear };
}
