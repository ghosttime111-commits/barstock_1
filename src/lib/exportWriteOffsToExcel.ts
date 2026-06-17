import * as XLSX from "xlsx";

export type WriteOffExportRow = {
  created_at: string;
  restaurant_name: string;
  area: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number | null;
  amount: number | null;
  user_name: string;
  reason: string;
};

function areaLabel(area: string) {
  return area === "kitchen" ? "Кухня" : "Бар";
}

export function exportWriteOffsToExcel(rows: WriteOffExportRow[], month: string) {
  const data = [
    ["СПИСАНИЯ BARSTOCK"],
    ["Период:", month],
    [],
    [
      "Дата",
      "Ресторан",
      "Зона",
      "Товар",
      "Единица",
      "Количество",
      "Цена за ед., BYN",
      "Сумма, BYN",
      "Кто списал",
      "Причина",
    ],
    ...rows.map((row) => [
      new Date(row.created_at).toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      row.restaurant_name,
      areaLabel(row.area),
      row.product_name,
      row.unit,
      row.quantity,
      Number(row.unit_price ?? 0),
      Number(row.amount ?? 0),
      row.user_name,
      row.reason,
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 19 },
    { wch: 26 },
    { wch: 12 },
    { wch: 34 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 24 },
    { wch: 40 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Списания");
  XLSX.writeFile(workbook, `barstock-write-offs-${month}.xlsx`);
}
