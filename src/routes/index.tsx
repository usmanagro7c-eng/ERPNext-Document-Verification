import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, QrCode, ScanLine, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { Header } from "@/components/Header";
import { ManualHashForm } from "@/components/ManualHashForm";
import { QRCodeScanner } from "@/components/QRCodeScanner";
import { ScanHistory } from "@/components/ScanHistory";
import { Button } from "@/components/ui/button";
import { useScanHistory } from "@/hooks/useScanHistory";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Document Verification Portal" },
      {
        name: "description",
        content:
          "Scan a QR code or enter a verification code to confirm the authenticity of an official document.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const { entries, clear } = useScanHistory();

  const goToVerify = useCallback(
    (hash: string) => {
      setScanning(false);
      void navigate({ to: "/verify/$hash", params: { hash } });
    },
    [navigate],
  );

  const handleInvalid = useCallback(() => {
    setScanning(false);
    setScanError("Unable to read a valid verification code from this QR code.");
  }, []);

  return (
    <div className="page-bg min-h-screen bg-background">
      <Header />

      <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-14">
        <div className="animate-rise space-y-5">
          {/* ── Intro ── */}
          <div className="space-y-1 pb-1 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground sm:text-2xl">
              Verify a Document
            </h1>
            <p className="text-sm text-muted-foreground">
              Scan the QR code on your document or enter the code manually.
            </p>
          </div>

          {/* ── QR Scan card ── */}
          <div className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <QrCode className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Scan QR Code</p>
                <p className="text-xs text-muted-foreground">Use your device camera</p>
              </div>
            </div>

            {scanError && (
              <p className="mb-3 rounded-lg bg-destructive-muted px-3 py-2 text-xs text-destructive">
                {scanError}
              </p>
            )}

            <Button
              size="lg"
              className="h-11 w-full gap-2 rounded-xl bg-primary text-sm font-semibold shadow-md hover:bg-primary/90"
              onClick={() => {
                setScanError(null);
                setScanning(true);
              }}
            >
              <ScanLine className="size-4" />
              Open Camera Scanner
            </Button>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">or enter manually</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* ── Manual entry card ── */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <KeyRound className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Enter Code Manually</p>
                <p className="text-xs text-muted-foreground">Paste code or verification link</p>
              </div>
            </div>
            <ManualHashForm onSubmit={goToVerify} />
          </div>

          {/* ── Scan History ── */}
          {entries.length > 0 && (
            <ScanHistory entries={entries} onReverify={goToVerify} onClear={clear} />
          )}
        </div>
      </main>

      {scanning && (
        <QRCodeScanner
          onResult={goToVerify}
          onInvalid={handleInvalid}
          onCancel={() => setScanning(false)}
        />
      )}
    </div>
  );
}
