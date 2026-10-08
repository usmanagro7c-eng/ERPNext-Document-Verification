import { createServerFn } from "@tanstack/react-start";
import { MIN_FILL_MS, createQuerySchema } from "@/lib/query-schema";
import { parseVerificationCode } from "@/lib/verification-hash";
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
 * Every Issue is filed as High priority, under an Issue Type named after the
 * document's doctype (the QR prefix decides it — "SIN" -> "Sales Invoice" — and
 * a legacy bare-hash code falls back to the verified document's own doctype).
 * Both fields are Links in ERPNext, so the lookup records are created on demand
 * by ensureLinkRecord; if one cannot be created the Issue is still filed and
 * just that field is left off, because losing the priority must never cost the
 * customer their query.
 *
 * The customer is NEVER taken from the request body. The document is re-read
 * by hash on the issuing site and its own customer link is used, so a forged
 * submission cannot file Issues against arbitrary customers.
 *
 * The POST is not retried: unlike the verification reads, a write is not
 * idempotent and a retry would create duplicate Issues.
 *
 * ERPNext prerequisites: the site's API user needs create permission on the
 * Issue doctype (Support module) plus read/create on Issue Type and Issue
 * Priority, otherwise every submission fails with 403.
 */

const FIXED_TIMEOUT_MS = 20_000;

/** Returned to callers we believe are automated. Never creates anything. */
const SILENT_ISSUE_NAME = "ISS-00000";

/** Support doctypes Issue's Link fields point at. */
const ISSUE_TYPE_DOCTYPE = "Issue Type";
const ISSUE_PRIORITY_DOCTYPE = "Issue Priority";

/** Every query raised from a verified document is high priority. */
const ISSUE_PRIORITY = "High";

/** Link fields that can identify the party a document was issued to. */
const PARTY_FIELDS = ["customer", "customer_name", "party_name", "supplier"] as const;

function readParty(doc: Record<string, unknown>): string | null {
  for (const field of PARTY_FIELDS) {
    const value = doc[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * The Issue Type a query about this document belongs to.
 *
 * The QR prefix wins, because that is what the printed document says. A code
 * with no prefix — or one naming a doctype we do not have a prefix for — falls
 * back to the doctype of the document that was actually verified, which is the
 * same answer whenever the two can be compared and the only answer when they
 * cannot.
 *
 * The raw ERP doctype is used deliberately: doctypeLabel() rewrites "Sales
 * Invoice" to "Invoice" for visitors, which is not a name Issue Type records
 * are filed under.
 */
function issueTypeLabel(hash: string, doctype: string): string {
  return parseVerificationCode(hash)?.doctype ?? doctype;
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

    // 4. Re-normalise the code. The browser already sends it normalised, but the
    //    re-read below is a security check — it is what proves the code is real
    //    — so the form the code is compared in must not depend on the client
    //    having got the prefix casing right.
    const code = parseVerificationCode(input.hash)?.code ?? input.hash.trim();

    // 5. Resolve the issuing site; fall back to the default one.
    const sites = readSites();
    const site: ErpSite | undefined = sites.find((s) => s.id === input.siteId) ?? defaultSite();
    if (!site) {
      console.error("[query] no ERPNext site is configured");
      return { ok: false, message: "Query service is not configured. Please try again later." };
    }
    const auth = authHeader(site);

    // 6. Re-read the document by hash: proves the code is real and yields the
    //    customer of record. The client-sent customer is ignored entirely.
    let customer: string | null = null;
    try {
      const doc = await findDocumentByHash(site, auth, input.doctype, code);
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

    // 7. Both `priority` and `issue_type` are Links, and ERPNext rejects the
    //    whole insert when a Link target does not exist — so the lookup records
    //    are made first. A failure here only drops that one field; the Issue is
    //    still filed below.
    const issueType = issueTypeLabel(code, input.doctype);
    const priorityReady = await ensureLinkRecord(
      site,
      auth,
      ISSUE_PRIORITY_DOCTYPE,
      ISSUE_PRIORITY,
    );
    const typeReady = await ensureLinkRecord(site, auth, ISSUE_TYPE_DOCTYPE, issueType);

    // 8. Create the Issue. subject is mandatory; status defaults to Open.
    const issuePayload: Record<string, unknown> = {
      subject: `Query regarding ${input.doctype} ${input.docname}`,
      description: buildDescription(input, code),
    };
    if (customer) issuePayload["customer"] = customer;
    if (priorityReady) issuePayload["priority"] = ISSUE_PRIORITY;
    if (typeReady) issuePayload["issue_type"] = issueType;

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

/**
 * Makes sure a Link target exists, creating it the first time it is needed.
 *
 * ERPNext refuses to insert a document whose Link field points at a record that
 * is not there, so "Sales Invoice" or "High" has to exist as an Issue Type /
 * Issue Priority before it can be assigned. Reading first means the common case
 * — the record was created by an earlier query — costs a single GET and no
 * write at all.
 *
 * Returns false rather than throwing when the record cannot be guaranteed: the
 * caller then leaves that Link off the Issue, which is degraded but still
 * useful, whereas failing the submission would throw the query away.
 */
async function ensureLinkRecord(
  site: ErpSite,
  auth: string,
  doctype: string,
  name: string,
): Promise<boolean> {
  const existing = await linkRecordExists(site, auth, doctype, name);
  // null = could not read the list, so do not guess by writing either.
  if (existing === null || existing) return existing === true;

  const url = new URL(`/api/resource/${encodeURIComponent(doctype)}`, site.baseUrl);
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Issue Type and Issue Priority both use the "Prompt" naming rule, so
      // supplying `name` in the body is what names the record.
      body: JSON.stringify({ name }),
    });

    if (res.ok) return true;

    const detail = await readErrorDetail(res);
    // Two queries for the same prefix raced; the loser still gets a valid Link.
    if (/must be unique|already exists|duplicate/i.test(detail)) return true;

    console.error(`[query] could not create ${doctype} "${name}" (${res.status}): ${detail}`);
    return false;
  } catch (error) {
    console.error(`[query] ${doctype} "${name}" create request failed`, error);
    return false;
  }
}

/** true = present, false = absent, null = could not determine. */
async function linkRecordExists(
  site: ErpSite,
  auth: string,
  doctype: string,
  name: string,
): Promise<boolean | null> {
  const url = new URL(`/api/resource/${encodeURIComponent(doctype)}`, site.baseUrl);
  url.searchParams.set("filters", JSON.stringify([["name", "=", name]]));
  url.searchParams.set("fields", JSON.stringify(["name"]));
  url.searchParams.set("limit_page_length", "1");

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(
        `[query] could not read ${doctype} (${res.status}); leaving that field off the Issue`,
      );
      return null;
    }
    const body = (await res.json()) as { data?: unknown };
    return Array.isArray(body?.data) && body.data.length > 0;
  } catch (error) {
    console.error(`[query] ${doctype} read request failed`, error);
    return null;
  }
}

function buildDescription(input: CreateQueryInput, code: string): string {
  const lines = [
    input.description,
    "",
    "---",
    `Document: ${input.doctype} ${input.docname}`,
    `Verification code: ${code}`,
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
