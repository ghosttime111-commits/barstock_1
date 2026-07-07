import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createCatalogImportPreview,
  hasCatalogFormulaCell,
  resolveCatalogImportTargetNetworkId,
  validateCatalogSheetBounds,
  type CatalogWorkbookSheets,
} from "./catalogImport.ts";
import { addProductsToCache } from "./productCache.ts";

const importMigration = readFileSync(
  new URL("../../db/import_catalog_batch.sql", import.meta.url),
  "utf8",
).toLowerCase();
const productUniquenessMigration = readFileSync(
  new URL("../../db/products_unique_per_network.sql", import.meta.url),
  "utf8",
).toLowerCase();
const serverFunctions = readFileSync(new URL("./barstock.functions.ts", import.meta.url), "utf8");
const importDialog = readFileSync(
  new URL("../components/admin/CatalogImportDialog.tsx", import.meta.url),
  "utf8",
);

const networkA = "11111111-1111-1111-1111-111111111111";
const networkB = "22222222-2222-2222-2222-222222222222";

test("import RPC migration verifies prerequisite tenant uniqueness indexes before creating RPC", () => {
  const categoryCheckPosition = importMigration.indexOf("categories_network_area_name_unique_idx");
  const productCheckPosition = importMigration.indexOf("products_network_area_name_unique_idx");
  const createFunctionPosition = importMigration.indexOf("create or replace function");

  assert.ok(categoryCheckPosition >= 0);
  assert.ok(productCheckPosition >= 0);
  assert.ok(createFunctionPosition > productCheckPosition);
  assert.match(importMigration, /apply db\/categories_unique_per_network\.sql first/);
  assert.match(importMigration, /apply db\/products_unique_per_network\.sql first/);
});

test("import RPC has restricted execution rights after create or replace function", () => {
  const createFunctionPosition = importMigration.indexOf("create or replace function");
  const revokePublicPosition = importMigration.indexOf(
    "revoke all on function public.import_catalog_batch(uuid, jsonb, jsonb) from public",
  );
  const revokeAnonPosition = importMigration.indexOf(
    "revoke all on function public.import_catalog_batch(uuid, jsonb, jsonb) from anon",
  );
  const revokeAuthenticatedPosition = importMigration.indexOf(
    "revoke all on function public.import_catalog_batch(uuid, jsonb, jsonb) from authenticated",
  );
  const grantServicePosition = importMigration.indexOf(
    "grant execute on function public.import_catalog_batch(uuid, jsonb, jsonb) to service_role",
  );

  assert.match(importMigration, /security invoker/);
  assert.match(importMigration, /set search_path = ''/);
  assert.ok(revokePublicPosition > createFunctionPosition);
  assert.ok(revokeAnonPosition > createFunctionPosition);
  assert.ok(revokeAuthenticatedPosition > createFunctionPosition);
  assert.ok(grantServicePosition > createFunctionPosition);
});

test("import RPC uses transaction-level locks and database conflict handling", () => {
  assert.match(importMigration, /^\s*begin;/);
  assert.match(importMigration, /commit;\s*$/);
  assert.match(importMigration, /pg_advisory_xact_lock/);
  assert.match(
    importMigration,
    /on conflict \(network_id, area, \(lower\(btrim\(name\)\)\)\) do nothing/,
  );
  assert.doesNotMatch(importMigration, /exception\s+when/i);
});

test("product uniqueness migration protects network and area product identity", () => {
  assert.match(productUniquenessMigration, /^\s*begin;/);
  assert.match(productUniquenessMigration, /having count\(\*\) > 1/);
  assert.match(productUniquenessMigration, /group by network_id, area, lower\(btrim\(name\)\)/);
  assert.match(
    productUniquenessMigration,
    /create unique index if not exists products_network_area_name_unique_idx\s+on public\.products\s*\(\s*network_id,\s*area,\s*lower\(btrim\(name\)\)\s*\)/,
  );
  assert.match(productUniquenessMigration, /drop constraint %i/i);
  assert.doesNotMatch(productUniquenessMigration, /update\s+public\.products/);
  assert.doesNotMatch(productUniquenessMigration, /delete\s+from\s+public\.products/);
});

test("server import ignores accountant network spoofing and checks active network before RPC", () => {
  assert.throws(() =>
    resolveCatalogImportTargetNetworkId({
      isSuperAdmin: false,
      sessionNetworkId: networkA,
      requestedNetworkId: networkB,
    }),
  );
  assert.match(serverFunctions, /requirePermission\(ctx, PERMISSIONS\.CATEGORIES_MANAGE\)/);
  assert.match(serverFunctions, /requirePermission\(ctx, PERMISSIONS\.PRODUCTS_MANAGE\)/);
  assert.match(serverFunctions, /\.from\("restaurant_networks"\)/);
  assert.match(serverFunctions, /network\.is_active === false/);

  const networkCheckPosition = serverFunctions.indexOf('.from("restaurant_networks")');
  const rpcPosition = serverFunctions.indexOf('sb.rpc("import_catalog_batch"');
  assert.ok(networkCheckPosition >= 0);
  assert.ok(rpcPosition > networkCheckPosition);
});

test("preview rejects formula cells even when a cached value exists", () => {
  assert.equal(hasCatalogFormulaCell({ value: 3, formula: "1+2" }), true);

  const sheets: CatalogWorkbookSheets = {
    Категории: [["Название", "Зона"]],
    Товары: [
      ["Название", "Категория", "Единица", "Зона", "Цена", "Статус"],
      ["Sprite", "Напитки", "бут", "Бар", { value: 3, formula: "1+2" }, ""],
    ],
  };
  const preview = createCatalogImportPreview({
    sheets,
    targetNetworkId: networkA,
    existingCategories: [{ id: "cat", network_id: networkA, area: "bar", name: "Напитки" }],
    existingProducts: [],
  });

  assert.equal(preview.summary.errors, 1);
  assert(preview.rows.some((row) => row.description.includes("Формулы")));
});

test("sheet bounds reject huge worksheet ranges before row conversion", () => {
  assert.equal(
    validateCatalogSheetBounds({ sheet: "Товары", rowCount: 2002, columnCount: 6 }),
    "На листе «Товары» слишком много строк. Максимум: 2001",
  );
  assert.equal(
    validateCatalogSheetBounds({ sheet: "Категории", rowCount: 10, columnCount: 33 }),
    "На листе «Категории» слишком много столбцов. Максимум: 32",
  );
});

test("RPC errors do not update product cache", () => {
  const current = [{ id: "existing", name: "Кола", network_id: networkA }];
  const result = addProductsToCache(current, [], networkA);
  assert.deepEqual(result, current);
});

test("import dialog blocks double submit and close while import is in flight", () => {
  assert.match(importDialog, /importInFlightRef/);
  assert.match(importDialog, /Импорт уже выполняется/);
  assert.match(importDialog, /if \(!nextOpen && importInFlightRef\.current\) return/);
  assert.match(importDialog, /disabled=\{importMutation\.isPending\}/);
});
