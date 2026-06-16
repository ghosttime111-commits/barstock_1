import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { d as useNavigate, L as Link } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, x as getInventoryReportFn, y as deleteInventoryFn, z as requestInventoryCorrectionFn, B as Button, c as cn } from "./barstock.functions-DEpRpfrC.mjs";
import { u as useQueryClient, a as useQuery, b as useMutation } from "../_libs/tanstack__react-query.mjs";
import { A as AppShell } from "./AppShell-PxePPgmF.mjs";
import { B as Badge } from "./badge-DzdCxTpW.mjs";
import { u as utils, w as writeFileSync } from "../_libs/xlsx.mjs";
import { f as formatQuantity } from "./formatQuantity-NvJuCdW0.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import { R as Root, P as Portal, C as Content, a as Close, T as Title, D as Description, O as Overlay } from "../_libs/radix-ui__react-dialog.mjs";
import { R as Route$2 } from "./router-DQofjaq-.mjs";
import "../_libs/seroval.mjs";
import { d as ArrowLeft, F as FileSpreadsheet, D as Download, R as RotateCcw, T as Trash2, X } from "../_libs/lucide-react.mjs";
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
const titleRowIndex = 0;
const metaStartRowIndex = 2;
const tableHeaderRowIndex = 6;
const tableColumnCount = 10;
const thinBlackBorder = {
  top: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } }
};
const titleStyle = {
  font: { bold: true, sz: 16 },
  alignment: { horizontal: "center", vertical: "center" }
};
const metaLabelStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: "E7E6E6" } },
  border: thinBlackBorder
};
const metaValueStyle = {
  border: thinBlackBorder
};
const headerStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: "E7E6E6" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: thinBlackBorder
};
const tableCellStyle = {
  border: thinBlackBorder,
  alignment: { vertical: "center", wrapText: true }
};
const shortageRowStyle = {
  ...tableCellStyle,
  fill: { fgColor: { rgb: "FCE4D6" } }
};
const surplusRowStyle = {
  ...tableCellStyle,
  fill: { fgColor: { rgb: "E2F0D9" } }
};
const summaryLabelStyle = {
  font: { bold: true }
};
function formatDateForFile(date) {
  return date.toISOString().slice(0, 10);
}
function safeFilePart(value) {
  return value.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "") || "Restaurant";
}
function translateInventoryStatus(status) {
  if (status === "draft") return "Черновик";
  if (status === "closed" || status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}
function translateDiscrepancyStatus(status) {
  if (status === "shortage") return "недостача";
  if (status === "surplus") return "излишек";
  return "совпадает";
}
function getRowStyle(status) {
  if (status === "shortage") return shortageRowStyle;
  if (status === "surplus") return surplusRowStyle;
  return tableCellStyle;
}
function getCellTextLength(value) {
  return String(value ?? "").length;
}
function getAutoWidth(values, min = 10, max = 40) {
  const longest = values.reduce(
    (width, value) => Math.max(width, getCellTextLength(value)),
    min
  );
  return Math.min(Math.max(longest + 2, min), max);
}
function formatMoney$1(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00";
  return (Object.is(value, -0) ? 0 : value).toFixed(2);
}
function applyCellStyle(worksheet, row, column, style) {
  const cellAddress = utils.encode_cell({ r: row, c: column });
  const cell = worksheet[cellAddress];
  if (cell) cell.s = style;
}
function exportInventoryToExcel(report) {
  const date = new Date(report.inventory.created_at);
  const categoryById = new Map(report.categories.map((category) => [category.id, category.name]));
  const restaurantName = report.restaurant?.name ?? "Ресторан";
  const rows = report.rows.map((row) => ({
    ...row,
    categoryName: row.category_id ? categoryById.get(row.category_id) ?? "" : "",
    expectedValue: row.expected_set === false || row.expected === null ? "" : row.expected,
    unitPriceValue: formatMoney$1(Number(row.unit_price ?? 0)),
    moneyDiffValue: formatMoney$1(Number(row.money_diff ?? 0)),
    statusText: translateDiscrepancyStatus(row.status),
    commentText: row.comment ?? ""
  }));
  const totals = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "shortage") acc.shortage += 1;
      if (row.status === "surplus") acc.surplus += 1;
      if (row.status === "match") acc.match += 1;
      acc.money += Number(row.money_diff ?? 0);
      return acc;
    },
    { total: 0, shortage: 0, surplus: 0, match: 0, money: 0 }
  );
  const tableHeaders = [
    "Категория",
    "Наименование товара",
    "Единица измерения",
    "Фактический остаток",
    "Учётный остаток",
    "Разница",
    "Цена за ед., BYN",
    "Сумма, BYN",
    "Статус расхождения",
    "Комментарий бухгалтера"
  ];
  const tableRows = rows.map((row) => [
    row.categoryName,
    row.name,
    row.unit ?? "",
    row.actual,
    row.expectedValue,
    row.diff,
    row.unitPriceValue,
    row.moneyDiffValue,
    row.statusText,
    row.commentText
  ]);
  const summaryStartRowIndex = tableHeaderRowIndex + tableRows.length + 2;
  const sheetRows = [
    ["ПЕРЕУЧЁТ БАРА"],
    [],
    ["Ресторан:", restaurantName],
    ["Дата:", date.toLocaleString("ru-RU")],
    ["Статус:", translateInventoryStatus(report.inventory.status)],
    [],
    tableHeaders,
    ...tableRows,
    [],
    ["Всего позиций:", totals.total],
    ["Недостач:", totals.shortage],
    ["Излишков:", totals.surplus],
    ["Совпадений:", totals.match],
    ["Итого расхождение, BYN:", formatMoney$1(totals.money)]
  ];
  const worksheet = utils.aoa_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: getAutoWidth([tableHeaders[0], ...rows.map((row) => row.categoryName)], 10, 40) },
    { wch: getAutoWidth([tableHeaders[1], ...rows.map((row) => row.name)], 16, 50) },
    { wch: getAutoWidth([tableHeaders[2], ...rows.map((row) => row.unit ?? "")], 10, 24) },
    { wch: getAutoWidth([tableHeaders[3], ...rows.map((row) => row.actual)], 10, 24) },
    { wch: getAutoWidth([tableHeaders[4], ...rows.map((row) => row.expectedValue)], 10, 24) },
    { wch: getAutoWidth([tableHeaders[5], ...rows.map((row) => row.diff)], 10, 18) },
    { wch: getAutoWidth([tableHeaders[6], ...rows.map((row) => row.unitPriceValue)], 12, 22) },
    { wch: getAutoWidth([tableHeaders[7], ...rows.map((row) => row.moneyDiffValue)], 12, 22) },
    { wch: getAutoWidth([tableHeaders[8], ...rows.map((row) => row.statusText)], 10, 28) },
    { wch: getAutoWidth([tableHeaders[9], ...rows.map((row) => row.commentText)], 16, 50) }
  ];
  worksheet["!merges"] = [{ s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: 9 } }];
  worksheet["!freeze"] = { xSplit: 0, ySplit: tableHeaderRowIndex + 1 };
  applyCellStyle(worksheet, titleRowIndex, 0, titleStyle);
  for (let row = metaStartRowIndex; row < metaStartRowIndex + 3; row += 1) {
    applyCellStyle(worksheet, row, 0, metaLabelStyle);
    applyCellStyle(worksheet, row, 1, metaValueStyle);
  }
  for (let column = 0; column < tableColumnCount; column += 1) {
    applyCellStyle(worksheet, tableHeaderRowIndex, column, headerStyle);
  }
  rows.forEach((row, index) => {
    const style = getRowStyle(row.status);
    const sheetRow = tableHeaderRowIndex + 1 + index;
    for (let column = 0; column < tableColumnCount; column += 1) {
      applyCellStyle(worksheet, sheetRow, column, style);
    }
  });
  for (let row = summaryStartRowIndex; row < summaryStartRowIndex + 5; row += 1) {
    applyCellStyle(worksheet, row, 0, summaryLabelStyle);
  }
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, "Переучёт");
  writeFileSync(
    workbook,
    `BarStock_${safeFilePart(restaurantName)}_${formatDateForFile(date)}.xlsx`,
    {
      cellStyles: true
    }
  );
}
function formatMoney(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00";
  const safeValue = Object.is(value, -0) ? 0 : value;
  return safeValue.toFixed(2);
}
const Dialog = Root;
const DialogPortal = Portal;
const DialogOverlay = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Overlay,
  {
    ref,
    className: cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    ),
    ...props
  }
));
DialogOverlay.displayName = Overlay.displayName;
const DialogContent = reactExports.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogPortal, { children: [
  /* @__PURE__ */ jsxRuntimeExports.jsx(DialogOverlay, {}),
  /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Content,
    {
      ref,
      className: cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-4 w-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: "Close" })
        ] })
      ]
    }
  )
] }));
DialogContent.displayName = Content.displayName;
const DialogHeader = ({ className, ...props }) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("flex flex-col space-y-1.5 text-center sm:text-left", className), ...props });
DialogHeader.displayName = "DialogHeader";
const DialogFooter = ({ className, ...props }) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  "div",
  {
    className: cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className),
    ...props
  }
);
DialogFooter.displayName = "DialogFooter";
const DialogTitle = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Title,
  {
    ref,
    className: cn("text-lg font-semibold leading-none tracking-tight", className),
    ...props
  }
));
DialogTitle.displayName = Title.displayName;
const DialogDescription = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Description,
  {
    ref,
    className: cn("text-sm text-muted-foreground", className),
    ...props
  }
));
DialogDescription.displayName = Description.displayName;
const Textarea = reactExports.forwardRef(
  ({ className, ...props }, ref) => {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "textarea",
      {
        className: cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        ),
        ref,
        ...props
      }
    );
  }
);
Textarea.displayName = "Textarea";
function ReportPage() {
  const {
    id
  } = Route$2.useParams();
  const {
    session
  } = useSession();
  const sessionToken = session?.session_token ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getReport = useServerFn(getInventoryReportFn);
  const deleteInventory = useServerFn(deleteInventoryFn);
  const requestCorrection = useServerFn(requestInventoryCorrectionFn);
  const {
    data,
    isLoading,
    error
  } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const [filter, setFilter] = reactExports.useState("all");
  const [correctionOpen, setCorrectionOpen] = reactExports.useState(false);
  const [correctionComment, setCorrectionComment] = reactExports.useState("");
  const [correctionError, setCorrectionError] = reactExports.useState(null);
  const deleteMutation = useMutation({
    mutationFn: () => deleteInventory({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["reports"]
      });
      await navigate({
        to: "/reports"
      });
    }
  });
  const correctionMutation = useMutation({
    mutationFn: () => requestCorrection({
      data: {
        id,
        session_token: sessionToken,
        correction_comment: correctionComment.trim()
      }
    }),
    onSuccess: async () => {
      setCorrectionOpen(false);
      setCorrectionComment("");
      setCorrectionError(null);
      await queryClient.invalidateQueries({
        queryKey: ["report", id]
      });
      await queryClient.invalidateQueries({
        queryKey: ["reports"]
      });
    }
  });
  const filtered = reactExports.useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "diff") return r.status !== "match";
      if (filter === "shortage") return r.status === "shortage";
      if (filter === "surplus") return r.status === "surplus";
      return true;
    });
  }, [data, filter]);
  const totals = reactExports.useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      total: rows.length,
      match: rows.filter((r) => r.status === "match").length,
      shortage: rows.filter((r) => r.status === "shortage").length,
      surplus: rows.filter((r) => r.status === "surplus").length,
      money: rows.reduce((sum, row) => sum + Number(row.money_diff ?? 0), 0)
    };
  }, [data]);
  if (isLoading) return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка…" });
  if (error || !data) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: error instanceof Error ? error.message : "Не удалось загрузить отчёт" });
  }
  const {
    inventory
  } = data;
  const isCorrectionRequired = inventory.status === "correction_required";
  function confirmAndDelete() {
    const confirmed = window.confirm("Вы уверены? Перед удалением скачайте Excel-отчёт. Удаление необратимо.");
    if (!confirmed) return;
    deleteMutation.mutate();
  }
  function submitCorrection() {
    if (!correctionComment.trim()) {
      setCorrectionError("Комментарий обязателен");
      return;
    }
    setCorrectionError(null);
    correctionMutation.mutate();
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/reports", className: "mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "size-4" }),
        " К отчётам"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "text-2xl font-semibold tracking-tight", children: [
        "Отчёт по переучёту от",
        " ",
        new Date(inventory.created_at).toLocaleString("ru-RU", {
          dateStyle: "medium",
          timeStyle: "short"
        })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: isCorrectionRequired ? "default" : "secondary", children: inventoryStatusLabel(inventory.status) }),
        isCorrectionRequired && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-muted-foreground", children: "Предварительный отчёт" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/reports/expected/$id", params: {
        id: inventory.id
      }, className: "mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(FileSpreadsheet, { className: "size-4" }),
        " Учётные остатки (заполнить / импорт Excel)"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3 md:grid-cols-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryCard, { label: "Всего позиций", value: totals.total }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryCard, { label: "Совпадает", value: totals.match }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryCard, { label: "Недостачи", value: totals.shortage, tone: "shortage" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryCard, { label: "Излишки", value: totals.surplus, tone: "surplus" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(SummaryCard, { label: "Итог BYN", value: `${formatMoney(totals.money)} BYN`, tone: totals.money < 0 ? "shortage" : totals.money > 0 ? "surplus" : "total", className: "col-span-2 md:col-span-1" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "secondary", onClick: () => exportInventoryToExcel(data), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "size-4" }),
        " Скачать Excel"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "outline", disabled: correctionMutation.isPending || isCorrectionRequired, onClick: () => setCorrectionOpen(true), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(RotateCcw, { className: "size-4" }),
        "Вернуть на доработку"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "destructive", onClick: confirmAndDelete, disabled: deleteMutation.isPending, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }),
        deleteMutation.isPending ? "Удаление..." : "Удалить переучёт"
      ] })
    ] }),
    deleteMutation.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: deleteMutation.error instanceof Error ? deleteMutation.error.message : "Не удалось удалить переучёт" }),
    correctionMutation.error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: correctionMutation.error instanceof Error ? correctionMutation.error.message : "Не удалось вернуть переучёт на доработку" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Dialog, { open: correctionOpen, onOpenChange: setCorrectionOpen, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogContent, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(DialogTitle, { children: "Вернуть переучёт на доработку" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DialogDescription, { children: "Бармен увидит комментарий и сможет исправить фактические остатки." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "grid gap-2 text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: "Комментарий для бармена" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Textarea, { value: correctionComment, onChange: (event) => {
          setCorrectionComment(event.target.value);
          setCorrectionError(null);
        }, placeholder: "Что нужно проверить или исправить", rows: 5 })
      ] }),
      correctionError && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", children: correctionError }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(DialogFooter, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "secondary", onClick: () => setCorrectionOpen(false), disabled: correctionMutation.isPending, children: "Отмена" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", onClick: submitCorrection, disabled: correctionMutation.isPending, children: correctionMutation.isPending ? "Возврат..." : "Вернуть" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap gap-1.5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(FilterPill, { active: filter === "all", onClick: () => setFilter("all"), children: "Все" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(FilterPill, { active: filter === "diff", onClick: () => setFilter("diff"), children: "Только расхождения" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(FilterPill, { active: filter === "shortage", onClick: () => setFilter("shortage"), children: "Недостачи" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(FilterPill, { active: filter === "surplus", onClick: () => setFilter("surplus"), children: "Излишки" })
    ] }),
    filtered.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground", children: "Нет позиций по выбранному фильтру." }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto rounded-xl border border-border bg-card", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-xs uppercase text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-left font-medium", children: "Товар" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right font-medium", children: "Факт" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right font-medium", children: "Учёт" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right font-medium", children: "Разница" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right font-medium", children: "Цена за ед., BYN" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-right font-medium", children: "Сумма, BYN" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-4 py-2 text-left font-medium", children: "Статус" })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: filtered.map((r) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border last:border-b-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { className: "px-4 py-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: r.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: r.unit ?? "шт" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right tabular-nums", children: formatQuantity(r.actual) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right tabular-nums", children: r.expected_set === false || r.expected === null ? "" : formatQuantity(r.expected) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right tabular-nums", children: r.diff > 0 ? `+${formatQuantity(r.diff)}` : formatQuantity(r.diff) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right tabular-nums", children: formatMoney(Number(r.unit_price ?? 0)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2 text-right tabular-nums", children: formatMoney(Number(r.money_diff ?? 0)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-4 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(StatusBadge, { status: r.status }) })
      ] }, r.product_id)) })
    ] }) })
  ] });
}
function FilterPill({
  active,
  onClick,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick, className: "rounded-full border px-3 py-1 text-xs transition " + (active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"), children });
}
function StatusBadge({
  status
}) {
  if (status === "match") return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "secondary", children: "совпадает" });
  if (status === "shortage") return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-destructive text-destructive-foreground", children: "недостача" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { className: "bg-amber-500 text-black", children: "излишек" });
}
function SummaryCard({
  label,
  value,
  tone = "total",
  className = ""
}) {
  const toneClass = tone === "shortage" ? "border-destructive/40 bg-destructive/10" : tone === "surplus" ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-card";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `rounded-lg border p-3 ${toneClass} ${className}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-muted-foreground", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-xl font-semibold tabular-nums", children: value })
  ] });
}
function inventoryStatusLabel(status) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}
const SplitComponent = () => /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { allow: ["accountant"], children: /* @__PURE__ */ jsxRuntimeExports.jsx(ReportPage, {}) });
export {
  SplitComponent as component
};
