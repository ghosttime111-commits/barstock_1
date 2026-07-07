import assert from "node:assert/strict";
import test from "node:test";

import {
  createCatalogImportPreview,
  parseCatalogPrice,
  resolveCatalogImportTargetNetworkId,
  validateCatalogFileMeta,
  type CatalogWorkbookSheets,
} from "./catalogImport.ts";

const networkA = "11111111-1111-1111-1111-111111111111";
const networkB = "22222222-2222-2222-2222-222222222222";
const existingCategories = [
  { id: "cat-a-bar", network_id: networkA, area: "bar", name: "Напитки" },
  { id: "cat-b-bar", network_id: networkB, area: "bar", name: "Напитки" },
  { id: "cat-a-kitchen", network_id: networkA, area: "kitchen", name: "Напитки" },
];
const existingProducts = [
  { id: "product-existing", network_id: networkA, area: "bar", name: "Coca-Cola 0.5" },
];

function workbook(overrides: Partial<CatalogWorkbookSheets> = {}): CatalogWorkbookSheets {
  return {
    Категории: [
      ["Название", "Зона"],
      ["Напитки", "Бар"],
      ["Холодный цех", "Кухня"],
    ],
    Товары: [
      ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
      ["Sprite 0.5", "Напитки", "бут", "Бар", "3,50", "Активен"],
      ["Лосось", "Холодный цех", "кг", "Кухня", 42, ""],
    ],
    ...overrides,
  };
}

test("valid catalog workbook creates preview payload", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook(),
    targetNetworkId: networkA,
    existingCategories,
    existingProducts,
  });

  assert.equal(preview.summary.errors, 0);
  assert.equal(preview.summary.newCategories, 1);
  assert.equal(preview.summary.existingCategories, 1);
  assert.equal(preview.summary.readyToImport, 2);
  assert.deepEqual(preview.categoriesToImport, [{ name: "Холодный цех", area: "kitchen" }]);
  assert.equal(preview.productsToImport[0].unit_price, 3.5);
  assert.equal(preview.productsToImport[1].status, "approved");
});

test("missing sheet and missing column are reported", () => {
  const preview = createCatalogImportPreview({
    sheets: { Товары: [["Название"]] },
    targetNetworkId: networkA,
    existingCategories,
    existingProducts,
  });

  assert(preview.rows.some((row) => row.description.includes("лист «Категории»")));
  assert(preview.rows.some((row) => row.description.includes("столбец «Категория»")));
  assert(preview.summary.errors > 0);
});

test("empty product name, invalid area and invalid status fail validation", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Товары: [
        ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
        ["", "Напитки", "бут", "Бар", 1, "Активен"],
        ["Tea", "Напитки", "бут", "Склад", 1, "Активен"],
        ["Coffee", "Напитки", "бут", "Бар", 1, "Черновик"],
      ],
    }),
    targetNetworkId: networkA,
    existingCategories,
    existingProducts,
  });

  assert.equal(preview.summary.readyToImport, 0);
  assert.equal(preview.summary.errors, 3);
});

test("ml and grams are not converted automatically", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Товары: [
        ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
        ["Сок", "Напитки", "мл", "Бар", 1, "Активен"],
        ["Сахар", "Напитки", "г", "Бар", 1, "Активен"],
      ],
    }),
    targetNetworkId: networkA,
    existingCategories,
    existingProducts,
  });

  assert.equal(preview.summary.errors, 2);
  assert(
    preview.rows.every(
      (row) => row.description.includes("не конвертируются") || row.status !== "error",
    ),
  );
});

test("price supports comma and rejects negative/text prices", () => {
  assert.equal(parseCatalogPrice("12,50"), 12.5);
  assert.equal(parseCatalogPrice(""), 0);
  assert.equal(parseCatalogPrice("-1"), null);
  assert.equal(parseCatalogPrice("abc"), null);
});

test("duplicate category is merged and duplicate product is skipped", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Категории: [
        ["Название", "Зона"],
        ["Сиропы", "Бар"],
        [" сиропы ", "Бар"],
      ],
      Товары: [
        ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
        ["Monin", "Сиропы", "л", "Бар", 1, ""],
        [" monin ", "Сиропы", "л", "Бар", 1, ""],
      ],
    }),
    targetNetworkId: networkA,
    existingCategories,
    existingProducts: [],
  });

  assert.equal(preview.summary.newCategories, 1);
  assert.equal(preview.summary.readyToImport, 1);
  assert.equal(preview.summary.skipped, 1);
  assert(preview.rows.some((row) => row.status === "warning"));
});

test("existing product is skipped and existing category in another network does not leak", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Категории: [
        ["Название", "Зона"],
        ["Крепкий алкоголь", "Бар"],
      ],
      Товары: [
        ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
        ["Coca-Cola 0.5", "Напитки", "бут", "Бар", 3, ""],
        ["Whisky", "Напитки", "бут", "Бар", 20, ""],
      ],
    }),
    targetNetworkId: networkB,
    existingCategories,
    existingProducts,
  });

  assert.equal(preview.summary.readyToImport, 2);
  assert.equal(preview.summary.skipped, 0);
});

test("unknown category and mismatched category area are errors", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Категории: [
        ["Название", "Зона"],
        ["Горячий цех", "Кухня"],
      ],
      Товары: [
        ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
        ["Vodka", "Неизвестно", "бут", "Бар", 1, ""],
        ["Salmon", "Горячий цех", "кг", "Бар", 1, ""],
      ],
    }),
    targetNetworkId: networkA,
    existingCategories: [],
    existingProducts: [],
  });

  assert.equal(preview.summary.errors, 2);
  assert(preview.rows.some((row) => row.description.includes("не найдена")));
  assert(preview.rows.some((row) => row.description.includes("Зона товара")));
});

test("formula cells are rejected", () => {
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Товары: [
        ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
        ["Sprite", "Напитки", "бут", "Бар", { value: 3, formula: "1+2" }, ""],
      ],
    }),
    targetNetworkId: networkA,
    existingCategories,
    existingProducts: [],
  });

  assert.equal(preview.summary.errors, 1);
  assert(preview.rows[preview.rows.length - 1].description.includes("Формулы"));
});

test("file limits and network selection are enforced by pure helpers", () => {
  assert.equal(validateCatalogFileMeta({ name: "catalog.xlsx", size: 10 }), null);
  assert.equal(
    validateCatalogFileMeta({ name: "catalog.xls", size: 10 }),
    "Поддерживаются только файлы .xlsx",
  );
  assert.equal(
    validateCatalogFileMeta({ name: "catalog.xlsx", size: 6 * 1024 * 1024 }),
    "Файл больше 5 МБ",
  );

  assert.equal(
    resolveCatalogImportTargetNetworkId({
      isSuperAdmin: false,
      sessionNetworkId: networkA,
      requestedNetworkId: networkA,
    }),
    networkA,
  );
  assert.throws(() =>
    resolveCatalogImportTargetNetworkId({
      isSuperAdmin: false,
      sessionNetworkId: networkA,
      requestedNetworkId: networkB,
    }),
  );
  assert.throws(() =>
    resolveCatalogImportTargetNetworkId({
      isSuperAdmin: true,
      requestedNetworkId: null,
    }),
  );
});

test("too many products are rejected before import", () => {
  const productRows = Array.from({ length: 2001 }, (_, index) => [
    `Товар ${index}`,
    "Напитки",
    "бут",
    "Бар",
    1,
    "",
  ]);
  const preview = createCatalogImportPreview({
    sheets: workbook({
      Товары: [["Название", "Категория", "Единица", "Зона", "Цена", "Статус"], ...productRows],
    }),
    targetNetworkId: networkA,
    existingCategories,
    existingProducts: [],
  });

  assert(preview.summary.errors > 0);
  assert(preview.rows.some((row) => row.description.includes("больше 2000 товаров")));
});
