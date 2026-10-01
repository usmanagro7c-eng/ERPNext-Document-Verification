import { Link } from "@tanstack/react-router";
import { FileCheck, Files, RotateCcw } from "lucide-react";
import { useCompanyName } from "@/components/CompanyProvider";
import { ChildTable } from "@/components/ChildTable";
import { DocumentField } from "@/components/DocumentField";
import { VerificationStatus } from "@/components/VerificationStatus";
import { Badge } from "@/components/ui/badge";
import { doctypeLabel, HIDDEN_FIELDS } from "@/config/verification";
import type { DisplaySpec, VerificationResult, VerifiedDocument } from "@/types/verification";

function scalarEntries(document: VerifiedDocument, spec?: DisplaySpec) {
  const catalog = [...new Set(["doctype", "name", ...(spec?.fields ?? Object.keys(document))])];
  const seen = new Set<string>();
  const entries: [string, unknown][] = [];
  for (const key of catalog) {
    if (seen.has(key)) continue;
    seen.add(key);
    if (HIDDEN_FIELDS.has(key)) continue;
    // The details table lists doctype too, so the raw ERP name would surface
    // here even after the summary chip was renamed.
    const value = key === "doctype" ? doctypeLabel(document.doctype) : document[key];
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
  const { brand: contextBrand } = useCompanyName();
  // The issuer comes from the result, not from whichever site is configured
  // first: with several sites, only the site that answered knows who issued it.
  const brand = result.brandName ?? contextBrand;
  const displayByDoctype = result.displayByDoctype ?? {};

  const documents = result.documents?.length
    ? result.documents
    : result.document
      ? [result.document]
      : [];
  const multi = documents.length > 1;

  // Get primary summary highlights if available
  const primaryDoc = documents[0];
  const grandTotal =
    primaryDoc?.["grand_total"] ?? primaryDoc?.["total"] ?? primaryDoc?.["rounded_total"];
  const currency = primaryDoc?.["currency"] ?? "";

  return (
    <div className="animate-rise space-y-5">
      {/* Status banner */}
      <VerificationStatus verified={result.verified} brand={brand} />

      {/* Document summary overview ribbon (if verified single doc) */}
      {result.verified && primaryDoc && (
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-primary/5 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary uppercase">
                  {doctypeLabel(primaryDoc.doctype)}
                </span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {primaryDoc.name ?? "—"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cryptographically validated against {brand} records
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
                  // Two sites can use the same naming series, so the document
                  // name alone is not unique across the result set.
                  key={`${doc.siteId ?? "?"}:${doc.name ?? JSON.stringify(doc)}`}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-5 shadow-xs"
                >
                  <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary uppercase">
                        {doctypeLabel(doc.doctype)} #{idx + 1}
                      </span>
                      {doc.sourceName && (
                        <span className="rounded-lg border border-border/70 bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          {doc.sourceName}
                        </span>
                      )}
                    </div>
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
