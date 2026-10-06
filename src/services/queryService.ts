import { createQuerySchema } from "@/lib/query-schema";
import { createIssueServer } from "@/services/queryProxy";
import type { CreateQueryInput, CreateQueryResult } from "@/types/query";

/**
 * Client-side entry point for the "Raise a Query" form on a verified document.
 *
 * Mirrors reportService: validate locally for instant feedback, then hand the
 * payload to the server function. The server re-validates everything — this
 * is a convenience layer, never the authority.
 */
export async function submitCreateQuery(input: CreateQueryInput): Promise<CreateQueryResult> {
  const parsed = createQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
      field: "description",
    };
  }

  try {
    return await createIssueServer({ data: parsed.data });
  } catch {
    return {
      ok: false,
      message: "Your query could not be sent. Please check your connection and try again.",
    };
  }
}
