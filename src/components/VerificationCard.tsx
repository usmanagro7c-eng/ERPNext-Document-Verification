import { Check, Copy, Eye, EyeOff, Clock, Files, Printer } from "lucide-react";
import { useState } from "react";
import { DocumentField } from "@/components/DocumentField";
import { VerificationStatus } from "@/components/VerificationStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HIDDEN_FIELDS, PRIMARY_FIELDS } from "@/config/verification";
import { maskHash } from "@/lib/verification-hash";
import type { VerificationResult, VerifiedDocument } from "@/types/verification";

function orderedEntries(document: VerifiedDocument) {
  const keys = Object.keys(document).filter((k) => !HIDDEN_FIELDS.has(k));
  const primary = PRIMARY_FIELDS.filter((k) => keys.includes(k));
  const rest = keys.filter((k) => !primary.includes(k)).sort((a, b) => a.localeCompare(b));
  return [...primary, ...rest].map((key) => [key, document[key]] as const);
}

export function VerificationCard({ result }: { result: VerificationResult }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const documents = result.documents?.length
    ? result.documents
    : result.document
      ? [result.document]
      : [];
  const multi = documents.length > 1;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — leave silently.
    }
  };

  return (
    <Card className="animate-rise overflow-hidden shadow-elevated">
      <CardContent className="space-y-6 p-4 sm:p-6">
        <VerificationStatus verified={result.verified} />

        {multi ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Files className="size-3.5" />
                Multiple Documents
              </Badge>
              <span className="text-xs text-muted-foreground">
                {documents.length} registered documents share this verification code.
              </span>
            </div>
            {documents.map((document) => (
              <div
                key={document.name ?? JSON.stringify(document)}
                className="rounded-lg border border-border/70 p-4"
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {document.doctype ?? "Document"} — {document.name ?? "—"}
                </p>
                <dl>
                  {orderedEntries(document).map(([key, value]) => (
                    <DocumentField key={key} name={key} value={value} />
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : documents.length === 1 ? (
          <div className="space-y-6">
            <dl>
              {orderedEntries(documents[0]!).map(([key, value]) => (
                <DocumentField key={key} name={key} value={value} />
              ))}
            </dl>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {result.message ?? "No document details were provided for this verification."}
          </p>
        )}

        <div className="space-y-3 rounded-lg bg-muted/60 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Verification Code
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="break-all font-mono text-sm">
                {revealed ? result.hash : maskHash(result.hash)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRevealed((v) => !v)}
                aria-label={
                  revealed ? "Hide full verification code" : "Show full verification code"
                }
              >
                {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            Verified at {new Date(result.verifiedAt).toLocaleString()}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="sm:flex-1" onClick={copyLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Link Copied" : "Copy Result Link"}
          </Button>
          <Button variant="outline" className="sm:flex-1" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print / Save PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
