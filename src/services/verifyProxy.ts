import { createServerFn } from "@tanstack/react-start";
import type { VerificationErrorKind, VerifiedDocument } from "@/types/verification";

/**
 * Server-side proxy to ERPNext, exposed as a TanStack Start server function.
 *
 * No ERPNext app and no custom method is required. This only uses ERPNext's
 * built-in REST API (api/method + api/resource) authenticated with a standard
 * API Key/Secret of a restricted user:
 *
 *   1. Auto-discover which doctypes carry the `verification_data` Custom Field
 *      (querying the `Custom Field` doctype), falling back to an explicit
 *      VERIFICATION_DOCTYPES list when the API user cannot read it.
 *   2. For each doctype, find the single document whose `verification_data`
 *      equals the scanned hash. Only a whitelist of fields is returned.
 *
 * Secrets (API key/secret) are read from process.env at runtime, which on the
 * Cloudflare Worker are Secret/Variable bindings — they never enter the client
 * bundle.
 */

const FIXED_TIMEOUT_MS = 15_000;
const DISCOVERY_TTL_MS = 5 * 60 * 1000;

/** Whitelisted document fields returned to the client (plus doctype + name). */
const DEFAULT_VERIFY_FIELDS = [
  "name",
  "status",
  "docstatus",
  "company",
  "customer_name",
  "supplier_name",
  "employee_name",
  "patient_name",
  "posting_date",
  "due_date",
  "grand_total",
  "currency",
  "total",
  "outstanding_amount",
  "remarks",
];

export type VerifyProxyResult =
  | {
      ok: true;
      verified: true;
      document?: VerifiedDocument;
      documents?: VerifiedDocument[];
      message?: string;
    }
  | {
      ok: false;
      kind: VerificationErrorKind;
      message: string;
    };

/** Reads runtime-only configuration. On the Worker these are bindings. */
function readRuntimeEnv(key: string): string | undefined {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env?.[key];
}

let discoveryCache: { at: number; doctypes: string[] } | null = null;

export const verifyDocumentServer = createServerFn({ method: "GET", strict: { output: false } })
  .validator((d: { hash: string }) => d)
  .handler(async ({ data }): Promise<VerifyProxyResult> => {
    const hash = (data.hash ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      return { ok: false, kind: "invalid_hash", message: "Verification code is not valid." };
    }

    const baseUrl = readRuntimeEnv("ERP_NEXT_BASE_URL") ?? "";
    if (!baseUrl) {
      return {
        ok: false,
        kind: "failed",
        message: "Verification service is not configured (ERP_NEXT_BASE_URL missing).",
      };
    }
    const apiKey = readRuntimeEnv("ERP_NEXT_API_KEY");
    const apiSecret = readRuntimeEnv("ERP_NEXT_API_SECRET");
    if (!apiKey || !apiSecret) {
      return {
        ok: false,
        kind: "failed",
        message: "Verification service is not configured (API credentials missing).",
      };
    }

    const auth = authHeader({ apiKey, apiSecret });

    // 1. Which doctypes to search?
    const doctypes = await readDoctypes(baseUrl, auth);
    if (!doctypes.length) {
      return {
        ok: false,
        kind: "failed",
        message:
          "No doctypes carry the verification_data field. Grant the API user read access on Custom Field, or set VERIFICATION_DOCTYPES.",
      };
    }

    // 2. Find the document whose verification_data matches the hash.
    const matches: VerifiedDocument[] = [];
    for (const doctype of doctypes) {
      let doc: VerifiedDocument | null | "error";
      try {
        doc = await findDocumentByHash(baseUrl, auth, doctype, hash);
      } catch (error) {
        if (error instanceof ApiAuthError) {
          return { ok: false, kind: "failed", message: error.message };
        }
        if (error instanceof RateLimitedError) {
          return { ok: false, kind: "rate_limited", message: error.message };
        }
        return { ok: false, kind: "network", message: "Unable to reach the verification service." };
      }
      if (doc === "error") {
        return {
          ok: false,
          kind: "network",
          message: "Unable to reach the verification service.",
        };
      }
      if (doc) matches.push(doc);
    }

    if (!matches.length) {
      return {
        ok: false,
        kind: "not_found",
        message: "No document matches this verification code.",
      };
    }

    const result: VerifyProxyResult = { ok: true, verified: true };
    if (matches.length === 1) result.document = matches[0];
    else result.documents = matches;
    return result;
  });

/* ------------------------------------------------------------------ */
/* ERPNext built-in REST API helpers                                   */
/* ------------------------------------------------------------------ */

type Credentials = { apiKey: string; apiSecret: string };

function authHeader({ apiKey, apiSecret }: Credentials): string {
  return `token ${apiKey}:${apiSecret}`;
}

/** Auto-discover doctypes via the Custom Field doctype; fall back to env list. */
async function readDoctypes(baseUrl: string, auth: string): Promise<string[]> {
  const fallback = (readRuntimeEnv("VERIFICATION_DOCTYPES") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!discoveryCache || Date.now() - discoveryCache.at >= DISCOVERY_TTL_MS) {
    discoveryCache = { at: Date.now(), doctypes: await doDiscover(baseUrl, auth, fallback) };
  }
  return discoveryCache.doctypes.length ? discoveryCache.doctypes : fallback;
}

async function doDiscover(baseUrl: string, auth: string, fallback: string[]): Promise<string[]> {
  const url = new URL("/api/resource/Custom Field", baseUrl);
  url.searchParams.set("filters", JSON.stringify([["fieldname", "=", "verification_data"]]));
  url.searchParams.set("fields", JSON.stringify(["dt"]));
  url.searchParams.set("limit_page_length", "200");

  const res = await fetchWithTimeout(url, { auth });
  if (res.status === 401 || res.status === 403 || res.status >= 500) {
    discoveryCache = { at: Date.now(), doctypes: fallback };
    return fallback;
  }
  const data = await parseDataList(res);
  const doctypes = Array.isArray(data)
    ? data
        .map((d) => (d && typeof d === "object" ? String((d as { dt?: unknown }).dt ?? "") : ""))
        .filter((d) => d && !d.startsWith("!") && d !== d.toLowerCase())
    : [];

  const result = Array.from(new Set([...doctypes, ...fallback]));
  discoveryCache = { at: Date.now(), doctypes: result };
  return result;
}

async function findDocumentByHash(
  baseUrl: string,
  auth: string,
  doctype: string,
  hash: string,
): Promise<VerifiedDocument | null | "error"> {
  const url = new URL(`/api/resource/${encodeURIComponent(doctype)}`, baseUrl);
  url.searchParams.set("filters", JSON.stringify([["verification_data", "=", hash]]));
  url.searchParams.set("fields", JSON.stringify(DEFAULT_VERIFY_FIELDS));
  url.searchParams.set("limit_page_length", "1");

  let res: Response;
  try {
    res = await fetchWithTimeout(url, { auth });
  } catch {
    return "error";
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiAuthError(doctype);
  }
  if (res.status === 429) {
    throw new RateLimitedError();
  }
  if (!res.ok && res.status !== 404) return "error";

  const data = await parseDataList(res);
  if (!Array.isArray(data) || !data.length) return null;
  const row = data[0];
  if (!row || typeof row !== "object") return null;
  return { doctype, ...(row as Record<string, unknown>) } as VerifiedDocument;
}

function fetchWithTimeout(url: URL, { auth }: { auth: string }): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIXED_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    headers: { Authorization: auth, Accept: "application/json" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function parseDataList(res: Response): Promise<unknown> {
  try {
    const body = (await res.json()) as { data?: unknown };
    return body ? body.data : undefined;
  } catch {
    return undefined;
  }
}

class ApiAuthError extends Error {
  constructor(doctype: string) {
    super(
      `The API user cannot read "${doctype}". Grant read access to the doctype(s) being verified.`,
    );
    this.name = "ApiAuthError";
  }
}

class RateLimitedError extends Error {
  constructor() {
    super("Too many requests. Try again later.");
    this.name = "RateLimitedError";
  }
}
