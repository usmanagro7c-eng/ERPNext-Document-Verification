/**
 * Where this app lives on the public host.
 *
 * staging.mmmc.pk serves it under a sub-path, and the reverse proxy in front of
 * the Cloudflare Worker owns that prefix:
 *
 *   - Request:  /verification/verify/abc  ->  Worker sees /verify/abc
 *   - Response: href="/"  ->  href="/verification/"
 *
 * So the Worker always renders and matches *unprefixed* paths. That is why
 * `tanstackStart.router.basepath` is pinned to "/" in vite.config.ts: inferring
 * it from the Vite `base` would make the Worker look for
 * /verification/_serverFn/ while the proxy hands it /_serverFn/, breaking every
 * server function.
 *
 * Asset URLs are a different matter — the build's `base` handles those, so the
 * app emits `/verification/assets/...` itself and the proxy has nothing to
 * patch.
 *
 * What is left is the two places where only the browser knows the real URL:
 * `router.tsx` reconciles the location through a client-only `rewrite`, and
 * `start.ts` prefixes server-function requests.
 */

/**
 * Sub-path the app is mounted under. Resolution order:
 *   1. VITE_SUB_PATH at build time (forced proxy build), else
 *   2. the browser's own location — the same build is served both at the
 *      workers.dev root and behind the staging.mmmc.pk reverse proxy under
 *      /verification, so the client adopts whichever prefix it was loaded
 *      from. SSR always renders unprefixed; the proxy rewrites HTML hrefs.
 */
const KNOWN_SUB_PATHS = ["/verification"];

function detectSubPath(): string {
  const fromEnv = (import.meta.env.VITE_SUB_PATH ?? "").replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    for (const prefix of KNOWN_SUB_PATHS) {
      if (path === prefix || path.startsWith(`${prefix}/`)) return prefix;
    }
  }
  return "";
}

export const SUB_PATH = detectSubPath();

/**
 * Browser URL -> router path. `/verification` -> `/`, and
 * `/verification/verify/abc` -> `/verify/abc`. A path that is not under the
 * sub-path is left alone, which is what the server always sees.
 */
export function stripSubPath({ url }: { url: URL }) {
  if (!SUB_PATH) return url;
  if (url.pathname === SUB_PATH) {
    url.pathname = "/";
  } else if (url.pathname.startsWith(`${SUB_PATH}/`)) {
    url.pathname = url.pathname.slice(SUB_PATH.length);
  }
  return url;
}

/**
 * Router path -> browser URL, the inverse of `stripSubPath`, so <Link> hrefs
 * keep the prefix and client-side navigation stays inside the sub-path.
 * Idempotent: an already-prefixed path is returned untouched.
 */
export function addSubPath({ url }: { url: URL }) {
  if (!SUB_PATH) return url;
  if (url.pathname !== SUB_PATH && !url.pathname.startsWith(`${SUB_PATH}/`)) {
    url.pathname = `${SUB_PATH}${url.pathname}`;
  }
  return url;
}
