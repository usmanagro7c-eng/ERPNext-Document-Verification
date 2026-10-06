import { createServerFn } from "@tanstack/react-start";
import type { DisplaySpec, VerificationErrorKind, VerifiedDocument } from "@/types/verification";
import { parseDisplaySpec, resolveDisplaySpec } from "@/config/displaySpecs";
import { isLikelyHash } from "@/lib/verification-hash";
import { readSites, type ErpSite } from "@/services/erpSites";
import { resolveCompanyName } from "@/services/companyProxy";

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
 * Every configured site is searched, in parallel, because the portal verifies
 * documents issued by more than one company. A scan costs as much wall-clock
 * time as its slowest site, not the sum, so adding a second company does not
 * slow a scan down. Sites fail independently: one unreachable site is logged
 * and the rest still answer, and only when no site could answer at all does the
 * visitor see an error.
 *
 * Secrets (API key/secret) are read from process.env at runtime, which on the
 * Cloudflare Worker are Secret/Variable bindings — they never enter the client
 * bundle.
 */

const FIXED_TIMEOUT_MS = 15_000;
const DISCOVERY_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 800;

/** Why one site could not answer. Absent means the site answered cleanly. */
type SiteProblem = "unauthorized" | "rate_limited" | "unreachable" | "no_doctypes";

interface SiteOutcome {
  siteId: string;
  /** Documents found on this site, already sliced and tagged with its source. */
  matches: VerifiedDocument[];
  displayByDoctype: Record<string, DisplaySpec>;
  problem?: SiteProblem | undefined;
}

export type VerifyProxyResult =
  | {
      ok: true;
      verified: true;
      document?: VerifiedDocument;
      documents?: VerifiedDocument[];
      /** Display specs used to slice the documents, keyed by doctype. */
      displayByDoctype?: Record<string, DisplaySpec>;
      /** Company that issued the document, for branding. Null when unresolvable. */
      brandName?: string | null;
      /** Ids of every site that returned a match, in configuration order. */
      matchedSites?: string[];
      message?: string;
    }
  | {
      ok: false;
      kind: VerificationErrorKind;
      message: string;
    };

interface DiscoveryInfo {
  at: number;
  doctypes: string[];
  displayByDoctype: Record<string, DisplaySpec>;
}

interface DiscoveryOutcome {
  healthy: boolean;
  problem?: SiteProblem | undefined;
  doctypes: string[];
  displayByDoctype: Record<string, DisplaySpec>;
}

/** Keyed by site: two sites may well carry different doctypes and specs. */
const discoveryCache = new Map<string, DiscoveryInfo>();

export const verifyDocumentServer = createServerFn({ method: "GET", strict: { output: false } })
  .validator((d: { hash: string }) => d)
  .handler(async ({ data }): Promise<VerifyProxyResult> => {
    const hash = (data.hash ?? "").trim().toLowerCase();
    if (!isLikelyHash(hash)) {
      return { ok: false, kind: "invalid_hash", message: "Verification code is not valid." };
    }

    const sites = readSites();
    if (!sites.length) {
      return {
        ok: false,
        kind: "failed",
        message: "Verification service is not configured (ERP_NEXT_SITES missing).",
      };
    }

    // 1. Every site is searched at once: a scan waits for the slowest site, not
    //    for their sum, and one site being down must not hide the others' hits.
    const outcomes = await Promise.all(sites.map((site) => verifyOnSite(site, hash)));

    for (const outcome of outcomes) {
      if (outcome.problem) {
        console.warn(`[verify] site "${outcome.siteId}" could not answer: ${outcome.problem}`);
      }
    }

    // 2. A match wins over any site trouble: a document we did find is a
    //    document, even if another doctype on some other site errored.
    //
    //    The issuer is resolved *before* the documents are flattened, because
    //    tagging replaces each match with a new object — a list taken earlier
    //    would still hold the untagged ones, and the card would fall back to
    //    neutral wording even though the name was known.
    const matchedOutcomes = outcomes.filter((outcome) => outcome.matches.length);
    if (matchedOutcomes.length) {
      // Name the issuer so the card can brand itself with the company that
      // actually printed the document, not whichever site is listed first.
      await Promise.all(
        matchedOutcomes.map(async (outcome) => {
          const site = sites.find((candidate) => candidate.id === outcome.siteId);
          const companyName = site ? await resolveCompanyName(site) : null;
          outcome.matches = outcome.matches.map((doc) =>
            companyName ? { ...doc, sourceName: companyName } : doc,
          );
        }),
      );
    }

    const matches = matchedOutcomes.flatMap((outcome) => outcome.matches);
    if (matches.length) {
      const result: VerifyProxyResult = {
        ok: true,
        verified: true,
        displayByDoctype: mergeDisplaySpecs(outcomes),
        matchedSites: matchedOutcomes.map((outcome) => outcome.siteId),
      };
      const [document] = matches;
      result.brandName = document?.sourceName ?? null;
      if (matches.length === 1 && document) result.document = document;
      else result.documents = matches;
      return result;
    }

    // 3. No match anywhere. If at least one site answered cleanly, "not found"
    //    is the truth — a site being down is not evidence of forgery.
    if (outcomes.some((outcome) => !outcome.problem)) {
      return {
        ok: false,
        kind: "not_found",
        message: "No document matches this verification code.",
      };
    }

    return { ok: false, ...failureFor(outcomes) };
  });

/**
 * Searches one site for the hash. Never throws: every failure mode is reported
 * as a `problem` so the caller can compare sites instead of unwinding.
 */
async function verifyOnSite(site: ErpSite, hash: string): Promise<SiteOutcome> {
  const outcome: SiteOutcome = {
    siteId: site.id,
    matches: [],
    displayByDoctype: {},
  };
  const auth = authHeader(site);

  // 1. Which doctypes to search, and how to slice their rows for display.
  const discovery = await readDiscovery(site, auth);
  if (!discovery.healthy) {
    outcome.problem = discovery.problem;
    return outcome;
  }
  if (!discovery.doctypes.length) {
    outcome.problem = "no_doctypes";
    return outcome;
  }
  // Resolved up front so the search loop reads the spec it needs directly,
  // rather than looking it back up on a possibly-absent map key.
  const specs = new Map<string, DisplaySpec>();
  for (const doctype of discovery.doctypes) {
    const spec = resolveDisplaySpec(doctype, discovery.displayByDoctype[doctype]);
    outcome.displayByDoctype[doctype] = spec;
    specs.set(doctype, spec);
  }

  // 2. Find the document whose verification_data matches the hash.
  for (const [doctype, spec] of specs) {
    let doc: VerifiedDocument | null;
    try {
      doc = await findDocumentByHash(site, auth, doctype, hash);
    } catch (error) {
      outcome.problem = problemFor(error);
      return outcome;
    }
    if (doc) {
      // The site is attached after slicing, so it can only ever be a value this
      // module wrote — an ERP field of the same name cannot ride along.
      outcome.matches.push({ ...sliceDocument(doc, spec), siteId: site.id });
    }
  }

  return outcome;
}

function problemFor(error: unknown): SiteProblem {
  if (error instanceof ApiAuthError) return "unauthorized";
  if (error instanceof RateLimitedError) return "rate_limited";
  return "unreachable";
}

/** Picks the visitor-facing error when no site could answer at all. */
function failureFor(outcomes: SiteOutcome[]): { kind: VerificationErrorKind; message: string } {
  const problems = new Set(outcomes.map((outcome) => outcome.problem));

  if (problems.has("unauthorized")) {
    return {
      kind: "failed",
      message:
        "The verification service is not permitted to read the documents being verified. Please contact the administrator.",
    };
  }
  if (problems.has("no_doctypes")) {
    return {
      kind: "failed",
      message:
        "No doctypes carry the verification_data field. Grant the API user read access on Custom Field, or set VERIFICATION_DOCTYPES.",
    };
  }
  if (problems.size === 1 && problems.has("rate_limited")) {
    return {
      kind: "rate_limited",
      message: "The verification service is busy. Please try again in a moment.",
    };
  }
  return { kind: "network", message: "Unable to reach the verification service." };
}

/**
 * Merges the per-site display specs. The first site to answer wins for a given
 * doctype, so the fields on screen never depend on which site replied first.
 */
function mergeDisplaySpecs(outcomes: SiteOutcome[]): Record<string, DisplaySpec> {
  const merged: Record<string, DisplaySpec> = {};
  for (const outcome of outcomes) {
    for (const [doctype, spec] of Object.entries(outcome.displayByDoctype)) {
      merged[doctype] ??= spec;
    }
  }
  return merged;
}

/* ------------------------------------------------------------------ */
/* ERPNext built-in REST API helpers                                   */
/* ------------------------------------------------------------------ */

export function authHeader({ apiKey, apiSecret }: ErpSite): string {
  return `token ${apiKey}:${apiSecret}`;
}

/** Auto-discover doctypes + their display specs via the Custom Field doctype; fall back to env list. */
async function readDiscovery(site: ErpSite, auth: string): Promise<DiscoveryOutcome> {
  const fallback = site.doctypes;
  const cached = discoveryCache.get(site.id);
  if (cached && Date.now() - cached.at < DISCOVERY_TTL_MS) {
    return {
      healthy: true,
      doctypes: cached.doctypes.length ? cached.doctypes : fallback,
      displayByDoctype: cached.displayByDoctype,
    };
  }

  let fresh: DiscoveryOutcome;
  try {
    fresh = await doDiscover(site, auth, fallback);
  } catch {
    // A network failure during discovery is this site's problem alone.
    return { healthy: false, problem: "unreachable", doctypes: fallback, displayByDoctype: {} };
  }

  // Only a clean answer is cached, so one slow response cannot pin a dead site
  // in the list for the whole TTL.
  if (fresh.healthy) {
    discoveryCache.set(site.id, {
      at: Date.now(),
      doctypes: fresh.doctypes,
      displayByDoctype: fresh.displayByDoctype,
    });
  }
  return fresh;
}

async function doDiscover(
  site: ErpSite,
  auth: string,
  fallback: string[],
): Promise<DiscoveryOutcome> {
  const url = new URL("/api/resource/Custom Field", site.baseUrl);
  url.searchParams.set("filters", JSON.stringify([["fieldname", "=", "verification_data"]]));
  url.searchParams.set("fields", JSON.stringify(["dt", "options"]));
  url.searchParams.set("limit_page_length", "200");

  const res = await fetchWithRetry(url, auth);
  if (res.status === 401 || res.status === 403) {
    return { healthy: false, problem: "unauthorized", doctypes: fallback, displayByDoctype: {} };
  }
  if (res.status === 429) {
    return { healthy: false, problem: "rate_limited", doctypes: fallback, displayByDoctype: {} };
  }
  if (!res.ok) {
    return { healthy: false, problem: "unreachable", doctypes: fallback, displayByDoctype: {} };
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

export async function findDocumentByHash(
  site: ErpSite,
  auth: string,
  doctype: string,
  hash: string,
): Promise<VerifiedDocument | null> {
  const url = new URL(`/api/resource/${encodeURIComponent(doctype)}`, site.baseUrl);
  url.searchParams.set("filters", JSON.stringify([["verification_data", "=", hash]]));
  url.searchParams.set("fields", JSON.stringify(["name"]));
  url.searchParams.set("limit_page_length", "1");

  let res = await fetchWithRetry(url, auth);
  if (res.status === 401 || res.status === 403) throw new ApiAuthError(doctype);
  if (res.status === 429) throw new RateLimitedError();
  if (!res.ok && res.status !== 404) throw new SiteUnreachableError();

  const data = await parseDataList(res);
  if (!Array.isArray(data) || !data.length) return null;
  const name = String((data[0] as { name?: unknown } | null)?.name ?? "");
  if (!name) return null;

  // The list endpoint never returns child tables, so the full document is a
  // second, unavoidable request. Checked directly against ERPNext: `fields:
  // ["*"]` omits them, `["*", "items"]` is rejected outright ("Field not
  // permitted in query: *"), and naming a child field is dropped silently.
  res = await fetchWithRetry(
    new URL(
      `/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
      site.baseUrl,
    ),
    auth,
  );
  if (res.status === 401 || res.status === 403) throw new ApiAuthError(doctype);
  if (res.status === 429) throw new RateLimitedError();
  if (!res.ok) throw new SiteUnreachableError();

  const full = await parseDataList(res);
  if (!full || typeof full !== "object") return null;
  return { doctype, ...(full as Record<string, unknown>) } as VerifiedDocument;
}

function fetchWithTimeout(url: URL, auth: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIXED_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    headers: { Authorization: auth, Accept: "application/json" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

/** Retries transient ERPNext failures (rate limits / gateway errors). */
async function fetchWithRetry(url: URL, auth: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetchWithTimeout(url, auth);
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

class SiteUnreachableError extends Error {
  constructor() {
    super("The ERPNext site did not respond.");
    this.name = "SiteUnreachableError";
  }
}
