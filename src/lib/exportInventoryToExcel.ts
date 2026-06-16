import * as XLSX from "xlsx";

type ExportInventory = {
  id: string;
  created_at: string;
  status: string;
  area?: string | null;
};

type ExportRestaurant = {
  name?: string | null;
} | null;

type ExportCategory = {
  id: string;
  name: string;
};

type ExportRow = {
  category_id: string | null;
  name: string;
  unit: string | null;
  actual: number;
  expected: number | null;
  expected_set?: boolean;
  diff: number;
  unit_price?: number | null;
  money_diff?: number | null;
  status: "shortage" | "surplus" | "match";
  comment?: string | null;
};

export type ExportInventoryReport = {
  inventory: ExportInventory;
  restaurant?: ExportRestaurant;
  categories: ExportCategory[];
  rows: ExportRow[];
};

type CellStyle = NonNullable<XLSX.CellObject["s"]>;

const titleRowIndex = 0;
const metaStartRowIndex = 2;
const tableHeaderRowIndex = 7;
const tableColumnCount = 10;

const thinBlackBorder = {
  top: { style: "thin", color: { rgb: "000000" } },
  right: { style: "thin", color: { rgb: "000000" } },
  bottom: { style: "thin", color: { rgb: "000000" } },
  left: { style: "thin", color: { rgb: "000000" } },
} satisfies CellStyle["border"];

const titleStyle: CellStyle = {
  font: { bold: true, sz: 16 },
  alignment: { horizontal: "center", vertical: "center" },
};

const metaLabelStyle: CellStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: "E7E6E6" } },
  border: thinBlackBorder,
};

const metaValueStyle: CellStyle = {
  border: thinBlackBorder,
};

const headerStyle: CellStyle = {
  font: { bold: true },
  fill: { fgColor: { rgb: "E7E6E6" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: thinBlackBorder,
};

const tableCellStyle: CellStyle = {
  border: thinBlackBorder,
  alignment: { vertical: "center", wrapText: true },
};

const shortageRowStyle: CellStyle = {
  ...tableCellStyle,
  fill: { fgColor: { rgb: "FCE4D6" } },
};

const surplusRowStyle: CellStyle = {
  ...tableCellStyle,
  fill: { fgColor: { rgb: "E2F0D9" } },
};

const summaryLabelStyle: CellStyle = {
  font: { bold: true },
};

function formatDateForFile(date: Date) {
  return date.toISOString().slice(0, 10);
}

function safeFilePart(value: string) {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "") || "Restaurant"
  );
}

function translateInventoryStatus(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "closed" || status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}

function translateDiscrepancyStatus(status: ExportRow["status"]) {
  if (status === "shortage") return "недостача";
  if (status === "surplus") return "излишек";
  return "совпадает";
}

function translateArea(area?: string | null) {
  return area === "kitchen" ? "Кухня" : "Бар";
}

function getRowStyle(status: ExportRow["status"]) {
  if (status === "shortage") return shortageRowStyle;
  if (status === "surplus") return surplusRowStyle;
  return tableCellStyle;
}

function getCellTextLength(value: string | number) {
  return String(value ?? "").length;
}

function getAutoWidth(values: Array<string | number>, min = 10, max = 40) {
  const longest = values.reduce<number>(
    (width, value) => Math.max(width, getCellTextLength(value)),
    min,
  );

  return Math.min(Math.max(longest + 2, min), max);
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00";
  return (Object.is(value, -0) ? 0 : value).toFixed(2);
}

function applyCellStyle(worksheet: XLSX.WorkSheet, row: number, column: number, style: CellStyle) {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = worksheet[cellAddress];
  if (cell) cell.s = style;
}

export function exportInventoryToExcel(report: ExportInventoryReport) {
  const date = new Date(report.inventory.created_at);
  const categoryById = new Map(report.categories.map((category) => [category.id, category.name]));
  const restaurantName = report.restaurant?.name ?? "Ресторан";
  const rows = report.rows.map((row) => ({
    ...row,
    categoryName: row.category_id ? (categoryById.get(row.category_id) ?? "") : "",
    expectedValue: row.expected_set === false || row.expected === null ? "" : row.expected,
    unitPriceValue: formatMoney(Number(row.unit_price ?? 0)),
    moneyDiffValue: formatMoney(Number(row.money_diff ?? 0)),
    statusText: translateDiscrepancyStatus(row.status),
    commentText: row.comment ?? "",
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
    { total: 0, shortage: 0, surplus: 0, match: 0, money: 0 },
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
    "Комментарий бухгалтера",
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
    row.commentText,
  ]);

  const summaryStartRowIndex = tableHeaderRowIndex + tableRows.length + 2;
  const sheetRows: Array<Array<string | number>> = [
    ["ПЕРЕУЧЁТ БАРА"],
    [],
    ["Ресторан:", restaurantName],
    ["Дата:", date.toLocaleString("ru-RU")],
    ["Статус:", translateInventoryStatus(report.inventory.status)],
    ["\u0417\u043e\u043d\u0430:", translateArea(report.inventory.area)],
    [],
    tableHeaders,
    ...tableRows,
    [],
    ["Всего позиций:", totals.total],
    ["Недостач:", totals.shortage],
    ["Излишков:", totals.surplus],
    ["Совпадений:", totals.match],
    ["Итого расхождение, BYN:", formatMoney(totals.money)],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
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
    { wch: getAutoWidth([tableHeaders[9], ...rows.map((row) => row.commentText)], 16, 50) },
  ];
  worksheet["!merges"] = [{ s: { r: titleRowIndex, c: 0 }, e: { r: titleRowIndex, c: 9 } }];
  worksheet["!freeze"] = { xSplit: 0, ySplit: tableHeaderRowIndex + 1 };

  applyCellStyle(worksheet, titleRowIndex, 0, titleStyle);

  for (let row = metaStartRowIndex; row < metaStartRowIndex + 4; row += 1) {
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

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Переучёт");
  XLSX.writeFile(
    workbook,
    `BarStock_${safeFilePart(restaurantName)}_${formatDateForFile(date)}.xlsx`,
    {
      cellStyles: true,
    },
  );
}
