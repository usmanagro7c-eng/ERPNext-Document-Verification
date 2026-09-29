import { firstInvalidField, reportQuerySchema } from "@/lib/report-schema";
import { reportQueryServer } from "@/services/reportProxy";
import type { ReportQueryInput, ReportQueryResult } from "@/types/report";

/**
 * Client-side entry point for the "Report Query" form.
 *
 * Mirrors verificationService: validate locally for instant feedback, then hand
 * the payload to the server function. The server re-validates everything — this
 * is a convenience layer, never the authority.
 */
export async function submitReportQuery(input: ReportQueryInput): Promise<ReportQueryResult> {
  const parsed = reportQuerySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
      field: firstInvalidField(parsed.error.issues),
    };
  }

  try {
    return await reportQueryServer({ data: parsed.data });
  } catch {
    return {
      ok: false,
      message: "Your query could not be sent. Please check your connection and try again.",
    };
  }
}
