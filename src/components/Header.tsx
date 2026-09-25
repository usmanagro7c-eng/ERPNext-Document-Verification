import { Link } from "@tanstack/react-router";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-card/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="relative flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
            <ShieldCheck className="size-5 text-primary-foreground" />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
          </div>

          <div className="leading-snug">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold tracking-tight text-foreground sm:text-[15px]">
                ERPNext Verification
              </p>
              <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:inline-block">
                Portal
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">Official Document Authenticator</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:flex">
            <span className="size-1.5 rounded-full bg-success animate-pulse" />
            <span>Secure 256-bit Gate</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="size-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="size-4.5 text-warning transition-transform hover:rotate-45" />
            ) : (
              <Moon className="size-4.5 transition-transform hover:-rotate-12" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
