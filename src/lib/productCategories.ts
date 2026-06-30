export type ProductCategoryArea = "bar" | "kitchen";

export type ProductCategory = {
  id: string;
  area?: ProductCategoryArea | string | null;
  network_id: string;
};

function matchesArea(category: ProductCategory, area: ProductCategoryArea) {
  return (category.area === "kitchen" ? "kitchen" : "bar") === area;
}

export function getCreationCategories<T extends ProductCategory>(
  categories: T[],
  effectiveNetworkId: string,
  area: ProductCategoryArea,
  isSuperAdmin: boolean,
) {
  const networkCategories = effectiveNetworkId
    ? categories.filter((category) => category.network_id === effectiveNetworkId)
    : [];

  if (isSuperAdmin) {
    return networkCategories.filter((category) => matchesArea(category, area));
  }

  const source = networkCategories.length > 0 ? networkCategories : categories;
  return source.filter((category) => matchesArea(category, area));
}
