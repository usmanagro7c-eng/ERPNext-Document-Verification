import { ClipboardPaste, KeyRound, Loader2, ScanLine, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractVerificationHash } from "@/lib/verification-hash";

interface ManualHashFormProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (hash: string) => void;
  /** True while a scanned hash is being shown before auto-verification. */
  pendingVerify?: boolean;
}

export function ManualHashForm({
  value,
  onValueChange,
  onSubmit,
  pendingVerify = false,
}: ManualHashFormProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (raw: string) => {
    if (pendingVerify) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      setError("Please enter a verification code or link.");
      return;
    }
    const hash = extractVerificationHash(trimmed);
    if (!hash) {
      setError("Invalid code format. Please check the code or link and try again.");
      return;
    }
    setError(null);
    onSubmit(hash);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onValueChange(text.trim());
        setError(null);
      }
    } catch {
      setError("Clipboard access denied. Please paste manually into the input box.");
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(value);
      }}
    >
      <div
        className={`relative flex items-center rounded-xl ${pendingVerify ? "animate-paste-pop" : ""}`}
      >
        <Input
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste code or verification URL..."
          autoComplete="off"
          spellCheck={false}
          readOnly={pendingVerify}
          autoFocus
          aria-label="Verification code"
          className="h-12 rounded-xl pr-20 font-mono text-sm shadow-inner transition-all focus-visible:ring-2 focus-visible:ring-primary/40"
        />

        {!pendingVerify && (
          <div className="absolute right-1.5 flex items-center gap-1">
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onValueChange("");
                  setError(null);
                }}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear input"
              >
                <X className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handlePaste()}
                className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Paste from clipboard"
              >
                <ClipboardPaste className="size-3.5" />
                <span>Paste</span>
              </button>
            )}
          </div>
        )}
      </div>

      {pendingVerify && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-xs font-semibold text-primary animate-fade-in"
        >
          <span className="relative flex size-4 shrink-0 items-center justify-center">
            <ScanLine className="size-4" />
            <Loader2 className="absolute size-4 animate-spin" />
          </span>
          <span>Code captured — verifying automatically…</span>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-destructive-muted px-3 py-1.5 text-xs font-medium text-destructive animate-fade-in">
          <span>⚠</span>
          <span>{error}</span>
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={pendingVerify}
        className="h-11 w-full gap-2 rounded-xl bg-secondary text-secondary-foreground font-semibold shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md"
      >
        {pendingVerify ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            <KeyRound className="size-4" />
            Verify Code
          </>
        )}
      </Button>

      {!pendingVerify && (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>Accepts 32/64 char hashes or full verify URLs</span>
        </div>
      )}
    </form>
  );
}
