import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../db/categories_unique_per_network.sql", import.meta.url),
  "utf8",
).toLowerCase();

test("category uniqueness migration is transactional and checks duplicates first", () => {
  assert.match(migration, /^\s*begin;/);
  assert.match(migration, /having count\(\*\) > 1/);
  assert.match(migration, /group by network_id, area, lower\(btrim\(name\)\)/);
  assert.match(migration, /commit;\s*$/);

  const duplicateCheckPosition = migration.indexOf("having count(*) > 1");
  const firstDropPosition = migration.indexOf("drop constraint");
  assert.ok(duplicateCheckPosition >= 0);
  assert.ok(firstDropPosition > duplicateCheckPosition);
});

test("category uniqueness migration creates the normalized tenant index", () => {
  assert.match(
    migration,
    /create unique index if not exists categories_network_area_name_unique_idx\s+on public\.categories\s*\(\s*network_id,\s*area,\s*lower\(btrim\(name\)\)\s*\)/,
  );
});

test("target category identity separates networks and areas but normalizes case and edge spaces", () => {
  const categoryKey = (networkId: string, area: string, name: string) =>
    `${networkId}\u0000${area}\u0000${name.trim().toLocaleLowerCase("ru")}`;

  const networkABar = categoryKey("network-a", "bar", "Напитки");
  assert.notEqual(networkABar, categoryKey("network-b", "bar", "Напитки"));
  assert.notEqual(networkABar, categoryKey("network-a", "kitchen", "Напитки"));
  assert.equal(networkABar, categoryKey("network-a", "bar", "напитки"));
  assert.equal(networkABar, categoryKey("network-a", "bar", " Напитки "));
});

test("category uniqueness migration does not change category or product data", () => {
  assert.doesNotMatch(migration, /update\s+public\.categories/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.categories/);
  assert.doesNotMatch(migration, /update\s+public\.products/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.products/);
  assert.doesNotMatch(migration, /category_id\s*=/);
});
