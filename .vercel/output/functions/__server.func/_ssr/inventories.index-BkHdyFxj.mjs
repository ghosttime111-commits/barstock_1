import { j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate, L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, v as listInventoriesFn, w as createInventoryFn, B as Button } from "./barstock.functions-DEpRpfrC.mjs";
import { u as useQueryClient, a as useQuery, b as useMutation } from "../_libs/tanstack__react-query.mjs";
import { A as AppShell } from "./AppShell-PxePPgmF.mjs";
import { B as Badge } from "./badge-DzdCxTpW.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import "../_libs/seroval.mjs";
import { L as LoaderCircle, b as Plus, c as ClipboardList } from "../_libs/lucide-react.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "./server-B-fI4YJN.mjs";
import "node:async_hooks";
import "../_libs/h3-v2.mjs";
import "../_libs/rou3.mjs";
import "../_libs/srvx.mjs";
import "../_libs/zod.mjs";
import "../_libs/tanstack__query-core.mjs";
function InventoriesPage() {
  const {
    session
  } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listInventoriesFn);
  const create = useServerFn(createInventoryFn);
  const sessionToken = session?.session_token ?? null;
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["inventories", sessionToken],
    queryFn: () => list({
      data: {
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const createMut = useMutation({
    mutationFn: () => create({
      data: {
        session_token: sessionToken
      }
    }),
    onSuccess: (inv) => {
      qc.invalidateQueries({
        queryKey: ["inventories"]
      });
      navigate({
        to: "/inventories/$id",
        params: {
          id: inv.id
        }
      });
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Переучёты" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Все сессии переучёта вашего бара." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: () => createMut.mutate(), disabled: createMut.isPending, children: [
        createMut.isPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-4 animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "size-4" }),
        "Новый переучёт"
      ] })
    ] }),
    createMut.error && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-destructive", children: [
      "Ошибка:",
      " ",
      createMut.error instanceof Error ? createMut.error.message : String(createMut.error)
    ] }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка…" }),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error instanceof Error ? error.message : "Ошибка загрузки" }),
    data && data.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ClipboardList, { className: "mx-auto mb-3 size-8 opacity-60" }),
      "Переучётов пока нет. Создайте первый."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "grid gap-3", children: data?.map((inv) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/inventories/$id", params: {
      id: inv.id
    }, className: "flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/60 hover:bg-card/80", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: new Date(inv.created_at).toLocaleString("ru-RU", {
          dateStyle: "medium",
          timeStyle: "short"
        }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-muted-foreground", children: [
          inv.created_by_name ?? "—",
          " · позиций: ",
          inv.items_count
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: inv.status === "draft" || inv.status === "correction_required" ? "default" : "secondary", children: inventoryStatusLabel(inv.status) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-primary underline-offset-2 hover:underline", children: "Открыть →" })
      ] })
    ] }) }, inv.id)) })
  ] });
}
function inventoryStatusLabel(status) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}
const SplitComponent = () => /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { allow: ["bartender"], children: /* @__PURE__ */ jsxRuntimeExports.jsx(InventoriesPage, {}) });
export {
  SplitComponent as component
};
