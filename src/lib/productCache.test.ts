import assert from "node:assert/strict";
import test from "node:test";

import { addProductToCache, replaceProductsInCache } from "./productCache.ts";

type Product = {
  id: string;
  name: string;
  network_id: string;
  status: string;
};

const networkAProduct: Product = {
  id: "product-a",
  name: "Апельсин",
  network_id: "network-a",
  status: "approved",
};

test("created product is added immediately to its selected network cache", () => {
  const result = addProductToCache<Product>([], networkAProduct, "network-a");
  assert.deepEqual(result, [networkAProduct]);
});

test("created product is not added to another network cache", () => {
  const current: Product[] = [
    {
      id: "product-b",
      name: "Банан",
      network_id: "network-b",
      status: "approved",
    },
  ];
  const result = addProductToCache(current, networkAProduct, "network-b");
  assert.equal(result, current);
});

test("created product is added to the all-networks cache", () => {
  const result = addProductToCache<Product>([], networkAProduct);
  assert.deepEqual(result, [networkAProduct]);
});

test("batch response replaces only matching cached products", () => {
  const current: Product[] = [
    networkAProduct,
    {
      id: "product-b",
      name: "Банан",
      network_id: "network-a",
      status: "approved",
    },
  ];
  const updated = { ...networkAProduct, name: "Красный апельсин", status: "archived" };
  const result = replaceProductsInCache(current, [updated], "network-a");
  assert.equal(result?.find((product) => product.id === updated.id)?.name, "Красный апельсин");
  assert.equal(result?.find((product) => product.id === "product-b")?.name, "Банан");
});

test("batch response from another network cannot alter selected cache", () => {
  const current: Product[] = [networkAProduct];
  const foreignUpdate: Product = {
    id: networkAProduct.id,
    name: "Подменённый товар",
    network_id: "network-b",
    status: "archived",
  };
  const result = replaceProductsInCache(current, [foreignUpdate], "network-a");
  assert.equal(result, current);
});
