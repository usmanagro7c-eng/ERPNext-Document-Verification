import { createServerFn } from "@tanstack/react-start";
import {
  MAX_ATTACHMENT_BYTES,
  MIN_FILL_MS,
  firstInvalidField,
  reportQuerySchema,
} from "@/lib/report-schema";
import type { ReportQueryInput, ReportQueryResult } from "@/types/report";

/**
 * Server-side proxy that turns a "Report Query" submission into an ERPNext Lead.
 *
 * The browser never talks to ERPNext: the API key/secret stay in Worker
 * bindings, exactly as they do for verification.
 *
 * Two steps against ERPNext:
 *   1. POST /api/resource/Lead   — creates the CRM record.
 *   2. POST /api/method/upload_file — attaches the file to that Lead.
 *
 * Fields deliberately NOT sent, and why:
 *   - company_name: lead.py does `elif self.company_name: self.lead_name =
 *     self.company_name`, so sending it would overwrite the visitor's name.
 *     Lead's own validation is satisfied by lead_name + email_id.
 *   - source: a Link field. If no matching "Lead Source" record exists the
 *     insert is rejected, and that record is not guaranteed to exist.
 *   - lead_owner: defaults to the API user, which is what we want.
 *
 * Neither POST is retried: unlike the verification reads, a write is not
 * idempotent and a retry would create duplicate Leads.
 */

const FIXED_TIMEOUT_MS = 20_000;

/** 4 bytes per 3 bytes of payload, rounded up per base64 block. */
const MAX_BASE64_CHARS = Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4;

/** Returned to callers we believe are automated. Never creates anything. */
const SILENT_LEAD_NAME = "LEAD-00000";

export const reportQueryServer = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: ReportQueryInput) => d)
  .handler(async ({ data }): Promise<ReportQueryResult> => {
    // 1. Honeypot. Answering as if it worked teaches bots nothing.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return { ok: true, leadName: SILENT_LEAD_NAME };
    }

    // 2. Time-trap: nobody types a name, email and number this fast. Fails
    //    closed, and deliberately reads a client-measured *duration* rather
    //    than a timestamp — the Worker and the visitor's device do not share a
    //    clock, so comparing timestamps silently trapped nobody in production.
    const fillMs = data.fillMs;
    if (typeof fillMs !== "number" || !Number.isFinite(fillMs) || fillMs < MIN_FILL_MS) {
      return { ok: true, leadName: SILENT_LEAD_NAME };
    }

    // 3. Shared validation.
    const parsed = reportQuerySchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
        field: firstInvalidField(parsed.error.issues),
      };
    }
    const input = parsed.data;

    // 4. Trust the payload length, not the size the client claims.
    if (input.attachment) {
      if (input.attachment.base64.length > MAX_BASE64_CHARS) {
        return {
          ok: false,
          message: "The file must be 4 MB or smaller.",
          field: "attachment",
        };
      }
    }

    // 5. Runtime configuration.
    const baseUrl = readRuntimeEnv("ERP_NEXT_BASE_URL") ?? "";
    const apiKey = readRuntimeEnv("ERP_NEXT_API_KEY");
    const apiSecret = readRuntimeEnv("ERP_NEXT_API_SECRET");
    if (!baseUrl || !apiKey || !apiSecret) {
      console.error("[report] ERP credentials or base URL are not configured");
      return { ok: false, message: "Query reporting is not configured. Please try again later." };
    }
    const auth = `token ${apiKey}:${apiSecret}`;

    // 6. Create the Lead.
    const leadPayload = {
      lead_name: input.name,
      email_id: input.email,
      mobile_no: input.mobile,
      status: "Open",
      remarks: buildRemarks({
        hash: input.hash,
        reason: input.reason,
        pageUrl: input.pageUrl,
        attachmentName: input.attachment?.fileName,
      }),
    };

    let leadRes: Response;
    try {
      leadRes = await fetchWithTimeout(new URL("/api/resource/Lead", baseUrl), {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(leadPayload),
      });
    } catch (error) {
      console.error("[report] Lead request failed", error);
      return { ok: false, message: "Could not reach the query service. Please try again shortly." };
    }

    if (!leadRes.ok) {
      const detail = await readErrorDetail(leadRes);
      console.error(`[report] Lead insert failed (${leadRes.status}): ${detail}`);

      if (leadRes.status === 401 || leadRes.status === 403) {
        return {
          ok: false,
          message: "Query reporting is not permitted. Please contact the administrator.",
        };
      }
      if (leadRes.status === 429) {
        return { ok: false, message: "Too many submissions. Please try again in a moment." };
      }
      // Lead enforces a unique email_id, so a second query from the same person
      // is rejected outright. Say so, rather than a vague save failure.
      if (/must be unique|already exists|duplicate/i.test(detail)) {
        return {
          ok: false,
          message:
            "This email address was already used in an earlier query. Please use a different email, or call us with your reference number.",
        };
      }
      return { ok: false, message: "Your query could not be saved. Please try again." };
    }

    const leadName = await readLeadName(leadRes);
    if (!leadName) {
      return { ok: false, message: "Your query could not be saved. Please try again." };
    }

    // 7. Attach the file, if one was sent. The Lead already exists at this
    //    point, so a failure here is reported as partial success rather than
    //    pretending the submission never happened.
    if (!input.attachment) {
      return { ok: true, leadName };
    }

    try {
      const uploadRes = await uploadAttachment({
        baseUrl,
        auth,
        leadName,
        attachment: input.attachment,
      });
      if (!uploadRes.ok) {
        const detail = await readErrorDetail(uploadRes);
        console.error(
          `[report] attachment upload failed (${uploadRes.status}) for ${leadName}: ${detail}`,
        );
        return { ok: true, leadName, attachmentFailed: true };
      }
      return { ok: true, leadName };
    } catch (error) {
      console.error("[report] attachment upload threw", error);
      return { ok: true, leadName, attachmentFailed: true };
    }
  });

interface RemarksInput {
  hash: string;
  reason: string;
  pageUrl?: string | undefined;
  attachmentName?: string | undefined;
}

function buildRemarks({ hash, reason, pageUrl, attachmentName }: RemarksInput): string {
  const lines = [
    "Document verification query",
    "",
    `Code: ${hash || "(none supplied)"}`,
    `Reason: ${reason || "unspecified"}`,
    `At: ${new Date().toISOString()}`,
  ];
  if (pageUrl) lines.push(`Page: ${pageUrl}`);
  if (attachmentName) lines.push(`Attachment: ${attachmentName}`);
  return lines.join("\n");
}

function readRuntimeEnv(key: string): string | undefined {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env?.[key];
}

function fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIXED_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Decodes base64 to bytes. Strips whitespace, which some encoders emit. */
function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.replace(/\s+/g, "");
  const binary = atob(clean);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return view;
}

async function uploadAttachment({
  baseUrl,
  auth,
  leadName,
  attachment,
}: {
  baseUrl: string;
  auth: string;
  leadName: string;
  attachment: { base64: string; fileName: string; mimeType: string };
}): Promise<Response> {
  const bytes = base64ToBytes(attachment.base64);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: attachment.mimeType }), attachment.fileName);
  form.append("doctype", "Lead");
  form.append("docname", leadName);
  // Keep the upload out of the public /files listing.
  form.append("is_private", "1");

  return fetchWithTimeout(new URL("/api/method/upload_file", baseUrl), {
    method: "POST",
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
    body: form,
  });
}

async function readLeadName(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { data?: { name?: unknown } };
    const name = body?.data?.name;
    return typeof name === "string" && name ? name : null;
  } catch {
    return null;
  }
}

/** Best-effort server-side reason, for the Worker log only. */
async function readErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      exc_type?: string;
      _server_messages?: string;
      message?: string;
    };
    if (body?._server_messages) {
      try {
        const parsed = JSON.parse(body._server_messages) as string[];
        if (parsed[0]) return parsed[0];
      } catch {
        /* fall through */
      }
    }
    return [body?.exc_type, body?.message].filter(Boolean).join(": ") || res.statusText;
  } catch {
    return res.statusText;
  }
}
