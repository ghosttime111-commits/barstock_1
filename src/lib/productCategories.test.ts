import assert from "node:assert/strict";
import test from "node:test";

import { getCreationCategories } from "./productCategories.ts";

const categories = [
  { id: "a-bar", network_id: "network-a", area: "bar" },
  { id: "a-kitchen", network_id: "network-a", area: "kitchen" },
  { id: "b-bar", network_id: "network-b", area: "bar" },
  { id: "b-kitchen", network_id: "network-b", area: "kitchen" },
] as const;

test("accountant uses categories from the session network", () => {
  assert.deepEqual(
    getCreationCategories([...categories], "network-a", "bar", false).map(({ id }) => id),
    ["a-bar"],
  );
  assert.deepEqual(
    getCreationCategories([...categories], "network-a", "kitchen", false).map(({ id }) => id),
    ["a-kitchen"],
  );
});

test("accountant safely falls back to its server-filtered category list", () => {
  const serverFilteredCategories = categories.filter(
    ({ network_id }) => network_id === "network-a",
  );

  assert.deepEqual(
    getCreationCategories([...serverFilteredCategories], "", "bar", false).map(({ id }) => id),
    ["a-bar"],
  );
});

test("super admin only sees categories from the selected network", () => {
  assert.deepEqual(
    getCreationCategories([...categories], "network-a", "bar", true).map(({ id }) => id),
    ["a-bar"],
  );
  assert.deepEqual(
    getCreationCategories([...categories], "network-b", "bar", true).map(({ id }) => id),
    ["b-bar"],
  );
  assert.deepEqual(getCreationCategories([...categories], "", "bar", true), []);
});
