import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Send,
  ShieldQuestion,
} from "lucide-react";
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
import { ALLOWED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_BYTES } from "@/lib/report-schema";
import { submitReportQuery } from "@/services/reportService";
import type { ReportQueryField } from "@/types/report";

const ACCEPT = `${ALLOWED_ATTACHMENT_EXTENSIONS.join(",")},application/pdf,image/jpeg,image/png`;

const FIELD_LABEL: Record<ReportQueryField, string> = {
  name: "Name",
  email: "Email",
  mobile: "Mobile",
  attachment: "Attachment",
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function ReportQueryDialog({
  open,
  onOpenChange,
  hash,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hash: string;
  reason: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    field?: ReportQueryField | undefined;
  } | null>(null);
  const [success, setSuccess] = useState<{
    attachmentFailed: boolean;
  } | null>(null);

  /** When the form became visible — used to reject instant submissions. */
  const renderedAtRef = useRef(0);

  const reset = useCallback(() => {
    setName("");
    setEmail("");
    setMobile("");
    setFile(null);
    setWebsite("");
    setSubmitting(false);
    setFailure(null);
    setSuccess(null);
  }, []);

  // Stamp the render time every time the dialog opens, and clear stale state.
  useEffect(() => {
    if (!open) return;
    renderedAtRef.current = Date.now();
    setFailure(null);
    setSuccess(null);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    // Reject an oversized or unsupported file before reading it into memory.
    if (file) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setFailure({ message: "The file must be 4 MB or smaller.", field: "attachment" });
        return;
      }
      const allowed = ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      );
      if (!allowed) {
        setFailure({ message: "Only PDF, JPG and PNG files are accepted.", field: "attachment" });
        return;
      }
    }

    setSubmitting(true);
    setFailure(null);

    let attachment = null;
    if (file) {
      try {
        attachment = {
          base64: await readFileAsBase64(file),
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        };
      } catch {
        setSubmitting(false);
        setFailure({ message: "The file could not be read.", field: "attachment" });
        return;
      }
    }

    const result = await submitReportQuery({
      name,
      email,
      mobile,
      hash,
      reason,
      pageUrl: typeof window === "undefined" ? undefined : window.location.href,
      website,
      // Measured on this device's clock only, so it is comparable with itself.
      fillMs: Date.now() - renderedAtRef.current,
      attachment,
    });

    setSubmitting(false);
    if (result.ok) {
      setSuccess({ attachmentFailed: Boolean(result.attachmentFailed) });
    } else {
      setFailure({ message: result.message, field: result.field });
    }
  };

  const errorFor = (field: ReportQueryField) =>
    failure?.field === field ? failure.message : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {success ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success-muted text-success ring-4 ring-success/10">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-bold text-foreground">
                Query received
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Thank you. Our team will look into this code and contact you shortly.
              </DialogDescription>
            </div>
            {success.attachmentFailed && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-muted px-3 py-2 text-left text-[11px] font-medium text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Your details were saved, but the attachment could not be stored. Please resend it
                  by email if it is important.
                </span>
              </p>
            )}
            <Button
              className="h-11 w-full gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="min-w-0 space-y-4">
            {/* min-w-0 on this grid item lets the DialogContent column shrink
                below its max-content width. Without it the verification hash in
                the footer row sizes the column and the dialog overflows on
                every phone. */}
            <DialogHeader className="space-y-1.5">
              <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldQuestion className="size-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Report a Query
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                Tell us about this code and we will investigate it with our records team.
              </DialogDescription>
            </DialogHeader>

            {/* Honeypot: hidden from sight, keyboard and screen readers. */}
            <div
              aria-hidden="true"
              className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
            >
              <label htmlFor="report-website">Website</label>
              <input
                id="report-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-name" className="text-xs font-semibold text-foreground">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="report-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (failure) setFailure(null);
                }}
                placeholder="Your full name"
                autoComplete="name"
                aria-invalid={Boolean(errorFor("name"))}
                aria-describedby={errorFor("name") ? "report-name-error" : undefined}
                className="h-11 rounded-xl text-sm shadow-inner"
              />
              {errorFor("name") && (
                <p id="report-name-error" className="text-[11px] font-medium text-destructive">
                  {errorFor("name")}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-email" className="text-xs font-semibold text-foreground">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="report-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (failure) setFailure(null);
                }}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={Boolean(errorFor("email"))}
                aria-describedby={errorFor("email") ? "report-email-error" : undefined}
                className="h-11 rounded-xl text-sm shadow-inner"
              />
              {errorFor("email") && (
                <p id="report-email-error" className="text-[11px] font-medium text-destructive">
                  {errorFor("email")}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-mobile" className="text-xs font-semibold text-foreground">
                Mobile <span className="text-destructive">*</span>
              </Label>
              <Input
                id="report-mobile"
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  if (failure) setFailure(null);
                }}
                placeholder="+92 300 1234567"
                autoComplete="tel"
                aria-invalid={Boolean(errorFor("mobile"))}
                aria-describedby={errorFor("mobile") ? "report-mobile-error" : undefined}
                className="h-11 rounded-xl text-sm shadow-inner"
              />
              {errorFor("mobile") && (
                <p id="report-mobile-error" className="text-[11px] font-medium text-destructive">
                  {errorFor("mobile")}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report-file" className="text-xs font-semibold text-foreground">
                Attachment <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="report-file"
                type="file"
                accept={ACCEPT}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  if (failure) setFailure(null);
                }}
                aria-invalid={Boolean(errorFor("attachment"))}
                className="h-11 rounded-xl bg-muted/30 py-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-foreground"
              />
              <p className="text-[11px] text-muted-foreground">
                PDF, JPG or PNG, up to 4 MB. A photo of the document is fine.
              </p>
              {errorFor("attachment") && (
                <p className="text-[11px] font-medium text-destructive">{errorFor("attachment")}</p>
              )}
            </div>

            {failure && !failure.field && (
              <p className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive-muted px-3 py-2.5 text-[11px] font-medium text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{failure.message}</span>
              </p>
            )}

            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <FileText className="size-3.5 shrink-0" />
              {/* min-w-0 is required for truncate inside a flex row: without it the
                  flex item keeps its content width, and the verification hash
                  stretches the dialog past the viewport on phones. */}
              <span className="min-w-0 flex-1 truncate font-mono">
                Code under review: {hash || "(none)"}
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

            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground/80">
              <Paperclip className="mt-0.5 size-3 shrink-0" />
              <span>
                We only use these details to investigate your query. Fields marked{" "}
                {FIELD_LABEL.name}, {FIELD_LABEL.email} and {FIELD_LABEL.mobile} are required.
              </span>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
