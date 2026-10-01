import type { ErpSite } from "@/services/erpSites";

/**
 * Resolves the name of the company a site belongs to.
 *
 * The portal presents itself under that company's name, so it is read from the
 * ERP rather than hardcoded: renaming the company needs no redeploy. Each site
 * is asked separately, because one deployment now serves several companies —
 * dev16 may be "MMMC" and test16 "Test", and a document must be branded with
 * the issuer that actually printed it.
 *
 * Lookup order, each step falling through on failure:
 *   1. Global Defaults.default_company — the company the ERP treats as default,
 *      which is the right answer when several companies exist.
 *   2. The first Company record.
 *   3. null, so the UI shows brand-neutral wording instead of a name.
 *
 * Step 1 currently answers 500 on both live sites, so in practice the name
 * comes from step 2 — one wasted request per cache miss. The order is kept
 * because it is the correct one for a single ERP holding several companies.
 *
 * Never throws: a company lookup failing must not take the portal down, it only
 * costs the branding.
 *
 * Cached for the same window as the doctype discovery in verifyProxy, because
 * company names change roughly as often as the doctype list does.
 */

const COMPANY_TTL_MS = 5 * 60 * 1000;
/**
 * A failed lookup is cached far more briefly than a successful one. With a
 * single TTL, one slow ERP response on a cold cache left the whole portal
 * showing the neutral fallback for five minutes even though the ERP was fine.
 * Short enough to recover quickly, long enough not to hammer a dead ERP.
 */
const NEGATIVE_TTL_MS = 30 * 1000;
const FIXED_TIMEOUT_MS = 10_000;

/** Keyed by site: two sites hold different companies, or the same one twice. */
const companyCache = new Map<string, { at: number; name: string | null }>();

/** The company's name, or null when it cannot be read. Never throws. */
export async function resolveCompanyName(site: ErpSite): Promise<string | null> {
  const cached = companyCache.get(site.id);
  if (cached) {
    const ttl = cached.name ? COMPANY_TTL_MS : NEGATIVE_TTL_MS;
    if (Date.now() - cached.at < ttl) return cached.name;
  }

  const name = await lookupCompanyName(site);
  companyCache.set(site.id, { at: Date.now(), name });
  return name;
}

async function lookupCompanyName(site: ErpSite): Promise<string | null> {
  const auth = `token ${site.apiKey}:${site.apiSecret}`;

  // 1. The ERP's own default company.
  const fromDefaults = await readString(
    new URL("/api/resource/Global Defaults", site.baseUrl),
    auth,
    (body) => (body as { data?: { default_company?: unknown } })?.data?.default_company,
  );
  if (fromDefaults) return fromDefaults;

  // 2. Fall back to the first company record.
  return readString(
    (() => {
      const url = new URL("/api/resource/Company", site.baseUrl);
      url.searchParams.set("fields", JSON.stringify(["name"]));
      url.searchParams.set("limit_page_length", "1");
      return url;
    })(),
    auth,
    (body) => {
      const rows = (body as { data?: unknown })?.data;
      return Array.isArray(rows) ? (rows[0] as { name?: unknown } | undefined)?.name : undefined;
    },
  );
}

async function readString(
  url: URL,
  auth: string,
  pick: (body: unknown) => unknown,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIXED_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: auth, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const value = pick(await res.json());
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
