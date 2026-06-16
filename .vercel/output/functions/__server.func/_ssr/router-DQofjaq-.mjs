import { b as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { Q as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
import { c as createRouter, a as createRootRouteWithContext, u as useRouter, L as Link, O as Outlet, H as HeadContent, S as Scripts, b as createFileRoute, l as lazyRouteComponent } from "../_libs/tanstack__react-router.mjs";
import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
const appCss = "/assets/styles-DCK0I9M2.css";
function NotFoundComponent() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-7xl font-bold text-foreground", children: "404" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 text-xl font-semibold text-foreground", children: "Page not found" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "The page you're looking for doesn't exist or has been moved." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Link,
      {
        to: "/",
        className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        children: "Go home"
      }
    ) })
  ] }) });
}
function ErrorComponent({ error, reset }) {
  console.error(error);
  const router2 = useRouter();
  reactExports.useEffect(() => {
    console.error("Root route error", error);
  }, [error]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-xl font-semibold tracking-tight text-foreground", children: "This page didn't load" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Something went wrong on our end. You can try refreshing or head back home." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex flex-wrap justify-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => {
            router2.invalidate();
            reset();
          },
          className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          children: "Try again"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: "/",
          className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
          children: "Go home"
        }
      )
    ] })
  ] }) });
}
const Route$a = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BarStock" },
      { name: "description", content: "BarStock inventory management" },
      { name: "author", content: "BarStock" },
      { property: "og:title", content: "BarStock" },
      { property: "og:description", content: "BarStock inventory management" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" }
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss
      }
    ]
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent
});
function RootShell({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("head", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx(Scripts, {})
    ] })
  ] });
}
function RootComponent() {
  const { queryClient } = Route$a.useRouteContext();
  return /* @__PURE__ */ jsxRuntimeExports.jsx(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) });
}
const $$splitComponentImporter$9 = () => import("./reports-BFsOu0JM.mjs");
const Route$9 = createFileRoute("/reports")({
  component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
const $$splitComponentImporter$8 = () => import("./login-B6Riijy1.mjs");
const Route$8 = createFileRoute("/login")({
  head: () => ({
    meta: [{
      title: "Вход — BarStock"
    }, {
      name: "description",
      content: "Вход в BarStock."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
const $$splitComponentImporter$7 = () => import("./inventories-BFsOu0JM.mjs");
const Route$7 = createFileRoute("/inventories")({
  component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
const $$splitComponentImporter$6 = () => import("./admin-Cn8dG9ws.mjs");
const Route$6 = createFileRoute("/admin")({
  head: () => ({
    meta: [{
      title: "Управление — BarStock"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
const $$splitComponentImporter$5 = () => import("./index-Bsj1oO3U.mjs");
const Route$5 = createFileRoute("/")({
  head: () => ({
    meta: [{
      title: "BarStock — Переучёт бара"
    }, {
      name: "description",
      content: "BarStock: быстрый переучёт остатков в баре."
    }, {
      property: "og:title",
      content: "BarStock"
    }, {
      property: "og:description",
      content: "Переучёт бара без боли."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
const $$splitComponentImporter$4 = () => import("./reports.index-CBCpiikY.mjs");
const Route$4 = createFileRoute("/reports/")({
  head: () => ({
    meta: [{
      title: "Отчёты — BarStock"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
const $$splitComponentImporter$3 = () => import("./inventories.index-BkHdyFxj.mjs");
const Route$3 = createFileRoute("/inventories/")({
  head: () => ({
    meta: [{
      title: "Переучёты — BarStock"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
const $$splitComponentImporter$2 = () => import("./reports._id-B4lT6ZpY.mjs");
const Route$2 = createFileRoute("/reports/$id")({
  head: () => ({
    meta: [{
      title: "Отчёт по переучёту — BarStock"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
const $$splitComponentImporter$1 = () => import("./inventories._id-DXA3jkmj.mjs");
const Route$1 = createFileRoute("/inventories/$id")({
  head: () => ({
    meta: [{
      title: "Переучёт — BarStock"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const $$splitComponentImporter = () => import("./reports.expected._id-DhKMJHvi.mjs");
const Route = createFileRoute("/reports/expected/$id")({
  head: () => ({
    meta: [{
      title: "Учётные остатки — BarStock"
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const ReportsRoute = Route$9.update({
  id: "/reports",
  path: "/reports",
  getParentRoute: () => Route$a
});
const LoginRoute = Route$8.update({
  id: "/login",
  path: "/login",
  getParentRoute: () => Route$a
});
const InventoriesRoute = Route$7.update({
  id: "/inventories",
  path: "/inventories",
  getParentRoute: () => Route$a
});
const AdminRoute = Route$6.update({
  id: "/admin",
  path: "/admin",
  getParentRoute: () => Route$a
});
const IndexRoute = Route$5.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$a
});
const ReportsIndexRoute = Route$4.update({
  id: "/",
  path: "/",
  getParentRoute: () => ReportsRoute
});
const InventoriesIndexRoute = Route$3.update({
  id: "/",
  path: "/",
  getParentRoute: () => InventoriesRoute
});
const ReportsIdRoute = Route$2.update({
  id: "/$id",
  path: "/$id",
  getParentRoute: () => ReportsRoute
});
const InventoriesIdRoute = Route$1.update({
  id: "/$id",
  path: "/$id",
  getParentRoute: () => InventoriesRoute
});
const ReportsExpectedIdRoute = Route.update({
  id: "/expected/$id",
  path: "/expected/$id",
  getParentRoute: () => ReportsRoute
});
const InventoriesRouteChildren = {
  InventoriesIdRoute,
  InventoriesIndexRoute
};
const InventoriesRouteWithChildren = InventoriesRoute._addFileChildren(
  InventoriesRouteChildren
);
const ReportsRouteChildren = {
  ReportsIdRoute,
  ReportsIndexRoute,
  ReportsExpectedIdRoute
};
const ReportsRouteWithChildren = ReportsRoute._addFileChildren(ReportsRouteChildren);
const rootRouteChildren = {
  IndexRoute,
  AdminRoute,
  InventoriesRoute: InventoriesRouteWithChildren,
  LoginRoute,
  ReportsRoute: ReportsRouteWithChildren
};
const routeTree = Route$a._addFileChildren(rootRouteChildren)._addFileTypes();
const getRouter = () => {
  const queryClient = new QueryClient();
  const router2 = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0
  });
  return router2;
};
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  Route$2 as R,
  Route$1 as a,
  Route as b,
  router as r
};
