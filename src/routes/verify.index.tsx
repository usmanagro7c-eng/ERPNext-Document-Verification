import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Home, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { VerifyView } from "@/components/VerifyView";

export const Route = createFileRoute("/verify/")({
  validateSearch: (search: Record<string, unknown>) => ({
    hash: typeof search["hash"] === "string" ? (search["hash"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verification Result — Document Verification Portal" },
      {
        name: "description",
        content: "Verification result for a document checked against official records.",
      },
      { property: "og:title", content: "Verification Result" },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: VerifyByQuery,
});

function VerifyByQuery() {
  const { hash } = Route.useSearch();
  return (
    <div className="page-bg min-h-screen bg-background flex flex-col justify-between">
      <div>
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
          <div className="mb-5 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-xs backdrop-blur-xs transition-all hover:bg-card hover:text-foreground hover:shadow-sm"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Portal</span>
            </Link>

            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              <span>Authenticity Record</span>
            </div>
          </div>

          <VerifyView hash={hash} />
        </main>
      </div>

      <footer className="border-t border-border/60 bg-card/40 py-4 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 text-[11px]">
          <span>Official ERPNext Verification Service</span>
          <Link to="/" className="inline-flex items-center gap-1 hover:text-foreground">
            <Home className="size-3" />
            <span>Home</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
