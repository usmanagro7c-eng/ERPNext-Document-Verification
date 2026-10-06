// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    // The app is served under a sub-path, so every asset URL the build emits —
    // `?url` imports, CSS, the client entry, and Vite's own preload helper —
    // must carry the prefix. The proxy only rewrites href/src inside the HTML
    // it returns, so anything the bundle generates at runtime would otherwise
    // 404 against the ERPNext site at the domain root. Direct root hosting
    // (workers.dev, local dev) still works: src/server.ts strips the prefix
    // from incoming /verification/* requests before dispatching.
    base: "/verification/",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Pinned to "/" on purpose. TanStack Start would otherwise infer the router
    // basepath from `vite.base` above, but the proxy strips the sub-path before
    // the Worker sees the request: the Worker matches "/" and "/verify/:hash",
    // and it dispatches server functions on "/_serverFn/". Pinning it keeps
    // ROUTER_BASEPATH and SERVER_FN_BASE exactly as they were. `src/router.tsx`
    // and `src/start.ts` reconcile the sub-path in the browser instead.
    router: { basepath: "/" },
  },
});
