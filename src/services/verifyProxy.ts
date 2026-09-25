import { createServerFn } from "@tanstack/react-start";
import type { DisplaySpec, VerificationErrorKind, VerifiedDocument } from "@/types/verification";
import { parseDisplaySpec, resolveDisplaySpec } from "@/config/displaySpecs";

/**
 * Server-side proxy to ERPNext, exposed as a TanStack Start server function.
 *
 * No ERPNext app and no custom method is required. This only uses ERPNext's
 * built-in REST API (api/method + api/resource) authenticated with a standard
 * API Key/Secret of a restricted user:
 *
 *   1. Auto-discover which doctypes carry the `verification_data` Custom Field
 *      (querying the `Custom Field` doctype), falling back to an explicit
 *      VERIFICATION_DOCTYPES list when the API user cannot read it. Each
 *      doctype's display list is read from the Custom Field `options`.
 *   2. For each doctype, find the single document whose `verification_data`
 *      equals the scanned hash. The full row is queried ("fields": ["*"]) —
 *      ERPNext rejects any non-*-fields list if it names a field the doctype
 *      does not permit, so no field whitelist is attempted in the query.
 *   3. BEFORE returning, each matched document is sliced down to the fields in
 *      its display spec — so no full ERP rows, verification hashes or internal
 *      metadata ever leave the Worker.
 *
 * The card renders exactly the sliced fields it receives.
 *
 * Secrets (API key/secret) are read from process.env at runtime, which on the
 * Cloudflare Worker are Secret/Variable bindings — they never enter the client
 * bundle.
 */

const FIXED_TIMEOUT_MS = 15_000;
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 800;

export type VerifyProxyResult =
  | {
      ok: true;
      verified: true;
      document?: VerifiedDocument;
      documents?: VerifiedDocument[];
      /** Display specs used to slice the documents, keyed by doctype. */
      displayByDoctype?: Record<string, DisplaySpec>;
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

interface DiscoveryInfo {
  at: number;
  doctypes: string[];
  displayByDoctype: Record<string, DisplaySpec>;
}

interface DiscoveryOutcome {
  healthy: boolean;
  doctypes: string[];
  displayByDoctype: Record<string, DisplaySpec>;
}

let discoveryCache: DiscoveryInfo | null = null;

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

    // 1. Which doctypes to search, and how to slice their rows for display.
    const discovery = await readDiscovery(baseUrl, auth);
    if (!discovery.healthy) {
      return {
        ok: false,
        kind: "rate_limited",
        message: "The verification service is busy. Please try again in a moment.",
      };
    }
    if (!discovery.doctypes.length) {
      return {
        ok: false,
        kind: "failed",
        message:
          "No doctypes carry the verification_data field. Grant the API user read access on Custom Field, or set VERIFICATION_DOCTYPES.",
      };
    }
    const displayByDoctype: Record<string, DisplaySpec> = {};
    for (const doctype of discovery.doctypes) {
      displayByDoctype[doctype] = resolveDisplaySpec(doctype, discovery.displayByDoctype[doctype]);
    }

    // 2. Find the document whose verification_data matches the hash.
    const matches: VerifiedDocument[] = [];
    for (const doctype of discovery.doctypes) {
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
      if (doc) matches.push(sliceDocument(doc, displayByDoctype[doc.doctype]));
    }

    if (!matches.length) {
      return {
        ok: false,
        kind: "not_found",
        message: "No document matches this verification code.",
      };
    }

    const result: VerifyProxyResult = {
      ok: true,
      verified: true,
      displayByDoctype,
    };
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

/** Auto-discover doctypes + their display specs via the Custom Field doctype; fall back to env list. */
async function readDiscovery(baseUrl: string, auth: string): Promise<DiscoveryOutcome> {
  const fallback = (readRuntimeEnv("VERIFICATION_DOCTYPES") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!discoveryCache || Date.now() - discoveryCache.at >= DISCOVERY_TTL_MS) {
    const fresh = await doDiscover(baseUrl, auth, fallback);
    if (fresh.healthy) {
      discoveryCache = {
        at: Date.now(),
        doctypes: fresh.doctypes,
        displayByDoctype: fresh.displayByDoctype,
      };
    }
    return fresh;
  }
  return {
    healthy: true,
    doctypes: discoveryCache.doctypes.length ? discoveryCache.doctypes : fallback,
    displayByDoctype: discoveryCache.displayByDoctype,
  };
}

async function doDiscover(
  baseUrl: string,
  auth: string,
  fallback: string[],
): Promise<DiscoveryOutcome> {
  const url = new URL("/api/resource/Custom Field", baseUrl);
  url.searchParams.set("filters", JSON.stringify([["fieldname", "=", "verification_data"]]));
  url.searchParams.set("fields", JSON.stringify(["dt", "options"]));
  url.searchParams.set("limit_page_length", "200");

  const res = await fetchWithRetry(url, { auth });
  if (res.status === 401 || res.status === 403 || res.status >= 500) {
    return { healthy: false, doctypes: fallback, displayByDoctype: {} };
  }

  const data = await parseDataList(res);
  const doctypes: string[] = [];
  const displayByDoctype: Record<string, DisplaySpec> = {};
  if (Array.isArray(data)) {
    for (const d of data) {
      if (!d || typeof d !== "object") continue;
      const dt = String((d as { dt?: unknown }).dt ?? "");
      if (!dt || dt.startsWith("!") || dt === dt.toLowerCase()) continue;
      doctypes.push(dt);
      const spec = parseDisplaySpec(String((d as { options?: unknown }).options ?? ""));
      if (spec) displayByDoctype[dt] = spec;
    }
  }

  return {
    healthy: true,
    doctypes: Array.from(new Set([...doctypes, ...fallback])),
    displayByDoctype,
  };
}

/**
 * Shrinks a matched ERP row to only the fields its display spec allows, so no
 * full document (hashes, custom QR paths, internal metadata) leaves the server.
 */
function sliceDocument(doc: VerifiedDocument, spec: DisplaySpec): VerifiedDocument {
  const picked: VerifiedDocument = { doctype: doc.doctype, name: doc.name };
  const record = doc as Record<string, unknown>;

  for (const field of spec.fields) {
    if (field === "doctype" || field === "name") continue;
    const value = record[field];
    if (value === undefined || value === null || typeof value === "object") continue;
    picked[field] = value;
  }

  for (const [childField, subfields] of Object.entries(spec.childTables)) {
    const rows = record[childField];
    if (!Array.isArray(rows)) continue;
    picked[childField] = rows.map((row) => {
      const source = (row ?? {}) as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const sub of subfields) {
        const value = source[sub];
        if (value !== undefined && value !== null) out[sub] = value;
      }
      return out;
    });
  }

  return picked;
}

async function findDocumentByHash(
  baseUrl: string,
  auth: string,
  doctype: string,
  hash: string,
): Promise<VerifiedDocument | null | "error"> {
  const url = new URL(`/api/resource/${encodeURIComponent(doctype)}`, baseUrl);
  url.searchParams.set("filters", JSON.stringify([["verification_data", "=", hash]]));
  url.searchParams.set("fields", JSON.stringify(["name"]));
  url.searchParams.set("limit_page_length", "1");

  let res: Response;
  try {
    res = await fetchWithRetry(url, { auth });
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
  const name = String((data[0] as { name?: unknown } | null)?.name ?? "");
  if (!name) return null;

  // The list endpoint omits child tables, so fetch the full document.
  try {
    res = await fetchWithRetry(
      new URL(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, baseUrl),
      { auth },
    );
  } catch {
    return "error";
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiAuthError(doctype);
  }
  if (res.status === 429) {
    throw new RateLimitedError();
  }
  if (!res.ok) return "error";

  const full = await parseDataList(res);
  if (!full || typeof full !== "object") return null;
  return { doctype, ...(full as Record<string, unknown>) } as VerifiedDocument;
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

/** Retries transient ERPNext failures (rate limits / gateway errors). */
async function fetchWithRetry(url: URL, opts: { auth: string }): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchWithTimeout(url, opts);
    const retriable =
      res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
    if (attempt < MAX_ATTEMPTS && retriable) {
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt + Math.random() * 400),
      );
      continue;
    }
    return res;
  }
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
