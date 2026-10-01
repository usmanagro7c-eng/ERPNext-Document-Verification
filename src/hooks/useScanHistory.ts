import { useCallback, useEffect, useState } from "react";
import { clearScanHistory, loadScanHistory, type ScanHistoryEntry } from "@/lib/scan-history";

/**
 * Session-wide scan history, persisted in localStorage.
 *
 * The history is deliberately NOT read during render. `loadScanHistory` returns
 * an empty list on the server, where there is no `window` to read, so using it
 * as the `useState` initialiser made the server render an empty history while
 * the client rendered the stored one. That is a hydration mismatch: React threw
 * away the server's HTML and rebuilt the home page on every visit by a visitor
 * who had scanned anything before.
 *
 * Reading it in an effect keeps the first client render byte-identical to the
 * server's, and the history appears one paint later.
 */
export function useScanHistory() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadScanHistory());
  }, []);

  const clear = useCallback(() => {
    clearScanHistory();
    setEntries([]);
  }, []);

  // No `record`: recording happens through the module-level
  // `recordScanHistory` in VerifyView, which writes to storage directly and
  // navigates away. Returning a setter here that nothing called would only
  // invite a second source of truth.
  return { entries, clear };
}
