/**
 * Server-only registry of the ERPNext sites this portal verifies against.
 *
 * The portal serves more than one ERPNext site — different companies, or the
 * same company on several environments — so every ERPNext connection is
 * resolved through this module rather than by reading process.env at each call
 * site. It is the single place that knows how a site is configured.
 *
 * Configuration, in order of precedence:
 *   1. ERP_NEXT_SITES — a JSON array of { id, baseUrl, doctypes? }.
 *   2. ERP_NEXT_BASE_URL + ERP_NEXT_API_KEY / ERP_NEXT_API_SECRET — the
 *      original single-site form, still honoured so an existing deployment
 *      keeps working without a redeploy.
 *
 * Each site's API Key/Secret live in their own bindings, suffixed with the
 * site's id: `dev16` -> ERP_NEXT_API_KEY_DEV16 / ERP_NEXT_API_SECRET_DEV16.
 * Keeping them separate is the point — a shared credential would mean one
 * compromised key opens every company's records.
 *
 * Sites are searched in configuration order and the first one is the default:
 * the site that receives Report Query leads.
 *
 * Never throws. A site with missing or invalid configuration is skipped with a
 * warning, because one bad entry must not take the whole portal down — running
 * several sites is only useful if they fail independently.
 */

export interface ErpSite {
  /** Stable identifier. Also the suffix for this site's credential bindings. */
  id: string;
  /** Origin + path, normalised: no trailing slash, http(s) only. */
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  /** Doctype fallback, used only when the API user cannot read Custom Field. */
  doctypes: string[];
}

/** Reads runtime-only configuration. On the Worker these are bindings. */
export function readRuntimeEnv(key: string): string | undefined {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env?.[key];
}

/** A site as configured, before validation. Credentials are named, not read. */
interface SiteSpec {
  id: string;
  baseUrl?: string | undefined;
  /** Doctypes declared inline in ERP_NEXT_SITES, if any. */
  doctypes?: string | undefined;
  /** Explicit binding names, so the legacy single-site form needs no suffix. */
  apiKeyVar: string;
  apiSecretVar: string;
}

/**
 * Bindings are fixed for the life of a Worker isolate, and the dev server
 * restarts when .env changes, so the resolved list is parsed once.
 */
let cachedSites: ErpSite[] | null = null;

/** Every configured site that is usable, in configuration order. */
export function readSites(): ErpSite[] {
  cachedSites ??= buildSites();
  return cachedSites;
}

/** The site that Report Query leads are filed against: the first configured one. */
export function defaultSite(): ErpSite | undefined {
  return readSites()[0];
}

/* ------------------------------------------------------------------ */
/* Configuration parsing                                               */
/* ------------------------------------------------------------------ */

/** "dev16" -> "DEV16", "site one" -> "SITE_ONE". */
function credentialSuffix(id: string): string {
  return id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the origin+path with any trailing slash removed, or null when the
 * value is unusable. A trailing slash is rejected rather than patched because
 * `new URL("/api/...", "https://host/")` silently drops the last path segment
 * on a site served from a sub-path.
 */
function normalizeBaseUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return trimmed;
}

function readSiteSpecs(): SiteSpec[] {
  const raw = readRuntimeEnv("ERP_NEXT_SITES")?.trim();
  if (raw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
      console.error(
        "[erpSites] ERP_NEXT_SITES is not valid JSON; falling back to the single-site form.",
      );
    }
    if (Array.isArray(parsed)) {
      return parsed
        .filter(
          (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object",
        )
        .map((entry, index) => {
          const id = typeof entry["id"] === "string" ? entry["id"].trim() : "";
          const suffix = credentialSuffix(id || `SITE_${index + 1}`);
          return {
            // An unnamed entry still gets an id, so its credentials can be found.
            id: id || `site${index + 1}`,
            baseUrl: typeof entry["baseUrl"] === "string" ? entry["baseUrl"] : "",
            doctypes: typeof entry["doctypes"] === "string" ? entry["doctypes"] : undefined,
            apiKeyVar: `ERP_NEXT_API_KEY_${suffix}`,
            apiSecretVar: `ERP_NEXT_API_SECRET_${suffix}`,
          };
        });
    }
    if (parsed !== null) {
      console.error(
        "[erpSites] ERP_NEXT_SITES is not a JSON array; falling back to the single-site form.",
      );
    }
  }

  // Legacy single-site configuration, kept working on purpose.
  const baseUrl = readRuntimeEnv("ERP_NEXT_BASE_URL")?.trim();
  if (!baseUrl) return [];
  return [
    {
      id: "default",
      baseUrl,
      apiKeyVar: "ERP_NEXT_API_KEY",
      apiSecretVar: "ERP_NEXT_API_SECRET",
    },
  ];
}

/**
 * Inline doctypes win, then a per-site VERIFICATION_DOCTYPES_<ID>, then the
 * shared list. Auto-discovery runs first either way; this is only what to search
 * when the API user cannot read the Custom Field doctype.
 */
function resolveDoctypes(spec: SiteSpec, sharedFallback: string[]): string[] {
  const inline = parseList(spec.doctypes);
  if (inline.length) return inline;
  const perSite = parseList(readRuntimeEnv(`VERIFICATION_DOCTYPES_${credentialSuffix(spec.id)}`));
  return perSite.length ? perSite : sharedFallback;
}

function buildSites(): ErpSite[] {
  const specs = readSiteSpecs();
  if (!specs.length) return [];

  const sharedFallback = parseList(readRuntimeEnv("VERIFICATION_DOCTYPES"));
  const sites: ErpSite[] = [];
  const seenBaseUrls = new Set<string>();

  for (const spec of specs) {
    const baseUrl = normalizeBaseUrl(spec.baseUrl ?? "");
    if (!baseUrl) {
      if (spec.baseUrl) {
        console.error(`[erpSites] site "${spec.id}" has an unusable base URL; skipping.`);
      }
      continue;
    }
    if (seenBaseUrls.has(baseUrl)) {
      console.error(`[erpSites] site "${spec.id}" repeats ${baseUrl}; skipping the duplicate.`);
      continue;
    }
    seenBaseUrls.add(baseUrl);

    const apiKey = readRuntimeEnv(spec.apiKeyVar)?.trim();
    const apiSecret = readRuntimeEnv(spec.apiSecretVar)?.trim();
    if (!apiKey || !apiSecret) {
      console.error(
        `[erpSites] site "${spec.id}" (${baseUrl}) is missing ${spec.apiKeyVar} / ${spec.apiSecretVar}; skipping.`,
      );
      continue;
    }

    sites.push({
      id: spec.id,
      baseUrl,
      apiKey,
      apiSecret,
      doctypes: resolveDoctypes(spec, sharedFallback),
    });
  }

  return sites;
}
