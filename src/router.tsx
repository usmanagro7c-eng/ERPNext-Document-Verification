import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { addSubPath, stripSubPath } from "@/config/basePath";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // The proxy strips SUB_PATH before the Worker sees the request, so SSR
    // renders "/" while the address bar shows "/verification". Without this
    // rewrite the client resolves "/verification" against the route tree,
    // matches only __root__, and hydration aborts on an invariant — the page
    // paints once and is then torn down (a blank flash). Server-side the
    // rewrite is left off so nothing the Worker emits changes.
    ...(typeof document === "undefined"
      ? {}
      : { rewrite: { input: stripSubPath, output: addSubPath } }),
  });

  return router;
};
