import assert from "node:assert/strict";
import test from "node:test";

import { CATEGORY_DUPLICATE_MESSAGE, toSafeCategoryMutationError } from "./categoryErrors.ts";

test("category unique violation is converted to the tenant-safe message", () => {
  const rawMessage =
    'duplicate key value violates unique constraint "categories_network_area_name_unique_idx"';
  const error = toSafeCategoryMutationError({ code: "23505", message: rawMessage }, "create");

  assert.equal(error.message, CATEGORY_DUPLICATE_MESSAGE);
  assert.equal(error.message.includes(rawMessage), false);
  assert.equal(error.message.includes("categories_network_area_name_unique_idx"), false);
});

test("category rename unique violation uses the same safe message", () => {
  const error = toSafeCategoryMutationError(
    {
      code: "23505",
      message: 'duplicate key value violates unique constraint "categories_name_key"',
    },
    "update",
  );

  assert.equal(error.message, CATEGORY_DUPLICATE_MESSAGE);
});

test("other category database errors do not expose PostgreSQL details", () => {
  const rawMessage = 'permission denied for table "categories"';
  const createError = toSafeCategoryMutationError({ code: "42501", message: rawMessage }, "create");
  const updateError = toSafeCategoryMutationError({ code: "42501", message: rawMessage }, "update");

  assert.equal(createError.message, "Не удалось создать категорию");
  assert.equal(updateError.message, "Не удалось обновить категорию");
  assert.equal(createError.message.includes(rawMessage), false);
  assert.equal(updateError.message.includes(rawMessage), false);
});
