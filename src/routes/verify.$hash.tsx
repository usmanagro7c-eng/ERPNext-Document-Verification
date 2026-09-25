import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { VerifyView } from "@/components/VerifyView";

export const Route = createFileRoute("/verify/$hash")({
  head: () => ({
    meta: [
      { title: "Verification Result — Document Verification" },
      { name: "description", content: "Document verification result." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyByPath,
  errorComponent: () => (
    <VerifyShell>
      <VerifyView hash={undefined} />
    </VerifyShell>
  ),
  notFoundComponent: () => (
    <VerifyShell>
      <VerifyView hash={undefined} />
    </VerifyShell>
  ),
});

function VerifyByPath() {
  const { hash } = Route.useParams();
  return (
    <VerifyShell>
      <VerifyView hash={hash} />
    </VerifyShell>
  );
}

function VerifyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-lg px-4 py-8 sm:py-10">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        {children}
      </main>
    </div>
  );
}
