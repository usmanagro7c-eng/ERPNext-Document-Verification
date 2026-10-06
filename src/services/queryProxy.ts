import { createServerFn } from "@tanstack/react-start";
import { MIN_FILL_MS, createQuerySchema } from "@/lib/query-schema";
import { defaultSite, readSites, type ErpSite } from "@/services/erpSites";
import { authHeader, findDocumentByHash } from "@/services/verifyProxy";
import type { CreateQueryInput, CreateQueryResult } from "@/types/query";

/**
 * Server-side proxy that turns a "Raise a Query" submission on a verified
 * document into an ERPNext Issue.
 *
 * The browser never talks to ERPNext: the API key/secret stay in Worker
 * bindings, exactly as they do for verification.
 *
 * Unlike the Report Query Lead (unverified code, unknown issuer), here the
 * issuer is known: the Issue goes to the site the document was found on, so
 * the team that issued the document sees the query in its own support queue.
 *
 * The customer is NEVER taken from the request body. The document is re-read
 * by hash on the issuing site and its own customer link is used, so a forged
 * submission cannot file Issues against arbitrary customers.
 *
 * The POST is not retried: unlike the verification reads, a write is not
 * idempotent and a retry would create duplicate Issues.
 *
 * ERPNext prerequisite: the site's API user needs create permission on the
 * Issue doctype (Support module), otherwise every submission fails with 403.
 */

const FIXED_TIMEOUT_MS = 20_000;

/** Returned to callers we believe are automated. Never creates anything. */
const SILENT_ISSUE_NAME = "ISS-00000";

/** Link fields that can identify the party a document was issued to. */
const PARTY_FIELDS = ["customer", "customer_name", "party_name", "supplier"] as const;

function readParty(doc: Record<string, unknown>): string | null {
  for (const field of PARTY_FIELDS) {
    const value = doc[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export const createIssueServer = createServerFn({ method: "POST", strict: { output: false } })
  .validator((d: CreateQueryInput) => d)
  .handler(async ({ data }): Promise<CreateQueryResult> => {
    // 1. Honeypot. Answering as if it worked teaches bots nothing.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return { ok: true, issueName: SILENT_ISSUE_NAME };
    }

    // 2. Time-trap, measured as a client-side duration (see reportProxy).
    const fillMs = data.fillMs;
    if (typeof fillMs !== "number" || !Number.isFinite(fillMs) || fillMs < MIN_FILL_MS) {
      return { ok: true, issueName: SILENT_ISSUE_NAME };
    }

    // 3. Shared validation.
    const parsed = createQuerySchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
        field: "description",
      };
    }
    const input = parsed.data;

    // 4. Resolve the issuing site; fall back to the default one.
    const sites = readSites();
    const site: ErpSite | undefined = sites.find((s) => s.id === input.siteId) ?? defaultSite();
    if (!site) {
      console.error("[query] no ERPNext site is configured");
      return { ok: false, message: "Query service is not configured. Please try again later." };
    }
    const auth = authHeader(site);

    // 5. Re-read the document by hash: proves the code is real and yields the
    //    customer of record. The client-sent customer is ignored entirely.
    let customer: string | null = null;
    try {
      const doc = await findDocumentByHash(site, auth, input.doctype, input.hash);
      if (!doc || doc.name !== input.docname) {
        return {
          ok: false,
          message: "This document could not be matched anymore. Please verify it again.",
        };
      }
      customer = readParty(doc as Record<string, unknown>);
    } catch (error) {
      console.error("[query] document re-read failed", error);
      return {
        ok: false,
        message: "Could not reach the issuing site. Please try again shortly.",
      };
    }

    // 6. Create the Issue. subject is mandatory; status defaults to Open.
    const issuePayload: Record<string, unknown> = {
      subject: `Query regarding ${input.doctype} ${input.docname}`,
      description: buildDescription(input),
    };
    if (customer) issuePayload["customer"] = customer;

    let issueRes: Response;
    try {
      issueRes = await fetchWithTimeout(new URL("/api/resource/Issue", site.baseUrl), {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(issuePayload),
      });
    } catch (error) {
      console.error("[query] Issue request failed", error);
      return { ok: false, message: "Could not reach the query service. Please try again shortly." };
    }

    if (!issueRes.ok) {
      const detail = await readErrorDetail(issueRes);
      console.error(`[query] Issue insert failed (${issueRes.status}): ${detail}`);

      if (issueRes.status === 401 || issueRes.status === 403) {
        return {
          ok: false,
          message: "Query submission is not permitted. Please contact the administrator.",
        };
      }
      if (issueRes.status === 429) {
        return { ok: false, message: "Too many submissions. Please try again in a moment." };
      }
      return { ok: false, message: "Your query could not be saved. Please try again." };
    }

    const issueName = await readIssueName(issueRes);
    if (!issueName) {
      return { ok: false, message: "Your query could not be saved. Please try again." };
    }
    return { ok: true, issueName };
  });

function buildDescription(input: CreateQueryInput): string {
  const lines = [
    input.description,
    "",
    "---",
    `Document: ${input.doctype} ${input.docname}`,
    `Verification code: ${input.hash}`,
    `At: ${new Date().toISOString()}`,
  ];
  if (input.pageUrl) lines.push(`Page: ${input.pageUrl}`);
  return lines.join("\n");
}

function fetchWithTimeout(url: URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIXED_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function readIssueName(res: Response): Promise<string | null> {
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
