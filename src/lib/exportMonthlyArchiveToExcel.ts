import * as XLSX from "xlsx";

type ArchiveCategory = {
  id: string;
  name: string;
};

type ArchiveInventory = {
  id: string;
  created_at: string;
  status: string;
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

function numberValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function exportMonthlyArchiveToExcel(archive: MonthlyArchive) {
  const categoryById = new Map(archive.categories.map((category) => [category.id, category.name]));
  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    [
      "Дата переучёта",
      "Ресторан",
      "Количество позиций",
      "Количество расхождений",
      "Сумма недостач",
      "Сумма излишков",
    ],
    ...archive.inventories.map((report) => {
      const shortageSum = report.rows
        .filter((row) => row.status === "shortage")
        .reduce((sum, row) => sum + Math.abs(numberValue(row.diff)), 0);
      const surplusSum = report.rows
        .filter((row) => row.status === "surplus")
        .reduce((sum, row) => sum + numberValue(row.diff), 0);

      return [
        formatDate(report.inventory.created_at),
        report.restaurant?.name ?? "",
        report.rows.length,
        report.rows.filter((row) => row.status !== "match").length,
        shortageSum,
        surplusSum,
      ];
    }),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 18 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Сводка");

  archive.inventories.forEach((report, index) => {
    const rows = [
      ["Дата:", formatDate(report.inventory.created_at)],
      ["Ресторан:", report.restaurant?.name ?? ""],
      [],
      ["Товар", "Категория", "Единица", "Факт", "Учёт", "Разница", "Статус"],
      ...report.rows.map((row) => [
        row.name,
        row.category_id ? (categoryById.get(row.category_id) ?? "") : "",
        row.unit ?? "",
        row.actual,
        row.expected_set === false || row.expected === null ? "" : row.expected,
        row.diff,
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
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      safeSheetName(
        `${index + 1} ${new Date(report.inventory.created_at).toLocaleDateString("ru-RU")}`,
      ),
    );
  });

  XLSX.writeFile(workbook, `barstock-archive-${archive.month}.xlsx`);
}
