import { CameraOff, Loader2, X, ScanLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { extractVerificationHash } from "@/lib/verification-hash";

type ScannerState = "starting" | "scanning" | "denied" | "unsupported";

interface QRCodeScannerProps {
  /** Called with the extracted hash once a valid code is detected. */
  onResult: (hash: string) => void;
  /** Called when a code is read but no verification hash could be extracted. */
  onInvalid?: (content: string) => void;
  onCancel: () => void;
}

export function QRCodeScanner({ onResult, onInvalid, onCancel }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handledRef = useRef(false);
  const [state, setState] = useState<ScannerState>("starting");

  useEffect(() => {
    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let cancelled = false;

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }

      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled) return;

        const instance = new QrScanner(
          video,
          (result: { data: string }) => {
            if (handledRef.current) return;
            const hash = extractVerificationHash(result.data);
            handledRef.current = true;
            instance.stop();
            if (hash) onResult(hash);
            else onInvalid?.(result.data);
          },
          {
            highlightScanRegion: false,
            highlightCodeOutline: false,
            preferredCamera: "environment",
            maxScansPerSecond: 5,
          },
        );
        scanner = instance;
        await instance.start();
        if (!cancelled) setState("scanning");
      } catch {
        if (!cancelled) setState("denied");
      }
    };

    void start();

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [onResult, onInvalid]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-black/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white">
          <ScanLine className="size-5 text-primary" />
          <div>
            <p className="text-sm font-bold">Scan QR Code</p>
            <p className="text-[11px] text-white/60">
              {state === "scanning"
                ? "Scanning — point camera at QR code"
                : state === "starting"
                  ? "Starting camera..."
                  : "Camera unavailable"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Cancel scanning"
          className="size-9 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </Button>
      </div>

      {/* Camera viewport */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover opacity-90"
          playsInline
          muted
        />

        {/* Darkened overlay with clear center */}
        <div className="absolute inset-0 z-10">
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Scanner frame */}
        {state === "scanning" || state === "starting" ? (
          <div className="relative z-20 aspect-square w-[75%] max-w-[300px]">
            {/* Clear center (no bg) */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <div
                className="absolute inset-0 bg-transparent"
                style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
              />
            </div>

            {/* Corner brackets */}
            <span className="absolute left-0 top-0 size-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-primary" />
            <span className="absolute right-0 top-0 size-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-primary" />
            <span className="absolute bottom-0 left-0 size-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-primary" />
            <span className="absolute bottom-0 right-0 size-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-primary" />

            {/* Scan line */}
            {state === "scanning" ? (
              <span className="animate-sweep absolute inset-x-4 top-1/2 h-0.5 rounded-full bg-primary/80 shadow-[0_0_8px_2px_oklch(0.32_0.12_254_/0.6)]" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-8 animate-spin text-primary" />
              </span>
            )}
          </div>
        ) : (
          /* Error state */
          <div className="relative z-20 mx-auto max-w-xs px-6 text-center text-white">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-white/10">
              <CameraOff className="size-8 opacity-80" />
            </div>
            <p className="text-base font-bold">
              {state === "unsupported" ? "Camera not available" : "Camera access blocked"}
            </p>
            <p className="mt-2 text-sm leading-relaxed opacity-70">
              {state === "unsupported"
                ? "This browser or device does not support camera access. Use the manual code entry instead."
                : "Allow camera access in your browser settings (tap the lock icon in address bar), then reload the page."}
            </p>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bg-black/80 px-4 pb-8 pt-4 backdrop-blur-sm">
        <p className="mb-3 text-center text-xs text-white/50">
          Align the document's QR code within the square frame
        </p>
        <Button
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="h-12 w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
