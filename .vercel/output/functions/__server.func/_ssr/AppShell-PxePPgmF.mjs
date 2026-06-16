import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate, L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, I as currentSessionFn, B as Button } from "./barstock.functions-DEpRpfrC.mjs";
import { a as useQuery } from "../_libs/tanstack__react-query.mjs";
import { u as useSession, s as setSession } from "./session-CK4wviFn.mjs";
import { W as Wine, k as LogOut } from "../_libs/lucide-react.mjs";
function AppShell({
  children,
  allow
}) {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const currentSession = useServerFn(currentSessionFn);
  const sessionToken = session?.session_token ?? null;
  const { data: freshSession } = useQuery({
    queryKey: ["current-session", sessionToken],
    queryFn: () => currentSession({ data: { session_token: sessionToken } }),
    enabled: !!sessionToken,
    staleTime: 3e4
  });
  reactExports.useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (allow && !allow.includes(session.user.role)) {
      const home = session.user.role === "accountant" ? "/reports" : "/inventories";
      navigate({ to: home, replace: true });
    }
  }, [ready, session, allow, navigate]);
  reactExports.useEffect(() => {
    if (!session || !freshSession) return;
    const changed = session.user.restaurant_id !== freshSession.user.restaurant_id || session.restaurant?.id !== freshSession.restaurant?.id || session.restaurant?.name !== freshSession.restaurant?.name || session.user.name !== freshSession.user.name || session.user.role !== freshSession.user.role;
    if (changed) setSession(freshSession);
  }, [freshSession, session]);
  if (!ready || !session || allow && !allow.includes(session.user.role)) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center text-muted-foreground", children: "Загрузка…" });
  }
  const isAccountant = session.user.role === "accountant";
  const homePath = isAccountant ? "/reports" : "/inventories";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-screen bg-background text-foreground", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "border-b border-border bg-card/60 backdrop-blur", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto flex max-w-5xl items-center justify-between px-4 py-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: homePath, className: "flex items-center gap-2 font-semibold tracking-tight", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Wine, { className: "size-5 text-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "BarStock" }),
        session.restaurant && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-2 text-sm font-normal text-muted-foreground", children: [
          "· ",
          session.restaurant.name
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
        isAccountant && /* @__PURE__ */ jsxRuntimeExports.jsx(
          Link,
          {
            to: "/admin",
            className: "font-medium text-muted-foreground transition hover:text-foreground",
            children: "Управление"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-muted-foreground", children: [
          session.user.name,
          " · ",
          isAccountant ? "бухгалтер" : "бармен"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            variant: "ghost",
            size: "sm",
            onClick: () => {
              setSession(null);
              navigate({ to: "/login", replace: true });
            },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "size-4" }),
              " Выйти"
            ]
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "mx-auto max-w-5xl px-4 py-6", children })
  ] });
}
export {
  AppShell as A
};
