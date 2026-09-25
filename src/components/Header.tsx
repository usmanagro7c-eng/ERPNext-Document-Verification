import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border/70 bg-card/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3.5">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary shadow-md">
            <ShieldCheck className="size-[18px] text-primary-foreground" />
          </span>
          <div className="leading-snug">
            <p className="text-[13px] font-bold tracking-tight text-foreground">
              Document Verification
            </p>
            <p className="text-[11px] text-muted-foreground">ERPNext Official Portal</p>
          </div>
        </Link>
      </div>
    </header>
  );
}
