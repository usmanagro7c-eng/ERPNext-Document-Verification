import { KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Label htmlFor="verification-code" className="text-sm font-medium">
        Enter Verification Code Manually
      </Label>
      <Input
        id="verification-code"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="Paste the code or verification link"
        autoComplete="off"
        spellCheck={false}
        className="h-12 font-mono text-sm"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="outline" size="lg" className="w-full">
        <KeyRound className="size-4" />
        Verify Code
      </Button>
    </form>
  );
}
