import assert from "node:assert/strict";
import test from "node:test";

import { parseQuantityExpression } from "./quantityExpression.ts";

test("parseQuantityExpression sums integer parts", () => {
  assert.equal(parseQuantityExpression("2+3"), 5);
});

test("parseQuantityExpression supports spaces and decimals", () => {
  assert.equal(parseQuantityExpression("2 + 3 + 1.5"), 6.5);
});

test("parseQuantityExpression accepts a plain number", () => {
  assert.equal(parseQuantityExpression("12"), 12);
});

test("parseQuantityExpression sums fractional values", () => {
  assert.equal(parseQuantityExpression("0.5+0.25"), 0.75);
});

test("parseQuantityExpression rejects repeated plus signs", () => {
  assert.throws(() => parseQuantityExpression("2++3"), /Некорректное выражение/);
});

test("parseQuantityExpression rejects non-numeric input", () => {
  assert.throws(() => parseQuantityExpression("abc"), /Некорректное выражение/);
});
