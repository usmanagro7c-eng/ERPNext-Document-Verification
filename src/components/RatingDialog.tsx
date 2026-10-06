import { CheckCircle2, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveRating } from "@/lib/rating";

const STAR_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"] as const;

/**
 * Post-verification rating popup. Local-only for now: the choice is stored in
 * localStorage (see lib/rating.ts) so the popup appears once per document.
 */
export function RatingDialog({
  open,
  onOpenChange,
  hash,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hash: string;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  // Clear stale state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setRating(0);
    setHovered(0);
    setComment("");
    setDone(false);
  }, [open]);

  const active = hovered || rating;

  const close = (next: boolean) => {
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!rating) return;
    saveRating(hash, rating, comment.trim());
    setDone(true);
  };

  const handleSkip = () => {
    saveRating(hash, null, "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        {done ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success-muted text-success ring-4 ring-success/10">
              <CheckCircle2 className="size-7" />
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-lg font-bold text-foreground">Thank you!</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                Your feedback helps us keep the verification service reliable.
              </DialogDescription>
            </div>
            <Button
              className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-1.5 text-center">
              <DialogTitle className="text-lg font-bold text-foreground">
                Rate your experience
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
                How easy was it to verify this document?
              </DialogDescription>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    onClick={() => setRating(value)}
                    onMouseEnter={() => setHovered(value)}
                    onMouseLeave={() => setHovered(0)}
                    className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Star
                      className={cn(
                        "size-8 transition-colors",
                        value <= active
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted-foreground/40",
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className="h-4 text-xs font-medium text-muted-foreground">
                {active ? STAR_LABELS[active - 1] : ""}
              </p>
            </div>

            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything we could improve? (optional)"
              rows={3}
              className="rounded-xl text-sm shadow-inner"
            />

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="h-11 flex-1 rounded-xl text-sm font-semibold text-muted-foreground"
              >
                Skip
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!rating}
                className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                Submit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
