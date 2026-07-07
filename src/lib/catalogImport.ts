export type CatalogArea = "bar" | "kitchen";
export type CatalogUnit = "л" | "кг" | "шт" | "бут";
export type CatalogProductStatus = "approved" | "pending" | "archived";

export type CatalogSheetCell =
  | string
  | number
  | boolean
  | null
  | undefined
  | {
      value?: unknown;
      formula?: string | null;
    };

export type CatalogWorkbookSheets = Record<string, CatalogSheetCell[][]>;

export type CatalogExistingCategory = {
  id: string;
  name: string;
  area?: string | null;
  network_id: string;
};

export type CatalogExistingProduct = {
  id: string;
  name: string;
  area?: string | null;
  network_id: string;
};

export type CatalogImportCategoryInput = {
  name: string;
  area: CatalogArea;
};

export type CatalogImportProductInput = {
  name: string;
  category_name: string;
  area: CatalogArea;
  unit: CatalogUnit;
  status: CatalogProductStatus;
  unit_price: number;
};

export type CatalogPreviewRowStatus = "create" | "use_existing" | "skip" | "warning" | "error";

export type CatalogPreviewRow = {
  id: string;
  sheet: "Категории" | "Товары" | "Файл";
  rowNumber: number | null;
  name: string;
  status: CatalogPreviewRowStatus;
  description: string;
};

export type CatalogImportPreview = {
  summary: {
    categoriesInFile: number;
    newCategories: number;
    existingCategories: number;
    productsInFile: number;
    readyToImport: number;
    skipped: number;
    errors: number;
  };
  rows: CatalogPreviewRow[];
  categoriesToImport: CatalogImportCategoryInput[];
  productsToImport: CatalogImportProductInput[];
};

export const CATALOG_IMPORT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const CATALOG_IMPORT_MAX_CATEGORIES = 500;
export const CATALOG_IMPORT_MAX_PRODUCTS = 2000;
export const CATALOG_IMPORT_MAX_CATEGORY_SHEET_ROWS = CATALOG_IMPORT_MAX_CATEGORIES + 1;
export const CATALOG_IMPORT_MAX_PRODUCT_SHEET_ROWS = CATALOG_IMPORT_MAX_PRODUCTS + 1;
export const CATALOG_IMPORT_MAX_SHEET_COLUMNS = 32;
export const CATALOG_IMPORT_MAX_CELL_TEXT_LENGTH = 1000;

const FORMULA_ERROR = "Формулы в импортируемых ячейках не поддерживаются";
const AREA_LABELS: Record<CatalogArea, string> = { bar: "Бар", kitchen: "Кухня" };
const STATUS_LABELS: Record<CatalogProductStatus, string> = {
  approved: "Активен",
  pending: "На подтверждении",
  archived: "Архив",
};
const UNIT_ALIASES = new Map<string, CatalogUnit>([
  ["л", "л"],
  ["литр", "л"],
  ["литры", "л"],
  ["кг", "кг"],
  ["килограмм", "кг"],
  ["килограммы", "кг"],
  ["шт", "шт"],
  ["штука", "шт"],
  ["штуки", "шт"],
  ["бут", "бут"],
  ["бутылка", "бут"],
  ["бутылки", "бут"],
]);

const STATUS_ALIASES = new Map<string, CatalogProductStatus>([
  ["", "approved"],
  ["активен", "approved"],
  ["на проверке", "pending"],
  ["на подтверждении", "pending"],
  ["архив", "archived"],
  ["в архиве", "archived"],
]);

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeCatalogKey(value: unknown) {
  return normalizeText(value).toLocaleLowerCase("ru").replaceAll("ё", "е");
}

function displayCell(value: CatalogSheetCell) {
  if (value && typeof value === "object" && "value" in value) return normalizeText(value.value);
  return normalizeText(value);
}

export function hasCatalogFormulaCell(value: CatalogSheetCell) {
  return Boolean(value && typeof value === "object" && "formula" in value && value.formula);
}

function isEmptyRow(row: CatalogSheetCell[]) {
  return row.every((cell) => !displayCell(cell) && !hasCatalogFormulaCell(cell));
}

function sheetName(sheets: CatalogWorkbookSheets, requiredName: string) {
  const normalized = normalizeCatalogKey(requiredName);
  return Object.keys(sheets).find((name) => normalizeCatalogKey(name) === normalized) ?? null;
}

function headerIndexes(
  rows: CatalogSheetCell[][],
  sheet: "Категории" | "Товары",
  requiredHeaders: string[],
  previewRows: CatalogPreviewRow[],
) {
  const headerRow = rows[0] ?? [];
  const result = new Map<string, number>();
  const byHeader = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    byHeader.set(normalizeCatalogKey(displayCell(cell)), index);
  });

  for (const header of requiredHeaders) {
    const index = byHeader.get(normalizeCatalogKey(header));
    if (index == null) {
      previewRows.push({
        id: `missing-column-${sheet}-${header}`,
        sheet,
        rowNumber: 1,
        name: header,
        status: "error",
        description: `На листе «${sheet}» отсутствует столбец «${header}»`,
      });
    } else {
      result.set(header, index);
    }
  }

  return result.size === requiredHeaders.length ? result : null;
}

function parseArea(value: unknown): CatalogArea | null {
  const normalized = normalizeCatalogKey(value);
  if (normalized === "бар" || normalized === "bar") return "bar";
  if (normalized === "кухня" || normalized === "kitchen") return "kitchen";
  return null;
}

function parseUnit(value: unknown): CatalogUnit | null {
  return UNIT_ALIASES.get(normalizeCatalogKey(value)) ?? null;
}

function parseStatus(value: unknown): CatalogProductStatus | null {
  return STATUS_ALIASES.get(normalizeCatalogKey(value)) ?? null;
}

export function parseCatalogPrice(value: unknown) {
  const raw = normalizeText(value).replace(",", ".");
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return null;
  return parsed;
}

function catalogKey(area: CatalogArea, name: string) {
  return `${area}:${normalizeCatalogKey(name)}`;
}

export function validateCatalogSheetBounds({
  sheet,
  rowCount,
  columnCount,
}: {
  sheet: "Категории" | "Товары";
  rowCount: number;
  columnCount: number;
}) {
  const maxRows =
    sheet === "Категории"
      ? CATALOG_IMPORT_MAX_CATEGORY_SHEET_ROWS
      : CATALOG_IMPORT_MAX_PRODUCT_SHEET_ROWS;
  if (rowCount > maxRows) {
    return `На листе «${sheet}» слишком много строк. Максимум: ${maxRows}`;
  }
  if (columnCount > CATALOG_IMPORT_MAX_SHEET_COLUMNS) {
    return `На листе «${sheet}» слишком много столбцов. Максимум: ${CATALOG_IMPORT_MAX_SHEET_COLUMNS}`;
  }
  return null;
}

function hasOversizedCell(cells: CatalogSheetCell[]) {
  return cells.some((cell) => displayCell(cell).length > CATALOG_IMPORT_MAX_CELL_TEXT_LENGTH);
}

function rowStatusLabel(status: CatalogPreviewRowStatus) {
  if (status === "create") return "Будет создано";
  if (status === "use_existing") return "Будет использовано существующее";
  if (status === "skip") return "Будет пропущено";
  if (status === "warning") return "Предупреждение";
  return "Ошибка";
}

export function catalogPreviewStatusLabel(status: CatalogPreviewRowStatus) {
  return rowStatusLabel(status);
}

export function catalogAreaLabel(area: CatalogArea) {
  return AREA_LABELS[area];
}

export function catalogStatusLabel(status: CatalogProductStatus) {
  return STATUS_LABELS[status];
}

export function validateCatalogFileMeta(file: { name: string; size: number }) {
  const lowerName = file.name.toLocaleLowerCase("ru");
  if (!lowerName.endsWith(".xlsx")) return "Поддерживаются только файлы .xlsx";
  if (lowerName.endsWith(".xlsm") || lowerName.endsWith(".xls") || lowerName.endsWith(".csv")) {
    return "Поддерживаются только файлы .xlsx";
  }
  if (file.size > CATALOG_IMPORT_MAX_FILE_SIZE) return "Файл больше 5 МБ";
  return null;
}

export function resolveCatalogImportTargetNetworkId({
  isSuperAdmin,
  sessionNetworkId,
  requestedNetworkId,
}: {
  isSuperAdmin: boolean;
  sessionNetworkId?: string | null;
  requestedNetworkId?: string | null;
}) {
  if (isSuperAdmin) {
    if (!requestedNetworkId) throw new Error("Выберите сеть ресторанов");
    return requestedNetworkId;
  }
  if (!sessionNetworkId) throw new Error("Пользователю не назначена сеть ресторанов");
  if (requestedNetworkId && requestedNetworkId !== sessionNetworkId) {
    throw new Error("Нет доступа к этой сети ресторанов");
  }
  return sessionNetworkId;
}

export function createCatalogImportPreview({
  sheets,
  targetNetworkId,
  existingCategories,
  existingProducts,
}: {
  sheets: CatalogWorkbookSheets;
  targetNetworkId: string;
  existingCategories: CatalogExistingCategory[];
  existingProducts: CatalogExistingProduct[];
}): CatalogImportPreview {
  const rows: CatalogPreviewRow[] = [];
  const categoriesToImport: CatalogImportCategoryInput[] = [];
  const productsToImport: CatalogImportProductInput[] = [];
  const existingCategoryKeys = new Set(
    existingCategories
      .filter((category) => category.network_id === targetNetworkId)
      .map((category) =>
        catalogKey(category.area === "kitchen" ? "kitchen" : "bar", category.name),
      ),
  );
  const existingProductKeys = new Set(
    existingProducts
      .filter((product) => product.network_id === targetNetworkId)
      .map((product) => catalogKey(product.area === "kitchen" ? "kitchen" : "bar", product.name)),
  );

  const categorySheetName = sheetName(sheets, "Категории");
  const productSheetName = sheetName(sheets, "Товары");
  if (!categorySheetName) {
    rows.push({
      id: "missing-sheet-categories",
      sheet: "Файл",
      rowNumber: null,
      name: "Категории",
      status: "error",
      description: "В файле отсутствует лист «Категории»",
    });
  }
  if (!productSheetName) {
    rows.push({
      id: "missing-sheet-products",
      sheet: "Файл",
      rowNumber: null,
      name: "Товары",
      status: "error",
      description: "В файле отсутствует лист «Товары»",
    });
  }

  const categoryCandidates = new Map<string, CatalogImportCategoryInput>();
  const categoryNameToAreas = new Map<string, Set<CatalogArea>>();
  let categoriesInFile = 0;
  let existingCategoryCount = 0;

  if (categorySheetName) {
    const categoryRows = sheets[categorySheetName] ?? [];
    const headers = headerIndexes(categoryRows, "Категории", ["Название", "Зона"], rows);
    if (headers) {
      for (let index = 1; index < categoryRows.length; index += 1) {
        const row = categoryRows[index] ?? [];
        if (isEmptyRow(row)) continue;
        const rowNumber = index + 1;
        const nameCell = row[headers.get("Название")!];
        const areaCell = row[headers.get("Зона")!];
        const name = displayCell(nameCell);
        const area = parseArea(displayCell(areaCell));
        if (hasCatalogFormulaCell(nameCell) || hasCatalogFormulaCell(areaCell)) {
          rows.push({
            id: `category-formula-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name,
            status: "error",
            description: FORMULA_ERROR,
          });
          continue;
        }
        if (hasOversizedCell([nameCell, areaCell])) {
          rows.push({
            id: `category-too-long-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name,
            status: "error",
            description: "Значение ячейки слишком длинное",
          });
          continue;
        }
        if (!name) {
          rows.push({
            id: `category-name-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name: "",
            status: "error",
            description: "Название категории обязательно",
          });
          continue;
        }
        if (!area) {
          rows.push({
            id: `category-area-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name,
            status: "error",
            description: "Зона должна быть «Бар» или «Кухня»",
          });
          continue;
        }

        categoriesInFile += 1;
        const key = catalogKey(area, name);
        const normalizedName = normalizeCatalogKey(name);
        const areas = categoryNameToAreas.get(normalizedName) ?? new Set<CatalogArea>();
        areas.add(area);
        categoryNameToAreas.set(normalizedName, areas);

        if (categoryCandidates.has(key)) {
          rows.push({
            id: `category-duplicate-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name,
            status: "warning",
            description: "Дубликат категории в файле будет объединён с первой строкой",
          });
          continue;
        }
        const candidate = { name, area };
        categoryCandidates.set(key, candidate);
        if (existingCategoryKeys.has(key)) {
          existingCategoryCount += 1;
          rows.push({
            id: `category-existing-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name,
            status: "use_existing",
            description: "Категория уже существует в выбранной сети и зоне",
          });
        } else {
          categoriesToImport.push(candidate);
          rows.push({
            id: `category-create-${rowNumber}`,
            sheet: "Категории",
            rowNumber,
            name,
            status: "create",
            description: "Категория будет создана",
          });
        }
      }
    }
  }

  let productsInFile = 0;
  let skipped = 0;
  const productKeysInFile = new Set<string>();
  if (productSheetName) {
    const productRows = sheets[productSheetName] ?? [];
    const headers = headerIndexes(
      productRows,
      "Товары",
      ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
      rows,
    );
    if (headers) {
      for (let index = 1; index < productRows.length; index += 1) {
        const row = productRows[index] ?? [];
        if (isEmptyRow(row)) continue;
        const rowNumber = index + 1;
        const cells = {
          name: row[headers.get("Название")!],
          category: row[headers.get("Категория")!],
          unit: row[headers.get("Единица")!],
          area: row[headers.get("Зона")!],
          price: row[headers.get("Цена")!],
          status: row[headers.get("Статус")!],
        };
        const name = displayCell(cells.name);
        const categoryName = displayCell(cells.category);
        const area = parseArea(displayCell(cells.area));
        const unit = parseUnit(displayCell(cells.unit));
        const status = parseStatus(displayCell(cells.status));
        const price = parseCatalogPrice(displayCell(cells.price));

        if (Object.values(cells).some(hasCatalogFormulaCell)) {
          rows.push({
            id: `product-formula-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: FORMULA_ERROR,
          });
          continue;
        }
        if (hasOversizedCell(Object.values(cells))) {
          rows.push({
            id: `product-too-long-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: "Значение ячейки слишком длинное",
          });
          continue;
        }
        productsInFile += 1;
        if (!name || name.length > 200) {
          rows.push({
            id: `product-name-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: "Название товара обязательно и должно быть не длиннее 200 символов",
          });
          continue;
        }
        if (!area) {
          rows.push({
            id: `product-area-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: "Зона должна быть «Бар» или «Кухня»",
          });
          continue;
        }
        if (!unit) {
          rows.push({
            id: `product-unit-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description:
              "Единица должна быть: л, кг, шт или бут. Значения «мл» и «г» не конвертируются автоматически",
          });
          continue;
        }
        if (!status) {
          rows.push({
            id: `product-status-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: "Статус должен быть: Активен, На проверке или Архив",
          });
          continue;
        }
        if (price == null) {
          rows.push({
            id: `product-price-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: "Цена должна быть числом от 0 до 1000000",
          });
          continue;
        }
        if (!categoryName) {
          rows.push({
            id: `product-category-empty-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: "Категория товара обязательна",
          });
          continue;
        }

        const productKey = catalogKey(area, name);
        if (productKeysInFile.has(productKey)) {
          skipped += 1;
          rows.push({
            id: `product-duplicate-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "skip",
            description: "Дубликат товара в загруженном файле",
          });
          continue;
        }
        productKeysInFile.add(productKey);

        if (existingProductKeys.has(productKey)) {
          skipped += 1;
          rows.push({
            id: `product-existing-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "skip",
            description: "Товар уже существует и будет пропущен",
          });
          continue;
        }

        const categoryKey = catalogKey(area, categoryName);
        if (!existingCategoryKeys.has(categoryKey) && !categoryCandidates.has(categoryKey)) {
          const sameNameAreas = categoryNameToAreas.get(normalizeCatalogKey(categoryName));
          const categoryExistsInAnotherArea =
            sameNameAreas && sameNameAreas.size > 0 && !sameNameAreas.has(area);
          rows.push({
            id: `product-category-missing-${rowNumber}`,
            sheet: "Товары",
            rowNumber,
            name,
            status: "error",
            description: categoryExistsInAnotherArea
              ? "Зона товара и категории должна совпадать"
              : "Категория не найдена в выбранной сети и не указана на листе «Категории»",
          });
          continue;
        }

        productsToImport.push({
          name,
          category_name: categoryName,
          area,
          unit,
          status,
          unit_price: price,
        });
        rows.push({
          id: `product-create-${rowNumber}`,
          sheet: "Товары",
          rowNumber,
          name,
          status: "create",
          description: "Товар будет создан",
        });
      }
    }
  }

  const errors = rows.filter((row) => row.status === "error").length;
  if (categoriesInFile > CATALOG_IMPORT_MAX_CATEGORIES) {
    rows.push({
      id: "too-many-categories",
      sheet: "Файл",
      rowNumber: null,
      name: "Категории",
      status: "error",
      description: `В файле больше ${CATALOG_IMPORT_MAX_CATEGORIES} категорий`,
    });
  }
  if (productsInFile > CATALOG_IMPORT_MAX_PRODUCTS) {
    rows.push({
      id: "too-many-products",
      sheet: "Файл",
      rowNumber: null,
      name: "Товары",
      status: "error",
      description: `В файле больше ${CATALOG_IMPORT_MAX_PRODUCTS} товаров`,
    });
  }

  return {
    summary: {
      categoriesInFile,
      newCategories: categoriesToImport.length,
      existingCategories: existingCategoryCount,
      productsInFile,
      readyToImport: productsToImport.length,
      skipped,
      errors:
        errors +
        (categoriesInFile > CATALOG_IMPORT_MAX_CATEGORIES ? 1 : 0) +
        (productsInFile > CATALOG_IMPORT_MAX_PRODUCTS ? 1 : 0),
    },
    rows,
    categoriesToImport,
    productsToImport,
  };
}
