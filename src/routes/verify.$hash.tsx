import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { VerifyView } from "@/components/VerifyView";

export const Route = createFileRoute("/verify/$hash")({
  head: () => ({
    meta: [
      { title: "Verification Result — Document Verification Portal" },
      {
        name: "description",
        content: "Verification result for a document checked against official records.",
      },
      { property: "og:title", content: "Verification Result" },
      {
        property: "og:description",
        content: "Verification result for a document checked against official records.",
      },
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
    <div className="portal-surface min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">{children}</main>
    </div>
  );
}
