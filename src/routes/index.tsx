import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileCheck2, Lock, QrCode, ScanLine } from "lucide-react";
import { useCallback, useState } from "react";
import { Header } from "@/components/Header";
import { ManualHashForm } from "@/components/ManualHashForm";
import { QRCodeScanner } from "@/components/QRCodeScanner";
import { ScanHistory } from "@/components/ScanHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useScanHistory } from "@/hooks/useScanHistory";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Document Verification Portal — Verify a Document" },
      {
        name: "description",
        content:
          "Scan a QR code or enter a verification code to confirm the authenticity of an official document.",
      },
      { property: "og:title", content: "Document Verification Portal" },
      {
        property: "og:description",
        content: "Scan a QR code to verify the authenticity of an official document.",
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
    <div className="portal-surface min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <div className="animate-rise space-y-6">
          <div className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileCheck2 className="size-7" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Document Verification
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
              Scan a valid QR code to verify this document.
            </p>
          </div>

          <Card className="shadow-card">
            <CardContent className="space-y-6 p-5 sm:p-7">
              <Button size="lg" className="h-12 w-full text-base" onClick={() => setScanning(true)}>
                <ScanLine className="size-5" />
                Scan QR Code
              </Button>

              {scanError ? <p className="text-sm text-destructive">{scanError}</p> : null}

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <ManualHashForm onSubmit={goToVerify} />
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoTile
              icon={<QrCode className="size-4" />}
              title="QR based checks"
              body="Every issued document carries a unique QR code linked to its verification record."
            />
            <InfoTile
              icon={<Lock className="size-4" />}
              title="Private by design"
              body="Only the limited fields released for public verification are ever displayed."
            />
          </div>

          <ScanHistory entries={entries} onReverify={goToVerify} onClear={clear} />
        </div>
      </main>

      {scanning ? (
        <QRCodeScanner
          onResult={goToVerify}
          onInvalid={handleInvalid}
          onCancel={() => setScanning(false)}
        />
      ) : null}
    </div>
  );
}

function InfoTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 p-4">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
