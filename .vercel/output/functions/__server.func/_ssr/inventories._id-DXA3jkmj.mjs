import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, A as getInventoryFn, C as getInventoryEntriesFn, D as upsertItemFn, E as closeInventoryFn, B as Button, c as cn } from "./barstock.functions-DEpRpfrC.mjs";
import { u as useQueryClient, a as useQuery, b as useMutation } from "../_libs/tanstack__react-query.mjs";
import { A as AppShell } from "./AppShell-PxePPgmF.mjs";
import { I as Input } from "./input-hnyhQ6XQ.mjs";
import { B as Badge } from "./badge-DzdCxTpW.mjs";
import { D as Drawer$1 } from "../_libs/vaul.mjs";
import { f as formatQuantity } from "./formatQuantity-NvJuCdW0.mjs";
import { p as parseQuantityExpression } from "./quantityExpression-DulvlSLe.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import { a as Route$1 } from "./router-DQofjaq-.mjs";
import "../_libs/seroval.mjs";
import { d as ArrowLeft, e as Lock, f as Search, g as ChevronDown, h as ChevronRight, i as CircleCheck } from "../_libs/lucide-react.mjs";
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
import "../_libs/radix-ui__react-dialog.mjs";
import "../_libs/radix-ui__primitive.mjs";
import "../_libs/radix-ui__react-context.mjs";
import "../_libs/radix-ui__react-id.mjs";
import "../_libs/@radix-ui/react-use-layout-effect+[...].mjs";
import "../_libs/@radix-ui/react-use-controllable-state+[...].mjs";
import "../_libs/@radix-ui/react-dismissable-layer+[...].mjs";
import "../_libs/radix-ui__react-primitive.mjs";
import "../_libs/@radix-ui/react-use-callback-ref+[...].mjs";
import "../_libs/@radix-ui/react-use-escape-keydown+[...].mjs";
import "../_libs/radix-ui__react-focus-scope.mjs";
import "../_libs/radix-ui__react-portal.mjs";
import "../_libs/radix-ui__react-presence.mjs";
import "../_libs/radix-ui__react-focus-guards.mjs";
import "../_libs/react-remove-scroll.mjs";
import "tslib";
import "../_libs/react-remove-scroll-bar.mjs";
import "../_libs/react-style-singleton.mjs";
import "../_libs/get-nonce.mjs";
import "../_libs/use-sidecar.mjs";
import "../_libs/use-callback-ref.mjs";
import "../_libs/aria-hidden.mjs";
const Drawer = ({
  shouldScaleBackground = true,
  ...props
}) => /* @__PURE__ */ jsxRuntimeExports.jsx(Drawer$1.Root, { shouldScaleBackground, ...props });
Drawer.displayName = "Drawer";
const DrawerPortal = Drawer$1.Portal;
const DrawerOverlay = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Drawer$1.Overlay,
  {
    ref,
    className: cn("fixed inset-0 z-50 bg-black/80", className),
    ...props
  }
));
DrawerOverlay.displayName = Drawer$1.Overlay.displayName;
const DrawerContent = reactExports.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DrawerPortal, { children: [
  /* @__PURE__ */ jsxRuntimeExports.jsx(DrawerOverlay, {}),
  /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Drawer$1.Content,
    {
      ref,
      className: cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        className
      ),
      ...props,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" }),
        children
      ]
    }
  )
] }));
DrawerContent.displayName = "DrawerContent";
const DrawerHeader = ({ className, ...props }) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("grid gap-1.5 p-4 text-center sm:text-left", className), ...props });
DrawerHeader.displayName = "DrawerHeader";
const DrawerTitle = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Drawer$1.Title,
  {
    ref,
    className: cn("text-lg font-semibold leading-none tracking-tight", className),
    ...props
  }
));
DrawerTitle.displayName = Drawer$1.Title.displayName;
const DrawerDescription = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Drawer$1.Description,
  {
    ref,
    className: cn("text-sm text-muted-foreground", className),
    ...props
  }
));
DrawerDescription.displayName = Drawer$1.Description.displayName;
function InventoryDetail() {
  const {
    id
  } = Route$1.useParams();
  const {
    session
  } = useSession();
  const sessionToken = session?.session_token ?? null;
  const qc = useQueryClient();
  const getInv = useServerFn(getInventoryFn);
  const getEntries = useServerFn(getInventoryEntriesFn);
  const upsert = useServerFn(upsertItemFn);
  const close = useServerFn(closeInventoryFn);
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["inventory", id],
    queryFn: () => getInv({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const closeMut = useMutation({
    mutationFn: () => close({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: () => qc.invalidateQueries({
      queryKey: ["inventory", id]
    })
  });
  const [query, setQuery] = reactExports.useState("");
  const [categoryId, setCategoryId] = reactExports.useState("all");
  const [expandedCategories, setExpandedCategories] = reactExports.useState({});
  const [historyProduct, setHistoryProduct] = reactExports.useState(null);
  const itemsMap = reactExports.useMemo(() => {
    const m = /* @__PURE__ */ new Map();
    data?.items.forEach((it) => m.set(it.product_id, Number(it.quantity)));
    return m;
  }, [data]);
  const entryCountsMap = reactExports.useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    data?.entry_counts?.forEach((entry) => {
      map.set(entry.product_id, Number(entry.count));
    });
    return map;
  }, [data]);
  const historyQuery = useQuery({
    queryKey: ["inventory-entries", id, historyProduct?.id],
    queryFn: () => getEntries({
      data: {
        inventory_id: id,
        product_id: historyProduct.id,
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken && !!historyProduct
  });
  const filtered = reactExports.useMemo(() => {
    const prods = data?.products ?? [];
    const q = query.trim().toLowerCase();
    return prods.filter((p) => {
      if (categoryId !== "all" && p.category_id !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, query, categoryId]);
  const categoryGroups = reactExports.useMemo(() => {
    const categoryById = new Map((data?.categories ?? []).map((c) => [c.id, c.name]));
    const groups = /* @__PURE__ */ new Map();
    filtered.forEach((product) => {
      const id2 = product.category_id ?? "uncategorized";
      const group = groups.get(id2) ?? {
        id: id2,
        name: categoryById.get(id2) ?? "Без категории",
        products: [],
        filled: 0
      };
      group.products.push(product);
      if (itemsMap.has(product.id)) group.filled += 1;
      groups.set(id2, group);
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [data, filtered, itemsMap]);
  const expandedKey = `barstock.inventory.${id}.expandedCategories`;
  reactExports.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(expandedKey);
      if (raw) setExpandedCategories(JSON.parse(raw));
    } catch {
      setExpandedCategories({});
    }
  }, [expandedKey]);
  function toggleCategory(id2) {
    setExpandedCategories((prev) => {
      const next = {
        ...prev,
        [id2]: !(prev[id2] ?? true)
      };
      window.localStorage.setItem(expandedKey, JSON.stringify(next));
      return next;
    });
  }
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка…" });
  }
  if (error || !data) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error instanceof Error ? error.message : "Не удалось загрузить переучёт" });
  }
  const {
    inventory,
    categories,
    products
  } = data;
  const canEdit = inventory.status === "draft" || inventory.status === "correction_required";
  const counted = itemsMap.size;
  const missingCount = Math.max(products.length - counted, 0);
  function closeWithMissingCheck() {
    closeMut.mutate();
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/inventories", className: "mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "size-4" }),
          " К списку"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "text-2xl font-semibold tracking-tight", children: [
          "Переучёт от",
          " ",
          new Date(inventory.created_at).toLocaleString("ru-RU", {
            dateStyle: "medium",
            timeStyle: "short"
          })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted-foreground", children: [
          "Посчитано: ",
          counted,
          " из ",
          products.length,
          " позиций"
        ] }),
        canEdit && missingCount > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Незаполненные позиции при закрытии сохранятся как 0." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: canEdit ? "default" : "secondary", children: inventoryStatusLabel(inventory.status) }),
        canEdit && /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: closeWithMissingCheck, disabled: closeMut.isPending, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Lock, { className: "size-4" }),
          " Закрыть"
        ] })
      ] })
    ] }),
    closeMut.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: closeMut.error instanceof Error ? closeMut.error.message : "Не удалось закрыть переучёт" }),
    inventory.status === "correction_required" && inventory.correction_comment && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-amber-500/40 bg-amber-500/10 p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm font-medium", children: "Комментарий бухгалтера" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 whitespace-pre-wrap text-sm text-muted-foreground", children: inventory.correction_comment })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex-1 min-w-[220px]", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { placeholder: "Поиск товара…", value: query, onChange: (e) => setQuery(e.target.value), className: "pl-9" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-1.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CategoryPill, { active: categoryId === "all", onClick: () => setCategoryId("all"), children: "Все" }),
        categories.map((c) => /* @__PURE__ */ jsxRuntimeExports.jsx(CategoryPill, { active: categoryId === c.id, onClick: () => setCategoryId(c.id), children: c.name }, c.id))
      ] })
    ] }),
    products.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground", children: [
      "В базе нет товаров. Добавьте их в таблицу ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "products" }),
      "."
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: categoryGroups.map((group) => /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "overflow-hidden rounded-xl border border-border bg-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: () => toggleCategory(group.id), className: "flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/40", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex min-w-0 items-center gap-2", children: [
          expandedCategories[group.id] ?? true ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "size-4 shrink-0 text-muted-foreground" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "size-4 shrink-0 text-muted-foreground" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate font-medium", children: group.name })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { variant: group.filled === group.products.length ? "secondary" : "outline", className: "shrink-0", children: [
          group.filled,
          "/",
          group.products.length
        ] })
      ] }),
      (expandedCategories[group.id] ?? true) && /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-border", children: group.products.map((p) => /* @__PURE__ */ jsxRuntimeExports.jsx(ItemRow, { product: p, initial: itemsMap.get(p.id), historyCount: entryCountsMap.get(p.id) ?? 0, onOpenHistory: () => setHistoryProduct({
        id: p.id,
        name: p.name
      }), disabled: !canEdit, onSave: async (qty, entryType) => {
        const result = await upsert({
          data: {
            inventory_id: id,
            product_id: p.id,
            quantity: qty,
            entry_type: entryType,
            session_token: sessionToken
          }
        });
        qc.invalidateQueries({
          queryKey: ["inventory", id]
        });
        return Number(result.quantity);
      } }, p.id)) })
    ] }, group.id)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Drawer, { open: !!historyProduct, onOpenChange: (open) => !open && setHistoryProduct(null), children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DrawerContent, { className: "max-h-[85vh]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DrawerHeader, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DrawerTitle, { children: "История изменений" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DrawerDescription, { children: historyProduct?.name ?? "" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-4 pb-6", children: [
        historyQuery.isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка..." }),
        historyQuery.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: historyQuery.error instanceof Error ? historyQuery.error.message : "Не удалось загрузить историю" }),
        historyQuery.data && historyQuery.data.entries.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Истории пока нет." }),
        historyQuery.data && historyQuery.data.entries.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-border rounded-lg border border-border", children: historyQuery.data.entries.map((entry) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center gap-3 px-3 py-2 text-sm", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-12 text-muted-foreground", children: new Date(entry.created_at).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit"
            }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-0 flex-1 truncate", children: entry.user_name ?? "Бармен" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium tabular-nums", children: [
              entry.entry_type === "set" ? "=" : "+",
              formatQuantity(Number(entry.quantity))
            ] })
          ] }, entry.id)) }),
          historyQuery.data.total > 5 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Показаны последние 5 изменений." })
        ] })
      ] })
    ] }) })
  ] });
}
function inventoryStatusLabel(status) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}
function CategoryPill({
  active,
  onClick,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick, className: "rounded-full border px-3 py-1 text-xs transition " + (active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"), children });
}
function ItemRow({
  product,
  initial,
  historyCount,
  onOpenHistory,
  disabled,
  onSave
}) {
  const [value, setValue] = reactExports.useState("");
  const [mode, setMode] = reactExports.useState("add");
  const [error, setError] = reactExports.useState(null);
  const [saving, setSaving] = reactExports.useState(false);
  const [saved, setSaved] = reactExports.useState(initial !== void 0);
  const [displayQuantity, setDisplayQuantity] = reactExports.useState(initial ?? 0);
  const currentQuantity = displayQuantity;
  reactExports.useEffect(() => {
    setDisplayQuantity(initial ?? 0);
    setValue(mode === "fact" && initial !== void 0 ? String(initial) : "");
    setSaved(initial !== void 0);
    setError(null);
  }, [initial, mode]);
  const preview = reactExports.useMemo(() => {
    if (!value.trim()) return null;
    try {
      const parsed = parseQuantityExpression(value);
      if (mode === "add") return currentQuantity + parsed;
      return value.includes("+") ? parsed : null;
    } catch {
      return null;
    }
  }, [currentQuantity, mode, value]);
  function changeMode(nextMode) {
    setMode(nextMode);
    setError(null);
    setSaved(initial !== void 0);
    setValue(nextMode === "fact" && initial !== void 0 ? String(initial) : "");
  }
  async function commit() {
    if (disabled || saving) return;
    if (!value.trim()) {
      setError(null);
      setSaved(initial !== void 0);
      return;
    }
    let entered;
    try {
      entered = parseQuantityExpression(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Некорректное выражение");
      return;
    }
    const nextQuantity = mode === "add" ? currentQuantity + entered : entered;
    const normalizedQuantity = Math.round(nextQuantity * 1e12) / 1e12;
    if (initial !== void 0 && normalizedQuantity === initial) {
      setValue(mode === "add" ? "" : String(normalizedQuantity));
      setError(null);
      setSaved(true);
      return;
    }
    setSaving(true);
    try {
      const savedQuantity = await onSave(entered, mode === "add" ? "add" : "set");
      setDisplayQuantity(savedQuantity);
      setValue(mode === "add" ? "" : String(savedQuantity));
      setError(null);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate font-medium", children: product.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: product.unit ?? "шт" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 text-xs text-muted-foreground", children: [
        "Итог:",
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: formatQuantity(currentQuantity) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", onClick: onOpenHistory, className: "ml-2 inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground transition hover:text-foreground", "aria-label": "Открыть историю изменений", children: [
          "🕒",
          historyCount
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col gap-2 sm:items-end", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", disabled, onClick: () => changeMode("add"), className: "min-h-10 rounded-md px-3 text-sm font-medium transition " + (mode === "add" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"), children: "+ Добавить" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", disabled, onClick: () => changeMode("fact"), className: "min-h-10 rounded-md px-3 text-sm font-medium transition " + (mode === "fact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background hover:text-foreground"), children: "Факт" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-[3rem] text-right", children: [
          preview !== null && !error && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-1 text-xs text-muted-foreground", children: [
            "Итого: ",
            formatQuantity(preview)
          ] }),
          error && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-1 max-w-32 text-xs text-destructive", children: error })
        ] }),
        saved && !saving && !error && /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "mt-3 size-4 text-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { inputMode: "decimal", className: "h-11 w-full min-w-32 text-right text-base sm:w-32", value, disabled, placeholder: mode === "add" ? "0.5" : "0", onChange: (e) => {
          setValue(e.target.value);
          setError(null);
          setSaved(false);
        }, onBlur: commit, onKeyDown: (e) => {
          if (e.key === "Enter") e.target.blur();
        } })
      ] })
    ] })
  ] });
}
const SplitComponent = () => /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { allow: ["bartender"], children: /* @__PURE__ */ jsxRuntimeExports.jsx(InventoryDetail, {}) });
export {
  SplitComponent as component
};
