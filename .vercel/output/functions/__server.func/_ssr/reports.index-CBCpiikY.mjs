import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, s as listClosedInventoriesFn, a as listRestaurantsFn, t as getMonthlyArchiveFn, B as Button } from "./barstock.functions-DEpRpfrC.mjs";
import { a as useQuery, b as useMutation } from "../_libs/tanstack__react-query.mjs";
import { A as AppShell } from "./AppShell-PxePPgmF.mjs";
import { B as Badge } from "./badge-DzdCxTpW.mjs";
import { I as Input } from "./input-hnyhQ6XQ.mjs";
import { u as utils, w as writeFileSync } from "../_libs/xlsx.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import "../_libs/seroval.mjs";
import { D as Download, C as ClipboardCheck } from "../_libs/lucide-react.mjs";
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
function translateStatus(status) {
  if (status === "shortage") return "недостача";
  if (status === "surplus") return "излишек";
  return "совпадает";
}
function safeSheetName(name) {
  return name.replace(/\[/g, " ").replace(/\]/g, " ").replace(/[\\/*?:]/g, " ").slice(0, 31).trim() || "Переучёт";
}
function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
function formatDateForFile(value) {
  return new Date(value).toISOString().slice(0, 10);
}
function safeFilePart(value) {
  return value.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Archive";
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function moneyValue(row) {
  return numberValue(row.money_diff ?? row.diff * numberValue(row.unit_price));
}
function formatMoney(value) {
  return (Object.is(value, -0) ? 0 : value).toFixed(2);
}
function exportMonthlyArchiveToExcel(archive) {
  const categoryById = new Map(archive.categories.map((category) => [category.id, category.name]));
  const workbook = utils.book_new();
  const restaurants = Array.from(
    new Set(
      archive.inventories.map((report) => report.restaurant?.name?.trim()).filter((name) => Boolean(name))
    )
  );
  const archiveRestaurantName = restaurants.length === 1 ? restaurants[0] : restaurants.length > 1 ? "Все рестораны" : "Архив";
  const summaryRows = [
    [
      "Дата переучёта",
      "Ресторан",
      "Количество позиций",
      "Количество расхождений",
      "Сумма недостач",
      "Сумма излишков",
      "Итого BYN"
    ],
    ...archive.inventories.map((report) => {
      const shortageSum = report.rows.filter((row) => row.status === "shortage").reduce((sum, row) => sum + Math.abs(numberValue(row.diff)), 0);
      const surplusSum = report.rows.filter((row) => row.status === "surplus").reduce((sum, row) => sum + numberValue(row.diff), 0);
      const moneySum = report.rows.reduce((sum, row) => sum + moneyValue(row), 0);
      return [
        formatDate(report.inventory.created_at),
        report.restaurant?.name ?? "",
        report.rows.length,
        report.rows.filter((row) => row.status !== "match").length,
        shortageSum,
        surplusSum,
        formatMoney(moneySum)
      ];
    })
  ];
  const summarySheet = utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 }
  ];
  utils.book_append_sheet(workbook, summarySheet, "Сводка");
  archive.inventories.forEach((report, index) => {
    const restaurantName = report.restaurant?.name ?? "";
    const rows = [
      ["Ресторан:", restaurantName],
      ["Дата переучёта:", formatDate(report.inventory.created_at)],
      ["Статус:", report.inventory.status],
      [],
      [
        "Товар",
        "Категория",
        "Единица",
        "Факт",
        "Учёт",
        "Разница",
        "Цена за ед., BYN",
        "Сумма, BYN",
        "Статус"
      ],
      ...report.rows.map((row) => [
        row.name,
        row.category_id ? categoryById.get(row.category_id) ?? "" : "",
        row.unit ?? "",
        row.actual,
        row.expected_set === false || row.expected === null ? "" : row.expected,
        row.diff,
        formatMoney(numberValue(row.unit_price)),
        formatMoney(moneyValue(row)),
        translateStatus(row.status)
      ])
    ];
    const sheet = utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 36 },
      { wch: 24 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 }
    ];
    utils.book_append_sheet(
      workbook,
      sheet,
      safeSheetName(
        `${index + 1} ${restaurantName} ${new Date(report.inventory.created_at).toLocaleDateString("ru-RU")}`
      )
    );
  });
  const firstInventoryDate = archive.inventories[0]?.inventory.created_at;
  const fileDate = firstInventoryDate ? formatDateForFile(firstInventoryDate) : archive.month;
  writeFileSync(workbook, `BarStock_${safeFilePart(archiveRestaurantName)}_${fileDate}.xlsx`);
}
function ReportsListPage() {
  const {
    session
  } = useSession();
  const list = useServerFn(listClosedInventoriesFn);
  const listRestaurants = useServerFn(listRestaurantsFn);
  const getMonthlyArchive = useServerFn(getMonthlyArchiveFn);
  const [restaurantId, setRestaurantId] = reactExports.useState("all");
  const [archiveMonth, setArchiveMonth] = reactExports.useState(() => (/* @__PURE__ */ new Date()).toISOString().slice(0, 7));
  const [archiveRestaurantId, setArchiveRestaurantId] = reactExports.useState("all");
  const sessionToken = session?.session_token ?? null;
  const {
    data: restaurants = []
  } = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => listRestaurants({
      data: {
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["reports", restaurantId],
    queryFn: () => list({
      data: {
        restaurant_id: restaurantId === "all" ? null : restaurantId,
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const archiveMutation = useMutation({
    mutationFn: () => getMonthlyArchive({
      data: {
        month: archiveMonth,
        restaurant_id: archiveRestaurantId === "all" ? null : archiveRestaurantId,
        session_token: sessionToken
      }
    }),
    onSuccess: (archive) => exportMonthlyArchiveToExcel(archive)
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Отчёты по переучётам" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Все закрытые переучёты ресторанов." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "grid gap-1 text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: "Ресторан" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: restaurantId, onChange: (e) => setRestaurantId(e.target.value), className: "h-10 rounded-md border border-input bg-background px-3 text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "Все рестораны" }),
          restaurants.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: r.id, children: r.name }, r.id))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl border border-border bg-card p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "Экспорт архива" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Скачайте все закрытые переучёты за выбранный месяц." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 flex flex-col gap-3 sm:flex-row sm:items-end", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "grid gap-1 text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: "Месяц" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "month", value: archiveMonth, onChange: (event) => setArchiveMonth(event.target.value), className: "w-full sm:w-44" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "grid gap-1 text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: "Ресторан" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: archiveRestaurantId, onChange: (event) => setArchiveRestaurantId(event.target.value), className: "h-10 rounded-md border border-input bg-background px-3 text-sm", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "Все рестораны" }),
            restaurants.map((restaurant) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: restaurant.id, children: restaurant.name }, restaurant.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", disabled: !archiveMonth || archiveMutation.isPending, onClick: () => archiveMutation.mutate(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "size-4" }),
          archiveMutation.isPending ? "Подготовка..." : "Скачать архив Excel"
        ] })
      ] }),
      archiveMutation.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm text-destructive", children: archiveMutation.error instanceof Error ? archiveMutation.error.message : "Не удалось скачать архив" })
    ] }),
    isLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка…" }),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error instanceof Error ? error.message : "Ошибка загрузки" }),
    data && data.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ClipboardCheck, { className: "mx-auto mb-3 size-8 opacity-60" }),
      "Закрытых переучётов пока нет."
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "grid gap-3", children: data?.map((inv) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/reports/$id", params: {
      id: inv.id
    }, className: "flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/60 hover:bg-card/80", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: new Date(inv.created_at).toLocaleString("ru-RU", {
          dateStyle: "medium",
          timeStyle: "short"
        }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-muted-foreground", children: [
          inv.restaurant_name ?? "Ресторан не указан",
          " · ",
          inv.created_by_name ?? "—",
          " · позиций: ",
          inv.items_count
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: inv.status === "correction_required" ? "default" : "secondary", children: inventoryStatusLabel(inv.status) })
    ] }) }, inv.id)) })
  ] });
}
function inventoryStatusLabel(status) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}
const SplitComponent = () => /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { allow: ["accountant"], children: /* @__PURE__ */ jsxRuntimeExports.jsx(ReportsListPage, {}) });
export {
  SplitComponent as component
};
