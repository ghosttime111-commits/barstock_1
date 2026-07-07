export type NetworkProduct = {
  id: string;
  name: string;
  network_id: string;
};

function byName<T extends NetworkProduct>(left: T, right: T) {
  return left.name.localeCompare(right.name, "ru");
}

export function addProductToCache<T extends NetworkProduct>(
  current: T[] | undefined,
  product: T,
  selectedNetworkId?: string,
) {
  if (selectedNetworkId && product.network_id !== selectedNetworkId) return current;
  const products = current ?? [];
  const existingIndex = products.findIndex((item) => item.id === product.id);
  if (existingIndex < 0) return [...products, product].sort(byName);
  return products.map((item) => (item.id === product.id ? product : item)).sort(byName);
}

export function addProductsToCache<T extends NetworkProduct>(
  current: T[] | undefined,
  importedProducts: T[],
  selectedNetworkId?: string,
) {
  const products = current ?? [];
  const next = new Map(products.map((product) => [product.id, product]));
  for (const product of importedProducts) {
    if (!selectedNetworkId || product.network_id === selectedNetworkId) {
      next.set(product.id, product);
    }
  }
  return Array.from(next.values()).sort(byName);
}

export function replaceProductsInCache<T extends NetworkProduct>(
  current: T[] | undefined,
  updatedProducts: T[],
  selectedNetworkId?: string,
) {
  if (!current) return current;
  const updates = new Map(
    updatedProducts
      .filter((product) => !selectedNetworkId || product.network_id === selectedNetworkId)
      .map((product) => [product.id, product]),
  );
  if (updates.size === 0) return current;
  return current.map((product) => updates.get(product.id) ?? product).sort(byName);
}
