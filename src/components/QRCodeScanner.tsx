import { CameraOff, Loader2, X } from "lucide-react";
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
    <div className="animate-rise fixed inset-0 z-50 flex flex-col bg-foreground/95 text-background">
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <p className="text-base font-semibold">Scan QR Code</p>
          <p className="text-xs opacity-75">Position the QR code inside the frame</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Cancel scanning"
          className="text-background hover:bg-background/15 hover:text-background"
        >
          <X className="size-5" />
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
        />

        {state === "scanning" || state === "starting" ? (
          <div className="relative z-10 aspect-square w-[78%] max-w-sm">
            <div className="absolute inset-0 rounded-2xl border-2 border-background/25" />
            <span className="absolute left-0 top-0 size-10 rounded-tl-2xl border-l-4 border-t-4 border-background" />
            <span className="absolute right-0 top-0 size-10 rounded-tr-2xl border-r-4 border-t-4 border-background" />
            <span className="absolute bottom-0 left-0 size-10 rounded-bl-2xl border-b-4 border-l-4 border-background" />
            <span className="absolute bottom-0 right-0 size-10 rounded-br-2xl border-b-4 border-r-4 border-background" />
            {state === "scanning" ? (
              <span className="animate-sweep absolute inset-x-6 top-1/2 h-0.5 bg-background/80" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-7 animate-spin" />
              </span>
            )}
          </div>
        ) : (
          <div className="relative z-10 mx-auto max-w-sm px-6 text-center">
            <CameraOff className="mx-auto size-10 opacity-80" />
            <p className="mt-4 text-base font-semibold">
              {state === "unsupported" ? "Camera not available" : "Camera access is blocked"}
            </p>
            <p className="mt-2 text-sm opacity-80">
              {state === "unsupported"
                ? "This browser or device does not expose a camera. Enter the verification code manually instead."
                : "Allow camera access in your browser settings (tap the lock or camera icon in the address bar), then reload this page."}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4 text-center">
        <p className="text-xs opacity-75">Align the QR code inside the square</p>
        <Button
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="w-full border-background/40 bg-transparent text-background hover:bg-background/15 hover:text-background"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
