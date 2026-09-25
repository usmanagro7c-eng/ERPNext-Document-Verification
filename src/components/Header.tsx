import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="size-5" />
        </span>
        <Link to="/" className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Document Verification</span>
          <span className="block text-xs text-muted-foreground">Official verification portal</span>
        </Link>
      </div>
    </header>
  );
}
