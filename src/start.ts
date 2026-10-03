import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { SUB_PATH } from "@/config/basePath";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Server functions are POSTed to a root-relative base ("/_serverFn/<id>"), so on
 * staging.mmmc.pk they would hit the ERPNext site at the domain root instead of
 * this app. Only the browser-side URL needs the sub-path: the proxy strips it
 * again, so the Worker still matches its own "/_serverFn/" and the server is
 * left untouched. `serverFns.fetch` is client-only by design.
 */
const SERVER_FN_BASE = process.env["TSS_SERVER_FN_BASE"] ?? "/_serverFn/";

const serverFnFetch: typeof fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith(SERVER_FN_BASE)) {
    return fetch(`${SUB_PATH}${input}`, init);
  }
  return fetch(input, init);
};

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
  serverFns: { fetch: serverFnFetch },
}));
