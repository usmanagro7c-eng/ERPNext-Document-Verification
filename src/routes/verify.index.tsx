import { createFileRoute } from "@tanstack/react-router";
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
        property: "og:description",
        content: "Verification result for a document checked against official records.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyByQuery,
});

function VerifyByQuery() {
  const { hash } = Route.useSearch();
  return (
    <div className="portal-surface min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <VerifyView hash={hash} />
      </main>
    </div>
  );
}
