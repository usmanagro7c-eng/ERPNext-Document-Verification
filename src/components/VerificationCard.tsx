import { Check, Clock, Copy, Eye, EyeOff, Files, Printer } from "lucide-react";
import { useState } from "react";
import { ChildTable } from "@/components/ChildTable";
import { DocumentField } from "@/components/DocumentField";
import { VerificationStatus } from "@/components/VerificationStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    .filter((table): table is { field: string; subfields: string[]; rows: unknown[] } =>
      Array.isArray(table.rows),
    );
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
      /* ignore */
    }
  };

  return (
    <div className="animate-rise space-y-4">
      {/* Status banner */}
      <VerificationStatus verified={result.verified} />

      {/* Document details */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3">
          <p className="text-[13px] font-semibold text-foreground">Document Details</p>
          {multi && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Files className="size-3" />
              {documents.length} documents
            </Badge>
          )}
        </div>

        <div className="p-5">
          {multi ? (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div
                  key={doc.name ?? JSON.stringify(doc)}
                  className="rounded-xl border border-border/60 bg-muted/30 p-4"
                >
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {doc.doctype ?? "Document"} — {doc.name ?? "—"}
                  </p>
                  <dl>
                    {scalarEntries(doc, displayByDoctype[doc.doctype]).map(([k, v]) => (
                      <DocumentField key={k} name={k} value={v} />
                    ))}
                  </dl>
                  {childTables(doc, displayByDoctype[doc.doctype]).map((t) => (
                    <ChildTable key={t.field} {...t} />
                  ))}
                </div>
              ))}
            </div>
          ) : documents.length === 1 ? (
            <dl className="divide-y divide-border/50">
              {scalarEntries(documents[0]!, displayByDoctype[documents[0]!.doctype]).map(
                ([k, v]) => (
                  <DocumentField key={k} name={k} value={v} />
                ),
              )}
              {childTables(documents[0]!, displayByDoctype[documents[0]!.doctype]).map((t) => (
                <ChildTable key={t.field} {...t} />
              ))}
            </dl>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {result.message ?? "No document details were provided."}
            </p>
          )}
        </div>
      </div>

      {/* Verification code */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border/70 bg-muted/40 px-5 py-3">
          <p className="text-[13px] font-semibold text-foreground">Verification Record</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-foreground">
              {revealed ? result.hash : maskHash(result.hash)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide code" : "Show code"}
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            Verified at {new Date(result.verifiedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-xl border-border/80 text-sm hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          onClick={copyLink}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-xl border-border/80 text-sm hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          Print / PDF
        </Button>
      </div>
    </div>
  );
}
