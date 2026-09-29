import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { FileCheck2, Image as ImageIcon, KeyRound, QrCode, ScanLine, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCompanyName } from "@/components/CompanyProvider";
import { Header } from "@/components/Header";
import { ManualHashForm } from "@/components/ManualHashForm";
import { QRCodeScanner } from "@/components/QRCodeScanner";
import { ScanHistory } from "@/components/ScanHistory";
import { Button } from "@/components/ui/button";
import { useScanHistory } from "@/hooks/useScanHistory";
import { extractVerificationHash } from "@/lib/verification-hash";

/**
 * How long the scanned hash stays visible in the manual entry field before the
 * app navigates to the verification result. Long enough to read the captured
 * code and the "verifying automatically" notice, short enough to feel instant.
 */
const AUTO_VERIFY_DELAY_MS = 1200;

export const Route = createFileRoute("/")({
  // Meta is static, so it cannot carry the company name — keep it neutral and
  // let the header render the brand in the page body.
  head: () => ({
    meta: [
      { title: "Document Verification Portal" },
      {
        name: "description",
        content:
          "Scan a QR code or enter a verification code to confirm the authenticity and integrity of an official document.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { brand, companyName } = useCompanyName();
  // A device's native QR scanner opens the printed URL directly, bypassing the
  // in-app camera. Read the params loosely (no validateSearch) so that adding
  // deep-link support does not force a `search` prop onto every <Link to="/">.
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
  const linkHash =
    searchParams["hash"] ?? searchParams["code"] ?? searchParams["verification_data"];
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [pendingVerify, setPendingVerify] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { entries, clear } = useScanHistory();

  const clearAutoVerify = useCallback(() => {
    if (verifyTimer.current) {
      clearTimeout(verifyTimer.current);
      verifyTimer.current = null;
    }
    setPendingVerify(false);
  }, []);

  // A pending auto-verify must not fire after the user leaves this route.
  useEffect(
    () => () => {
      if (verifyTimer.current) clearTimeout(verifyTimer.current);
    },
    [],
  );

  const goToVerify = useCallback(
    (hash: string) => {
      if (verifyTimer.current) {
        clearTimeout(verifyTimer.current);
        verifyTimer.current = null;
      }
      setPendingVerify(false);
      setScanning(false);
      void navigate({ to: "/verify/$hash", params: { hash } });
    },
    [navigate],
  );

  /**
   * Camera scan and image upload both land here: the hash is dropped into the
   * manual entry field so the user sees what was captured, then auto-verified.
   */
  const handleScanSuccess = useCallback(
    (hash: string) => {
      setScanning(false);
      setScanError(null);
      setActiveTab("manual");
      setManualValue(hash);
      setPendingVerify(true);

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(40);
      }

      if (verifyTimer.current) clearTimeout(verifyTimer.current);
      verifyTimer.current = setTimeout(() => {
        verifyTimer.current = null;
        setPendingVerify(false);
        void navigate({ to: "/verify/$hash", params: { hash } });
      }, AUTO_VERIFY_DELAY_MS);
    },
    [navigate],
  );

  /**
   * A native QR scanner opens `/?hash=...` in the browser without ever touching
   * the in-app camera, so the deep link runs the exact same paste-then-verify
   * flow a camera scan does.
   */
  useEffect(() => {
    if (!linkHash) return;

    const parsed = extractVerificationHash(linkHash);

    // Consume the param from the address bar. Without this, Back from the result
    // page returns to `/?hash=...` and this effect fires again, leaving the user
    // with a dead Back button. Done via history directly (preserving the router's
    // state) so it cannot re-enter this effect through a router search change.
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.hash}`,
      );
    }

    if (parsed) {
      handleScanSuccess(parsed);
    } else {
      setScanError("This link does not contain a valid verification code.");
    }
  }, [linkHash, handleScanSuccess]);

  const handleInvalid = useCallback(() => {
    setScanning(false);
    setScanError("Unable to read a valid verification code from this QR code.");
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setScanError(null);

    try {
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      if (result?.data) {
        const hash = extractVerificationHash(result.data);
        if (hash) {
          handleScanSuccess(hash);
          return;
        }
      }
      setScanError("No valid verification QR code was found in this image.");
    } catch {
      setScanError("Could not recognize a QR code. Make sure the code is sharp and well-lit.");
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="page-bg min-h-screen bg-background flex flex-col justify-between">
      <div>
        <Header />

        <main className="mx-auto w-full max-w-xl px-4 py-8 sm:py-12">
          <div className="animate-rise space-y-6">
            {/* ── Hero Section ── */}
            <div className="space-y-2.5 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-xs">
                <Sparkles className="size-3.5" />
                <span>Enterprise Authenticity Network</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Verify Document Integrity
              </h1>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                Confirm that invoices, orders, certificates, and official documents are authentic
                and directly issued by {brand}.
              </p>
            </div>

            {/* ── Mode Switcher Card ── */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-elevated">
              {/* Segmented Tab Bar */}
              <div className="flex border-b border-border/70 bg-muted/40 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("scan");
                    setScanError(null);
                    clearAutoVerify();
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "scan"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <QrCode className="size-4 text-primary" />
                  <span>Scan QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("manual");
                    setScanError(null);
                    clearAutoVerify();
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
                    activeTab === "manual"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <KeyRound className="size-4 text-primary" />
                  <span>Manual Entry</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {scanError && (
                  <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive-muted px-4 py-2.5 text-xs font-medium text-destructive animate-fade-in">
                    <span>⚠</span>
                    <span>{scanError}</span>
                  </div>
                )}

                {activeTab === "scan" ? (
                  <div className="space-y-4">
                    <p className="text-center text-xs text-muted-foreground">
                      Scan the printed QR code using your device camera or upload a picture.
                    </p>

                    <Button
                      size="lg"
                      className="h-12 w-full gap-2.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/95 hover:shadow-lg hover:scale-[1.01]"
                      onClick={() => {
                        setScanError(null);
                        setScanning(true);
                      }}
                    >
                      <ScanLine className="size-5" />
                      Open Camera Scanner
                    </Button>

                    <div className="relative flex items-center justify-center">
                      <span className="absolute inset-x-0 h-px bg-border" />
                      <span className="relative bg-card px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        or
                      </span>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleImageUpload(e)}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadLoading}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-11 w-full gap-2 rounded-xl border-dashed border-border/90 text-xs font-semibold hover:border-primary/50 hover:bg-muted/40"
                    >
                      <ImageIcon className="size-4 text-muted-foreground" />
                      {uploadLoading ? "Analyzing Image..." : "Upload QR Image / Photo"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ManualHashForm
                      value={manualValue}
                      onValueChange={setManualValue}
                      onSubmit={goToVerify}
                      pendingVerify={pendingVerify}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Scan History ── */}
            {entries.length > 0 && (
              <ScanHistory entries={entries} onReverify={goToVerify} onClear={clear} />
            )}
          </div>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border/60 bg-card/40 py-4 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 text-[11px]">
          <span className="flex items-center gap-1.5 font-medium">
            <FileCheck2 className="size-3.5 text-primary" />
            {companyName ? `${companyName} Verified Portal` : "Verified Document Portal"}
          </span>
          <span>End-to-End Cryptographic Validation</span>
        </div>
      </footer>

      {scanning && (
        <QRCodeScanner
          onResult={handleScanSuccess}
          onInvalid={handleInvalid}
          onCancel={() => setScanning(false)}
        />
      )}
    </div>
  );
}
