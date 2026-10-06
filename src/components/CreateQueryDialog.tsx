import { CheckCircle2, FileText, Loader2, Send, ShieldQuestion } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { doctypeLabel } from "@/config/verification";
import { submitCreateQuery } from "@/services/queryService";
import type { VerifiedDocument } from "@/types/verification";

/** Display value for the party the document was issued to. */
export function documentParty(document: VerifiedDocument): string {
  for (const field of ["customer", "customer_name", "party_name", "supplier"]) {
    const value = document[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function CreateQueryDialog({
  open,
  onOpenChange,
  hash,
  document,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hash: string;
  document: VerifiedDocument;
}) {
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [issueName, setIssueName] = useState<string | null>(null);

  const party = documentParty(document);

  /** When the form became visible — used to reject instant submissions. */
  const renderedAtRef = useRef(0);

  const reset = useCallback(() => {
    setDescription("");
    setWebsite("");
    setSubmitting(false);
    setFailure(null);
    setIssueName(null);
  }, []);

  // Stamp the render time every time the dialog opens, and clear stale state.
  useEffect(() => {
    if (!open) return;
    renderedAtRef.current = Date.now();
    setFailure(null);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFailure(null);

    const result = await submitCreateQuery({
      hash,
      siteId: document.siteId,
      doctype: document.doctype,
      docname: String(document.name ?? ""),
      customer: party || undefined,
      description,
      pageUrl: typeof window === "undefined" ? undefined : window.location.href,
      website,
      // Measured on this device's clock only, so it is comparable with itself.
      fillMs: Date.now() - renderedAtRef.current,
    });

    setSubmitting(false);
    if (result.ok) {
      setIssueName(result.issueName);
    } else {
      setFailure(result.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {issueName ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success-muted text-success ring-4 ring-success/10">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-bold text-foreground">
                Query received
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Your query has been logged as{" "}
                <span className="font-mono font-semibold text-foreground">{issueName}</span>. Our
                support team will get back to you shortly.
              </DialogDescription>
            </div>
            <Button
              className="h-11 w-full gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="min-w-0 space-y-4">
            <DialogHeader className="space-y-1.5">
              <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldQuestion className="size-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">Raise a Query</DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                Ask the issuing team anything about this verified document.
              </DialogDescription>
            </DialogHeader>

            {/* Honeypot: hidden from sight, keyboard and screen readers. */}
            <div
              aria-hidden="true"
              className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
            >
              <label htmlFor="query-website">Website</label>
              <input
                id="query-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Document</Label>
                <div className="flex h-11 min-w-0 items-center rounded-xl border border-border/60 bg-muted/30 px-3 text-xs">
                  <span className="min-w-0 truncate font-mono font-semibold text-foreground">
                    {doctypeLabel(document.doctype)} · {String(document.name ?? "—")}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="query-customer" className="text-xs font-semibold text-foreground">
                  Customer
                </Label>
                <Input
                  id="query-customer"
                  value={party || "—"}
                  readOnly
                  disabled
                  className="h-11 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="query-description" className="text-xs font-semibold text-foreground">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="query-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (failure) setFailure(null);
                }}
                placeholder="Describe your query about this document..."
                rows={5}
                aria-invalid={Boolean(failure)}
                className="rounded-xl text-sm shadow-inner"
              />
              {failure && <p className="text-[11px] font-medium text-destructive">{failure}</p>}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate font-mono">
                Verification code: {hash || "(none)"}
              </span>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit Query
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
