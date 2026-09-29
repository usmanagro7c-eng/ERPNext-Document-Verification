import { createServerFn } from "@tanstack/react-start";

/**
 * Resolves the name of the company the portal verifies against.
 *
 * The portal presents itself under that company's name, so it is read from the
 * ERP rather than hardcoded: renaming the company needs no redeploy.
 *
 * Lookup order, each step falling through on failure:
 *   1. Global Defaults.default_company — the company the ERP treats as default,
 *      which is the right answer when several companies exist.
 *   2. The first Company record.
 *   3. null, so the UI shows brand-neutral wording instead of a name.
 *
 * Never throws: a company lookup failing must not take the portal down, it only
 * costs the branding.
 *
 * Cached for the same window as the doctype discovery in verifyProxy, because
 * company names change roughly as often as the doctype list does.
 */

const COMPANY_TTL_MS = 5 * 60 * 1000;
const FIXED_TIMEOUT_MS = 10_000;

let companyCache: { at: number; name: string | null } | null = null;

function readRuntimeEnv(key: string): string | undefined {
  const maybeProcess = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return maybeProcess.process?.env?.[key];
}

export const companyProfileServer = createServerFn({ method: "GET", strict: { output: false } })
  .validator(() => ({}) as Record<string, never>)
  .handler(async (): Promise<{ companyName: string | null }> => {
    if (companyCache && Date.now() - companyCache.at < COMPANY_TTL_MS) {
      return { companyName: companyCache.name };
    }

    const companyName = await resolveCompanyName();
    companyCache = { at: Date.now(), name: companyName };
    return { companyName };
  });

async function resolveCompanyName(): Promise<string | null> {
  const baseUrl = readRuntimeEnv("ERP_NEXT_BASE_URL") ?? "";
  const apiKey = readRuntimeEnv("ERP_NEXT_API_KEY");
  const apiSecret = readRuntimeEnv("ERP_NEXT_API_SECRET");
  if (!baseUrl || !apiKey || !apiSecret) return null;

  const auth = `token ${apiKey}:${apiSecret}`;

  // 1. The ERP's own default company.
  const fromDefaults = await readString(
    new URL("/api/resource/Global Defaults", baseUrl),
    auth,
    (body) => (body as { data?: { default_company?: unknown } })?.data?.default_company,
  );
  if (fromDefaults) return fromDefaults;

  // 2. Fall back to the first company record.
  return readString(
    (() => {
      const url = new URL("/api/resource/Company", baseUrl);
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
