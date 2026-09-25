import { Check, Copy, Eye, EyeOff, Clock, Files, Printer } from "lucide-react";
import { useState } from "react";
import { ChildTable } from "@/components/ChildTable";
import { DocumentField } from "@/components/DocumentField";
import { VerificationStatus } from "@/components/VerificationStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HIDDEN_FIELDS } from "@/config/verification";
import { maskHash } from "@/lib/verification-hash";
import type { DisplaySpec, VerificationResult, VerifiedDocument } from "@/types/verification";

function scalarEntries(document: VerifiedDocument, spec?: DisplaySpec) {
  const catalog = [...new Set(["doctype", "name", ...(spec?.fields ?? Object.keys(document))])];
  const seen = new Set<string>();
  const entries: [string, unknown][] = [];

  for (const key of catalog) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (HIDDEN_FIELDS.has(key)) continue;
    const value = document[key];
    if (Array.isArray(value) || value === undefined || value === null || value === "") continue;
    entries.push([key, value]);
  }
  return entries;
}

function childTables(document: VerifiedDocument, spec?: DisplaySpec) {
  return (Object.entries(spec?.childTables ?? {}) as [string, string[]][])
    .map(([field, subfields]) => ({ field, subfields, rows: document[field] }))
    .filter(({ rows }) => Array.isArray(rows));
}

export function VerificationCard({ result }: { result: VerificationResult }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const displayByDoctype = result.displayByDoctype ?? {};

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
                className="space-y-4 rounded-lg border border-border/70 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {document.doctype ?? "Document"} — {document.name ?? "—"}
                </p>
                <dl className="space-y-0">
                  {scalarEntries(document, displayByDoctype[document.doctype]).map(
                    ([key, value]) => (
                      <DocumentField key={key} name={key} value={value} />
                    ),
                  )}
                </dl>
                {childTables(document, displayByDoctype[document.doctype]).map((table) => (
                  <ChildTable key={table.field} {...table} />
                ))}
              </div>
            ))}
          </div>
        ) : documents.length === 1 ? (
          <div className="space-y-6">
            <dl className="space-y-0">
              {scalarEntries(documents[0]!, displayByDoctype[documents[0]!.doctype]).map(
                ([key, value]) => (
                  <DocumentField key={key} name={key} value={value} />
                ),
              )}
            </dl>
            {childTables(documents[0]!, displayByDoctype[documents[0]!.doctype]).map((table) => (
              <ChildTable key={table.field} {...table} />
            ))}
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
