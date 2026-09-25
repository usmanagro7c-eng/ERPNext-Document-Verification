import {
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  Files,
  Lock,
  Printer,
  RotateCcw,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
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
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const copyHash = async () => {
    try {
      await navigator.clipboard.writeText(result.hash);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ERPNext Document Verification",
          text: `Verified authenticity for document ${documents[0]?.name ?? ""}`,
          url: window.location.href,
        });
        return;
      } catch {
        /* fallback to copy */
      }
    }
    await copyLink();
  };

  // Get primary summary highlights if available
  const primaryDoc = documents[0];
  const grandTotal = primaryDoc?.grand_total ?? primaryDoc?.total ?? primaryDoc?.rounded_total;
  const currency = primaryDoc?.currency ?? "";

  return (
    <div className="animate-rise space-y-5">
      {/* Status banner */}
      <VerificationStatus verified={result.verified} />

      {/* Document summary overview ribbon (if verified single doc) */}
      {result.verified && primaryDoc && (
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-primary/5 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary uppercase">
                  {primaryDoc.doctype ?? "Document"}
                </span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {primaryDoc.name ?? "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cryptographically validated against ERPNext Database
              </p>
            </div>

            {grandTotal !== undefined && grandTotal !== null && (
              <div className="flex flex-col sm:items-end">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Document Total
                </span>
                <span className="text-xl font-extrabold font-mono text-foreground sm:text-2xl">
                  {currency ? `${currency} ` : ""}
                  {Number(grandTotal).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Details Card */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileCheck className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Verified Document Details</h3>
          </div>
          {multi && (
            <Badge variant="secondary" className="gap-1 rounded-lg text-xs font-semibold">
              <Files className="size-3" />
              {documents.length} Records
            </Badge>
          )}
        </div>

        <div className="p-5 sm:p-6">
          {multi ? (
            <div className="space-y-6">
              {documents.map((doc, idx) => (
                <div
                  key={doc.name ?? JSON.stringify(doc)}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-5 shadow-xs"
                >
                  <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary uppercase">
                      {doc.doctype ?? "Document"} #{idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-foreground">
                      {doc.name ?? "—"}
                    </span>
                  </div>

                  <dl className="divide-y divide-border/40">
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
            <div className="space-y-2">
              <dl className="divide-y divide-border/40">
                {scalarEntries(documents[0]!, displayByDoctype[documents[0]!.doctype]).map(
                  ([k, v]) => (
                    <DocumentField key={k} name={k} value={v} />
                  ),
                )}
              </dl>

              {childTables(documents[0]!, displayByDoctype[documents[0]!.doctype]).map((t) => (
                <ChildTable key={t.field} {...t} />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {result.message ?? "No document details were provided for this code."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Verification Record & Audit Trail */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Security Audit Trail</h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-[10px] font-bold text-success">
            <ShieldCheck className="size-3" />
            256-bit Secure
          </span>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Verification Hash
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 p-2.5">
              <code className="min-w-0 flex-1 break-all font-mono text-xs font-medium text-foreground px-1">
                {revealed ? result.hash : maskHash(result.hash)}
              </code>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setRevealed((v) => !v)}
                  title={revealed ? "Hide code" : "Reveal full code"}
                >
                  {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => void copyHash()}
                  title="Copy hash"
                >
                  {copiedHash ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary shrink-0" />
              <span>
                Verified on{" "}
                <strong className="text-foreground font-medium">
                  {new Date(result.verifiedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </strong>{" "}
                at {new Date(result.verifiedAt).toLocaleTimeString()}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/80">ERPNext Gateway Validation</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          className="h-11 gap-2 rounded-xl border-border/80 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
          onClick={() => void copyLink()}
        >
          {copiedLink ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
          <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
        </Button>

        <Button
          variant="outline"
          className="h-11 gap-2 rounded-xl border-border/80 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          <span>Print / PDF</span>
        </Button>

        <Button
          variant="outline"
          className="col-span-2 sm:col-span-1 h-11 gap-2 rounded-xl border-border/80 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
          onClick={() => void handleShare()}
        >
          <Share2 className="size-4" />
          <span>Share</span>
        </Button>
      </div>

      {/* Quick link back */}
      <div className="text-center pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <RotateCcw className="size-3.5" />
          <span>Verify another document</span>
        </Link>
      </div>
    </div>
  );
}
