import {
  CameraOff,
  Flashlight,
  FlashlightOff,
  Image as ImageIcon,
  Loader2,
  ScanLine,
  SwitchCamera,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { extractVerificationHash } from "@/lib/verification-hash";

import type QrScanner from "qr-scanner";

type ScannerState = "starting" | "scanning" | "denied" | "unsupported";

interface QRCodeScannerProps {
  onResult: (hash: string) => void;
  onInvalid?: (content: string) => void;
  onCancel: () => void;
}

export function QRCodeScanner({ onResult, onInvalid, onCancel }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const handledRef = useRef(false);

  const [state, setState] = useState<ScannerState>("starting");
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
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

        const availCameras = await QrScanner.listCameras(true);
        if (!cancelled && availCameras.length > 1) {
          setCameras(availCameras);
        }

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
            maxScansPerSecond: 6,
          },
        );
        scannerRef.current = instance;

        await instance.start();

        if (!cancelled) {
          setState("scanning");
          const flashAvailable = await instance.hasFlash();
          setHasFlash(flashAvailable);
        }
      } catch {
        if (!cancelled) setState("denied");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, [onResult, onInvalid]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasFlash) return;
    try {
      await scannerRef.current.toggleFlash();
      const isFlash = scannerRef.current.isFlashOn();
      setFlashOn(isFlash);
    } catch {
      /* ignore */
    }
  };

  const switchCamera = async () => {
    const scanner = scannerRef.current;
    const nextIdx = (currentCameraIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIdx];
    if (!scanner || !nextCamera || cameras.length <= 1) return;
    setCurrentCameraIndex(nextIdx);
    try {
      await scanner.setCamera(nextCamera.id);
      const flashAvailable = await scanner.hasFlash();
      setHasFlash(flashAvailable);
      setFlashOn(false);
    } catch {
      /* ignore */
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageProcessing(true);
    setUploadError(null);

    try {
      const { default: QrScanner } = await import("qr-scanner");
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      if (result?.data) {
        const hash = extractVerificationHash(result.data);
        if (hash) {
          handledRef.current = true;
          if (scannerRef.current) scannerRef.current.stop();
          onResult(hash);
          return;
        } else {
          onInvalid?.(result.data);
          return;
        }
      }
      setUploadError("No QR code detected in this image. Try another photo.");
    } catch {
      setUploadError(
        "Could not read a QR code from this image. Please ensure good lighting and focus.",
      );
    } finally {
      setImageProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white animate-fade-in">
      {/* Top Header */}
      <div className="relative z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <ScanLine className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Scan QR Code</p>
            <p className="text-[11px] text-slate-400">
              {state === "scanning"
                ? "Align document code inside frame"
                : state === "starting"
                  ? "Starting camera feed..."
                  : "Camera offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {hasFlash && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void toggleTorch()}
              aria-label="Toggle flashlight"
              className="size-9 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
            >
              {flashOn ? (
                <Flashlight className="size-4.5 text-amber-400" />
              ) : (
                <FlashlightOff className="size-4.5" />
              )}
            </Button>
          )}

          {cameras.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void switchCamera()}
              aria-label="Switch camera"
              className="size-9 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
            >
              <SwitchCamera className="size-4.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Close scanner"
            className="size-9 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-slate-950">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          playsInline
          muted
        />

        {/* Backdrop vignette */}
        <div className="absolute inset-0 bg-slate-950/40 pointer-events-none" />

        {/* Viewfinder Target */}
        {state === "scanning" || state === "starting" ? (
          <div className="relative z-20 aspect-square w-[80%] max-w-[280px] sm:max-w-[320px]">
            {/* Cutout glow */}
            <div
              className="absolute -inset-1 rounded-3xl opacity-75 blur-sm"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(16, 185, 129, 0.4))",
              }}
            />

            {/* Viewfinder Frame */}
            <div className="relative size-full rounded-2xl border-2 border-white/20 bg-slate-950/10 shadow-2xl backdrop-blur-[1px]">
              {/* Corner brackets */}
              <span className="absolute -left-1 -top-1 size-8 rounded-tl-xl border-l-4 border-t-4 border-primary shadow-sm" />
              <span className="absolute -right-1 -top-1 size-8 rounded-tr-xl border-r-4 border-t-4 border-primary shadow-sm" />
              <span className="absolute -bottom-1 -left-1 size-8 rounded-bl-xl border-b-4 border-l-4 border-primary shadow-sm" />
              <span className="absolute -bottom-1 -right-1 size-8 rounded-br-xl border-b-4 border-r-4 border-primary shadow-sm" />

              {/* Scanning Laser Beam */}
              {state === "scanning" ? (
                <div className="animate-sweep absolute inset-x-2 top-1/2 flex items-center justify-center">
                  <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_3px_rgba(59,130,246,0.8)]" />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/40">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <span className="text-xs text-slate-300">Initializing camera...</span>
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-xs font-medium tracking-wide text-white/80 drop-shadow">
              Hold steady over document QR code
            </p>
          </div>
        ) : (
          /* Error / Blocked camera state */
          <div className="relative z-20 mx-auto max-w-sm px-6 text-center text-white">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md">
              <CameraOff className="size-8 text-rose-400" />
            </div>
            <p className="text-base font-bold">
              {state === "unsupported" ? "Camera not supported" : "Camera access required"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {state === "unsupported"
                ? "This browser does not support live camera access. You can upload an image of the QR code below instead."
                : "Camera permission was denied. Please allow camera permissions in browser settings, or upload an image file of the code."}
            </p>
          </div>
        )}

        {/* Upload error banner if any */}
        {uploadError && (
          <div className="absolute top-4 inset-x-4 z-40 mx-auto max-w-sm rounded-xl bg-destructive/90 px-4 py-2.5 text-center text-xs font-medium text-white shadow-lg backdrop-blur-md animate-rise">
            {uploadError}
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="relative z-30 border-t border-white/10 bg-slate-950/90 px-4 py-4 backdrop-blur-md">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFileUpload(e)}
        />

        <div className="mx-auto flex max-w-md items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={imageProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="h-11 flex-1 gap-2 rounded-xl border-white/20 bg-white/10 text-white font-medium hover:bg-white/15 hover:text-white"
          >
            {imageProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Reading image...
              </>
            ) : (
              <>
                <ImageIcon className="size-4 text-emerald-400" />
                Upload QR Image
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="h-11 px-5 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
