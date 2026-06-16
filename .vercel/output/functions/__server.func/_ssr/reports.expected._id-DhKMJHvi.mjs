import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, F as listExpectedFn, G as upsertExpectedFn, H as bulkSetExpectedFn, B as Button } from "./barstock.functions-DEpRpfrC.mjs";
import { u as useQueryClient, a as useQuery, b as useMutation } from "../_libs/tanstack__react-query.mjs";
import { r as readSync, u as utils } from "../_libs/xlsx.mjs";
import { A as AppShell } from "./AppShell-PxePPgmF.mjs";
import { I as Input } from "./input-hnyhQ6XQ.mjs";
import { B as Badge } from "./badge-DzdCxTpW.mjs";
import { f as formatQuantity } from "./formatQuantity-NvJuCdW0.mjs";
import { p as parseQuantityExpression } from "./quantityExpression-DulvlSLe.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import { b as Route } from "./router-DQofjaq-.mjs";
import "../_libs/seroval.mjs";
import { d as ArrowLeft, j as Upload, S as Save, i as CircleCheck } from "../_libs/lucide-react.mjs";
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
function normalize(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
function ExpectedPage() {
  const {
    id
  } = Route.useParams();
  const {
    session
  } = useSession();
  const sessionToken = session?.session_token ?? null;
  const qc = useQueryClient();
  const listExp = useServerFn(listExpectedFn);
  const upsert = useServerFn(upsertExpectedFn);
  const bulk = useServerFn(bulkSetExpectedFn);
  const fileRef = reactExports.useRef(null);
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["expected", id],
    queryFn: () => listExp({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const expectedMap = reactExports.useMemo(() => {
    const m = /* @__PURE__ */ new Map();
    data?.expected.forEach((e) => m.set(e.product_id, Number(e.quantity)));
    return m;
  }, [data]);
  const [query, setQuery] = reactExports.useState("");
  const [preview, setPreview] = reactExports.useState(null);
  const [importing, setImporting] = reactExports.useState(false);
  const bulkMut = useMutation({
    mutationFn: (items) => bulk({
      data: {
        inventory_id: id,
        items,
        replace: true,
        session_token: sessionToken
      }
    }),
    onSuccess: () => {
      setPreview(null);
      qc.invalidateQueries({
        queryKey: ["expected", id]
      });
    }
  });
  if (isLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка…" });
  if (error || !data) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error instanceof Error ? error.message : "Ошибка загрузки" });
  }
  const {
    inventory,
    products
  } = data;
  const filtered = products.filter((p) => query.trim() ? p.name.toLowerCase().includes(query.trim().toLowerCase()) : true);
  async function handleFile(file) {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = readSync(buf, {
        type: "array"
      });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json(sheet, {
        defval: ""
      });
      const nameKeys = ["название", "наименование", "товар", "name", "product"];
      const qtyKeys = ["остаток", "количество", "кол-во", "qty", "quantity", "учёт"];
      const grouped = /* @__PURE__ */ new Map();
      for (const row of rows) {
        const keys = Object.keys(row);
        const nameKey = keys.find((k) => nameKeys.some((n) => k.toLowerCase().includes(n)));
        const qtyKey = keys.find((k) => qtyKeys.some((n) => k.toLowerCase().includes(n)));
        if (!nameKey || !qtyKey) continue;
        const name = String(row[nameKey] ?? "").trim();
        const rawQty = String(row[qtyKey] ?? "").replace(",", ".");
        const qty = Number(rawQty);
        if (!name || !Number.isFinite(qty)) continue;
        const key = normalize(name);
        const arr = grouped.get(key) ?? [];
        arr.push(qty);
        grouped.set(key, arr);
      }
      const productIndex = /* @__PURE__ */ new Map();
      products.forEach((p) => productIndex.set(normalize(p.name), {
        id: p.id,
        name: p.name
      }));
      const matched = [];
      const unmatched = [];
      const duplicates = [];
      for (const [key, qtys] of grouped) {
        const product = productIndex.get(key);
        const displayName = product?.name ?? key;
        if (qtys.length > 1) {
          duplicates.push({
            name: displayName,
            quantities: qtys
          });
        }
        const qty = qtys[qtys.length - 1];
        if (product) {
          matched.push({
            product_id: product.id,
            name: product.name,
            quantity: qty
          });
        } else {
          unmatched.push({
            name: displayName,
            quantity: qty
          });
        }
      }
      setPreview({
        matched,
        unmatched,
        duplicates
      });
    } catch (err) {
      alert("Ошибка чтения файла: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/reports/$id", params: {
        id
      }, className: "mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "size-4" }),
        " К отчёту"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "text-2xl font-semibold tracking-tight", children: [
        "Учётные остатки · переучёт от",
        " ",
        new Date(inventory.created_at).toLocaleString("ru-RU", {
          dateStyle: "medium",
          timeStyle: "short"
        })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Заполните вручную или импортируйте Excel. После сохранения отчёт автоматически посчитает расхождения = факт − учёт." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-card p-4 space-y-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: "Импорт из Excel" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-muted-foreground", children: [
            "Столбцы: ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "Название" }),
            " и ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("code", { children: "Остаток" }),
            " (первая строка — заголовки)."
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "secondary", onClick: () => fileRef.current?.click(), disabled: importing, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { className: "size-4" }),
          " ",
          importing ? "Чтение…" : "Выбрать .xlsx"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { ref: fileRef, type: "file", accept: ".xlsx,.xls", className: "hidden", onChange: (e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        } })
      ] }),
      preview && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3 border-t border-border pt-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-2 text-xs", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { variant: "secondary", children: [
            "Найдено: ",
            preview.matched.length
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { className: "bg-destructive text-destructive-foreground", children: [
            "Не найдено: ",
            preview.unmatched.length
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Badge, { className: "bg-amber-500 text-black", children: [
            "Дубликаты: ",
            preview.duplicates.length
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PreviewList, { title: "Найденные товары", items: preview.matched.map((m) => `${m.name} → ${formatQuantity(m.quantity)}`) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PreviewList, { title: "Не найдено в каталоге", items: preview.unmatched.map((m) => `${m.name} → ${formatQuantity(m.quantity)}`) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PreviewList, { title: "Дубликаты (взято последнее значение)", items: preview.duplicates.map((d) => `${d.name}: ${d.quantities.map(formatQuantity).join(", ")}`) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: () => bulkMut.mutate(preview.matched.map((m) => ({
            product_id: m.product_id,
            quantity: m.quantity
          }))), disabled: bulkMut.isPending || preview.matched.length === 0, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "size-4" }),
            " Сохранить ",
            preview.matched.length,
            " позиций"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", onClick: () => setPreview(null), children: "Отмена" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { placeholder: "Поиск товара…", value: query, onChange: (e) => setQuery(e.target.value) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card", children: filtered.map((p) => /* @__PURE__ */ jsxRuntimeExports.jsx(ExpectedRow, { product: p, initial: expectedMap.get(p.id), onSave: async (qty) => {
        await upsert({
          data: {
            inventory_id: id,
            product_id: p.id,
            quantity: qty,
            session_token: sessionToken
          }
        });
        qc.invalidateQueries({
          queryKey: ["expected", id]
        });
      } }, p.id)) })
    ] })
  ] });
}
function PreviewList({
  title,
  items
}) {
  if (items.length === 0) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("details", { className: "rounded-md border border-border bg-background/40 p-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("summary", { className: "cursor-pointer text-sm font-medium", children: [
      title,
      " (",
      items.length,
      ")"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-2 max-h-48 overflow-auto text-xs text-muted-foreground space-y-0.5", children: items.map((s, i) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: s }, i)) })
  ] });
}
function ExpectedRow({
  product,
  initial,
  onSave
}) {
  const [value, setValue] = reactExports.useState(initial !== void 0 ? String(initial) : "");
  const [saving, setSaving] = reactExports.useState(false);
  const [saved, setSaved] = reactExports.useState(initial !== void 0);
  const [error, setError] = reactExports.useState(null);
  async function commit() {
    let num;
    try {
      num = parseQuantityExpression(value);
    } catch {
      setError("Введите число от 0");
      return;
    }
    if (initial !== void 0 && num === initial) {
      setSaved(true);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(num);
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center justify-between gap-4 px-4 py-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate font-medium", children: product.name }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: product.unit ?? "шт" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { inputMode: "decimal", className: "w-24 text-right", value, disabled: saving, onChange: (e) => {
      setValue(e.target.value);
      setSaved(false);
      setError(null);
    }, onBlur: commit, onKeyDown: (e) => {
      if (e.key === "Enter") e.target.blur();
    } }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-28 text-xs", children: [
      saving && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: "Сохранение..." }),
      !saving && saved && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 text-primary", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "size-3" }),
        " сохранено"
      ] }),
      !saving && error && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive", children: error })
    ] })
  ] });
}
const SplitComponent = () => /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { allow: ["accountant"], children: /* @__PURE__ */ jsxRuntimeExports.jsx(ExpectedPage, {}) });
export {
  SplitComponent as component
};
