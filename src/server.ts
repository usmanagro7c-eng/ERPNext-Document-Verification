import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// The build emits /verification/-prefixed asset URLs (see vite.config.ts). On
// staging the proxy strips that prefix before the Worker sees the request, but
// on workers.dev / local dev the prefixed URLs arrive as-is: the assets router
// finds nothing under /verification/ and falls through to this Worker. Strip
// the prefix here and dispatch the unprefixed path — static files from the
// ASSETS binding, everything else through the SSR handler — so one build
// serves both mounts.
const SUB_PATH_PREFIX = "/verification";

function stripPrefix(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname !== SUB_PATH_PREFIX && !url.pathname.startsWith(`${SUB_PATH_PREFIX}/`)) {
    return request;
  }
  url.pathname =
    url.pathname === SUB_PATH_PREFIX ? "/" : url.pathname.slice(SUB_PATH_PREFIX.length);
  return new Request(url, request);
}

type CfEnv = { ASSETS?: { fetch: typeof fetch } };

// nitro's cloudflare entry stores the bindings on globalThis.__env__ and calls
// this SSR service as fetch(req) only, so the env argument is undefined here.
function getBindings(env: unknown): CfEnv {
  return ((env as CfEnv | undefined) ?? (globalThis as { __env__?: CfEnv }).__env__ ?? {}) as CfEnv;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const stripped = stripPrefix(request);
      if (stripped !== request) {
        const assets = getBindings(env).ASSETS;
        if (assets) {
          const assetResponse = await assets.fetch(stripped);
          if (assetResponse.status !== 404) return assetResponse;
        }
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(stripped, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
