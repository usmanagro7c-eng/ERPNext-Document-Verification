import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractVerificationHash } from "@/lib/verification-hash";

export function ManualHashForm({ onSubmit }: { onSubmit: (hash: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const hash = extractVerificationHash(value);
        if (!hash) {
          setError("That doesn't look like a valid verification code.");
          return;
        }
        setError(null);
        onSubmit(hash);
      }}
    >
      <Input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="Paste verification code or URL..."
        autoComplete="off"
        spellCheck={false}
        className="h-11 rounded-xl font-mono text-sm"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="h-11 w-full gap-2 rounded-xl border-border/80 text-sm font-semibold hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      >
        <KeyRound className="size-4" />
        Verify Code
      </Button>
    </form>
  );
}
