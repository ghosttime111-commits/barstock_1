import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { importCatalogBatchFn } from "@/lib/barstock.functions";
import {
  catalogPreviewStatusLabel,
  createCatalogImportPreview,
  normalizeCatalogKey,
  validateCatalogSheetBounds,
  validateCatalogFileMeta,
  type CatalogExistingCategory,
  type CatalogExistingProduct,
  type CatalogImportPreview,
  type CatalogPreviewRow,
  type CatalogSheetCell,
  type CatalogWorkbookSheets,
} from "@/lib/catalogImport";
import { addProductsToCache } from "@/lib/productCache";

type ImportFilter = "all" | "errors" | "warnings" | "ready";

const PREVIEW_PAGE_SIZE = 100;

type ImportedCategory = {
  id: string;
  name: string;
  area?: string | null;
  network_id: string;
};

type ImportedProduct = {
  id: string;
  name: string;
  category_id: string | null;
  unit: string | null;
  status: string | null;
  unit_price: number | string | null;
  area?: string | null;
  network_id: string;
};

function rowMatchesFilter(row: CatalogPreviewRow, filter: ImportFilter) {
  if (filter === "errors") return row.status === "error";
  if (filter === "warnings") return row.status === "warning" || row.status === "skip";
  if (filter === "ready") return row.status === "create" || row.status === "use_existing";
  return true;
}

function statusClass(status: CatalogPreviewRow["status"]) {
  if (status === "error") return "text-destructive";
  if (status === "warning" || status === "skip") return "text-amber-400";
  if (status === "create") return "text-emerald-400";
  return "text-muted-foreground";
}

function addCategoriesToCache<T extends ImportedCategory>(
  current: T[] | undefined,
  importedCategories: T[],
  selectedNetworkId?: string,
) {
  const categories = current ?? [];
  const next = new Map(categories.map((category) => [category.id, category]));
  for (const category of importedCategories) {
    if (!selectedNetworkId || category.network_id === selectedNetworkId) {
      next.set(category.id, category);
    }
  }
  return Array.from(next.values()).sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

async function readWorkbookSheets(file: File): Promise<CatalogWorkbookSheets> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    cellFormula: true,
  });
  const sheets: CatalogWorkbookSheets = {};
  const requiredSheets = new Map<"Категории" | "Товары", string>();
  for (const sheetName of workbook.SheetNames) {
    const normalized = normalizeCatalogKey(sheetName);
    if (normalized === normalizeCatalogKey("Категории")) requiredSheets.set("Категории", sheetName);
    if (normalized === normalizeCatalogKey("Товары")) requiredSheets.set("Товары", sheetName);
  }

  for (const [logicalSheetName, sheetName] of requiredSheets) {
    const sheet = workbook.Sheets[sheetName];
    const ref = sheet["!ref"];
    if (!ref) {
      sheets[sheetName] = [];
      continue;
    }
    const range = XLSX.utils.decode_range(ref);
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    const boundsError = validateCatalogSheetBounds({
      sheet: logicalSheetName,
      rowCount,
      columnCount,
    });
    if (boundsError) throw new Error(boundsError);
    const rowsMeta = (sheet["!rows"] ?? []) as Array<{ hidden?: boolean } | undefined>;
    if (rowsMeta.some((row, index) => row?.hidden && index >= range.s.r && index <= range.e.r)) {
      throw new Error(
        `На листе «${logicalSheetName}» есть скрытые строки. Удалите или покажите их`,
      );
    }
    const rows: CatalogSheetCell[][] = [];
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
      const row: CatalogSheetCell[] = [];
      for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
        const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
        const cell = sheet[address];
        row.push(
          cell?.f ? { value: cell.v ?? cell.w ?? "", formula: cell.f } : (cell?.v ?? cell?.w ?? ""),
        );
      }
      rows.push(row);
    }
    sheets[sheetName] = rows;
  }
  return sheets;
}

async function downloadCatalogTemplate() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const instruction = XLSX.utils.aoa_to_sheet([
    ["BarStock: импорт категорий и товаров"],
    ["Заполните листы «Категории» и «Товары». Файл относится только к выбранной сети."],
    ["Обязательные поля категорий: Название, Зона."],
    ["Обязательные поля товаров: Название, Категория, Единица, Зона, Цена, Статус."],
    ["Зона: Бар или Кухня."],
    ["Единица: л, кг, шт, бут. Значения мл и г не конвертируются автоматически."],
    ["Статус: Активен, На проверке, Архив. Пустой статус считается Активен."],
    ["Существующие товары не изменяются и будут пропущены."],
    ["Дубли категорий определяются по сети, зоне и названию без учёта регистра/крайних пробелов."],
  ]);
  const categories = XLSX.utils.aoa_to_sheet([
    ["Название", "Зона"],
    ["Безалкогольные напитки", "Бар"],
    ["Холодный цех", "Кухня"],
  ]);
  const products = XLSX.utils.aoa_to_sheet([
    ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
    ["Coca-Cola 0,5", "Безалкогольные напитки", "бут", "Бар", "3,50", "Активен"],
    ["Лосось", "Холодный цех", "кг", "Кухня", "42,00", "Активен"],
  ]);
  instruction["!cols"] = [{ wch: 92 }];
  categories["!cols"] = [{ wch: 34 }, { wch: 14 }];
  products["!cols"] = [
    { wch: 34 },
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(workbook, instruction, "Инструкция");
  XLSX.utils.book_append_sheet(workbook, categories, "Категории");
  XLSX.utils.book_append_sheet(workbook, products, "Товары");
  XLSX.writeFile(workbook, "barstock-catalog-import-template.xlsx");
}

export function CatalogImportDialog({
  sessionToken,
  isSuperAdmin,
  selectedNetworkId,
  effectiveCreationNetworkId,
  categories,
  products,
}: {
  sessionToken: string;
  isSuperAdmin: boolean;
  selectedNetworkId?: string;
  effectiveCreationNetworkId: string;
  categories: CatalogExistingCategory[];
  products: CatalogExistingProduct[];
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const importInFlightRef = useRef(false);
  const lastNetworkIdRef = useRef(effectiveCreationNetworkId);
  const importCatalogBatch = useServerFn(importCatalogBatchFn);
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null);
  const [filter, setFilter] = useState<ImportFilter>("all");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  useUnsavedChanges("admin-catalog-import-preview", open && Boolean(preview));

  const filteredRows = useMemo(
    () => (preview?.rows ?? []).filter((row) => rowMatchesFilter(row, filter)),
    [filter, preview],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PREVIEW_PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PREVIEW_PAGE_SIZE, page * PREVIEW_PAGE_SIZE);
  const readyCount =
    (preview?.categoriesToImport.length ?? 0) + (preview?.productsToImport.length ?? 0);

  function resetImportState() {
    setSelectedFile(null);
    setPreview(null);
    setFilter("all");
    setPage(1);
    setErrorMessage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeDialog(nextOpen: boolean) {
    if (!nextOpen && importInFlightRef.current) return;
    setOpen(nextOpen);
    if (!nextOpen) resetImportState();
  }

  useEffect(() => {
    if (lastNetworkIdRef.current !== effectiveCreationNetworkId) {
      lastNetworkIdRef.current = effectiveCreationNetworkId;
      if (open) {
        resetImportState();
        setMessage(null);
      }
    }
  }, [effectiveCreationNetworkId, open]);

  async function checkFile(file: File | null) {
    setMessage(null);
    setErrorMessage(null);
    setPreview(null);
    setPage(1);
    setSelectedFile(file);
    if (!file) return;
    if (isSuperAdmin && !effectiveCreationNetworkId) {
      setErrorMessage("Выберите сеть для новых данных перед импортом");
      return;
    }
    const fileError = validateCatalogFileMeta(file);
    if (fileError) {
      setErrorMessage(fileError);
      return;
    }

    setIsParsing(true);
    try {
      const sheets = await readWorkbookSheets(file);
      const nextPreview = createCatalogImportPreview({
        sheets,
        targetNetworkId: effectiveCreationNetworkId,
        existingCategories: categories,
        existingProducts: products,
      });
      setPreview(nextPreview);
    } catch (error) {
      console.error("catalog import parse error", error);
      const safeMessage =
        error instanceof Error &&
        (error.message.includes("лист") ||
          error.message.includes("строк") ||
          error.message.includes("столбцов"))
          ? error.message
          : "Не удалось прочитать Excel-файл. Проверьте формат .xlsx";
      setErrorMessage(safeMessage);
    } finally {
      setIsParsing(false);
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (importInFlightRef.current) throw new Error("Импорт уже выполняется");
      importInFlightRef.current = true;
      try {
        if (!preview) throw new Error("Сначала проверьте файл");
        return importCatalogBatch({
          data: {
            session_token: sessionToken,
            network_id: isSuperAdmin ? effectiveCreationNetworkId : undefined,
            categories: preview.categoriesToImport,
            products: preview.productsToImport,
          },
        });
      } finally {
        importInFlightRef.current = false;
      }
    },
    onSuccess: async (result) => {
      const createdCategories = (result.created_categories ?? []) as ImportedCategory[];
      const createdProducts = (result.created_products ?? []) as ImportedProduct[];
      const skippedProducts = result.counts?.skipped_products ?? 0;
      const targetNetworkId = effectiveCreationNetworkId;
      queryClient.setQueryData<ImportedCategory[]>(["categories", selectedNetworkId], (current) =>
        addCategoriesToCache(current, createdCategories, selectedNetworkId),
      );
      queryClient.setQueryData<ImportedCategory[]>(["categories", targetNetworkId], (current) =>
        addCategoriesToCache(current, createdCategories, targetNetworkId),
      );
      queryClient.setQueryData<ImportedProduct[]>(["products", selectedNetworkId], (current) =>
        addProductsToCache(current, createdProducts, selectedNetworkId),
      );
      queryClient.setQueryData<ImportedProduct[]>(["products", targetNetworkId], (current) =>
        addProductsToCache(current, createdProducts, targetNetworkId),
      );
      setPreview(null);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setErrorMessage(null);
      setMessage(
        `Импорт завершён. Создано категорий: ${createdCategories.length}. Добавлено товаров: ${createdProducts.length}. Пропущено существующих товаров: ${skippedProducts}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["categories", selectedNetworkId], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["products", selectedNetworkId], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["categories", targetNetworkId], exact: true }),
        queryClient.invalidateQueries({ queryKey: ["products", targetNetworkId], exact: true }),
      ]);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось импортировать файл");
    },
  });

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Upload className="size-4" />
          Импорт из Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Импорт категорий и товаров</DialogTitle>
          <DialogDescription>
            Сначала скачайте шаблон или выберите готовый .xlsx-файл, затем проверьте preview и
            подтвердите импорт.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={() => void downloadCatalogTemplate()}>
            <Download className="size-4" />
            Скачать шаблон
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet className="size-4" />
            Выбрать файл
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => void checkFile(event.target.files?.[0] ?? null)}
          />
          {selectedFile && (
            <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
          )}
        </div>

        {isParsing && <p className="text-sm text-muted-foreground">Проверяем файл...</p>}
        {importMutation.isPending && (
          <p className="text-sm text-muted-foreground">Импортируем справочник...</p>
        )}
        {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {preview && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label="Категорий в файле" value={preview.summary.categoriesInFile} />
              <SummaryItem label="Новых категорий" value={preview.summary.newCategories} />
              <SummaryItem label="Товаров в файле" value={preview.summary.productsInFile} />
              <SummaryItem label="Готово к импорту" value={preview.summary.readyToImport} />
              <SummaryItem
                label="Существующих категорий"
                value={preview.summary.existingCategories}
              />
              <SummaryItem label="Будет пропущено" value={preview.summary.skipped} />
              <SummaryItem label="Ошибок" value={preview.summary.errors} tone="danger" />
            </div>

            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(value) => {
                if (value) {
                  setFilter(value as ImportFilter);
                  setPage(1);
                }
              }}
              variant="outline"
              className="justify-start overflow-x-auto"
            >
              <ToggleGroupItem value="all">Все</ToggleGroupItem>
              <ToggleGroupItem value="errors">Ошибки</ToggleGroupItem>
              <ToggleGroupItem value="warnings">Предупреждения</ToggleGroupItem>
              <ToggleGroupItem value="ready">Готово</ToggleGroupItem>
            </ToggleGroup>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium">Лист</th>
                    <th className="px-3 py-2 text-left font-medium">Строка Excel</th>
                    <th className="px-3 py-2 text-left font-medium">Название</th>
                    <th className="px-3 py-2 text-left font-medium">Статус проверки</th>
                    <th className="px-3 py-2 text-left font-medium">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">{row.sheet}</td>
                      <td className="px-3 py-2">{row.rowNumber ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{row.name || "—"}</td>
                      <td className={`px-3 py-2 ${statusClass(row.status)}`}>
                        {catalogPreviewStatusLabel(row.status)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                        Нет строк для выбранного фильтра.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Страница {page} из {totalPages} · показано до {PREVIEW_PAGE_SIZE} строк
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Назад
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={importMutation.isPending}
            onClick={() => closeDialog(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={
              !preview ||
              preview.summary.errors > 0 ||
              readyCount === 0 ||
              importMutation.isPending ||
              isParsing
            }
            onClick={() => importMutation.mutate()}
          >
            Импортировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold ${tone === "danger" && value > 0 ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
