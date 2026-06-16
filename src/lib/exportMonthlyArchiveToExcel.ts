import * as XLSX from "xlsx";

type ArchiveCategory = {
  id: string;
  name: string;
};

type ArchiveInventory = {
  id: string;
  created_at: string;
  status: string;
  area?: string | null;
};

type ArchiveRestaurant = {
  id?: string;
  name?: string | null;
} | null;

type ArchiveRow = {
  product_id: string;
  name: string;
  category_id: string | null;
  unit: string | null;
  actual: number;
  expected: number | null;
  expected_set?: boolean;
  diff: number;
  unit_price?: number | null;
  money_diff?: number | null;
  status: "shortage" | "surplus" | "match";
};

type ArchiveInventoryReport = {
  inventory: ArchiveInventory;
  restaurant?: ArchiveRestaurant;
  rows: ArchiveRow[];
};

export type MonthlyArchive = {
  month: string;
  categories: ArchiveCategory[];
  inventories: ArchiveInventoryReport[];
};

function translateStatus(status: ArchiveRow["status"]) {
  if (status === "shortage") return "недостача";
  if (status === "surplus") return "излишек";
  return "совпадает";
}

function translateArea(area?: string | null) {
  return area === "kitchen" ? "Кухня" : "Бар";
}

function safeSheetName(name: string) {
  return (
    name
      .replace(/\[/g, " ")
      .replace(/\]/g, " ")
      .replace(/[\\/*?:]/g, " ")
      .slice(0, 31)
      .trim() || "Переучёт"
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateForFile(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function safeFilePart(value: string) {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "_")
      .replace(/^_+|_+$/g, "") || "Archive"
  );
}

function numberValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function moneyValue(row: ArchiveRow) {
  return numberValue(row.money_diff ?? row.diff * numberValue(row.unit_price));
}

function formatMoney(value: number) {
  return (Object.is(value, -0) ? 0 : value).toFixed(2);
}

export function exportMonthlyArchiveToExcel(archive: MonthlyArchive) {
  const categoryById = new Map(archive.categories.map((category) => [category.id, category.name]));
  const workbook = XLSX.utils.book_new();
  const restaurants = Array.from(
    new Set(
      archive.inventories
        .map((report) => report.restaurant?.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  );
  const archiveRestaurantName =
    restaurants.length === 1 ? restaurants[0] : restaurants.length > 1 ? "Все рестораны" : "Архив";

  const summaryRows = [
    [
      "Дата переучёта",
      "Ресторан",
      "\u0417\u043e\u043d\u0430",
      "Количество позиций",
      "Количество расхождений",
      "Сумма недостач",
      "Сумма излишков",
      "Итого BYN",
    ],
    ...archive.inventories.map((report) => {
      const shortageSum = report.rows
        .filter((row) => row.status === "shortage")
        .reduce((sum, row) => sum + Math.abs(numberValue(row.diff)), 0);
      const surplusSum = report.rows
        .filter((row) => row.status === "surplus")
        .reduce((sum, row) => sum + numberValue(row.diff), 0);
      const moneySum = report.rows.reduce((sum, row) => sum + moneyValue(row), 0);

      return [
        formatDate(report.inventory.created_at),
        report.restaurant?.name ?? "",
        translateArea(report.inventory.area),
        report.rows.length,
        report.rows.filter((row) => row.status !== "match").length,
        shortageSum,
        surplusSum,
        formatMoney(moneySum),
      ];
    }),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Сводка");

  archive.inventories.forEach((report, index) => {
    const restaurantName = report.restaurant?.name ?? "";
    const rows = [
      ["Ресторан:", restaurantName],
      ["Дата переучёта:", formatDate(report.inventory.created_at)],
      ["\u0417\u043e\u043d\u0430:", translateArea(report.inventory.area)],
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
        "Статус",
      ],
      ...report.rows.map((row) => [
        row.name,
        row.category_id ? (categoryById.get(row.category_id) ?? "") : "",
        row.unit ?? "",
        row.actual,
        row.expected_set === false || row.expected === null ? "" : row.expected,
        row.diff,
        formatMoney(numberValue(row.unit_price)),
        formatMoney(moneyValue(row)),
        translateStatus(row.status),
      ]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 36 },
      { wch: 24 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      safeSheetName(
        `${index + 1} ${restaurantName} ${new Date(report.inventory.created_at).toLocaleDateString("ru-RU")}`,
      ),
    );
  });

  const firstInventoryDate = archive.inventories[0]?.inventory.created_at;
  const fileDate = firstInventoryDate ? formatDateForFile(firstInventoryDate) : archive.month;
  XLSX.writeFile(workbook, `BarStock_${safeFilePart(archiveRestaurantName)}_${fileDate}.xlsx`);
}
