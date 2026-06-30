import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Package, RotateCcw, Save } from "lucide-react";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createProductFn,
  listProductsFn,
  restoreProductFn,
  updateProductsBatchFn,
} from "@/lib/barstock.functions";
import { getCreationCategories } from "@/lib/productCategories";
import { addProductToCache, replaceProductsInCache } from "@/lib/productCache";

type ProductArea = "bar" | "kitchen";
type ProductUnit = "л" | "кг" | "шт" | "бут";
type ProductStatus = "approved" | "pending" | "archived";
type ProductStatusFilter = "active" | "archived" | "all";

export type AdminCategory = {
  id: string;
  name: string;
  area?: ProductArea | string | null;
  network_id: string;
};

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  unit: ProductUnit | string | null;
  status: ProductStatus | string | null;
  unit_price: number | string | null;
  area?: ProductArea | string | null;
  network_id: string;
};

type ProductDraft = {
  name: string;
  category_id: string;
  unit: ProductUnit;
  status: ProductStatus;
  unit_price: string;
  area: ProductArea;
};

type ProductChange = { id: string; draft: ProductDraft };
type CategoryBuckets = Record<ProductArea, AdminCategory[]>;

const PAGE_SIZE = 50;
const EMPTY_CATEGORIES: CategoryBuckets = { bar: [], kitchen: [] };
const productUnits: ProductUnit[] = ["л", "кг", "шт", "бут"];
const productStatuses: ProductStatus[] = ["approved", "pending", "archived"];

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Введите стоимость от 0");
  }
  return parsed;
}

function startDevelopmentTimer() {
  return import.meta.env.DEV ? performance.now() : null;
}

function logDevelopmentTiming(label: string, startedAt: number | null) {
  if (import.meta.env.DEV && startedAt !== null) {
    console.debug(
      `[BarStock performance] ${label}: ${(performance.now() - startedAt).toFixed(1)}ms`,
    );
  }
}

function productDraftFromProduct(product: Product): ProductDraft {
  return {
    name: product.name,
    category_id: product.category_id ?? "",
    unit: productUnits.includes(product.unit as ProductUnit)
      ? (product.unit as ProductUnit)
      : "бут",
    status: productStatuses.includes(product.status as ProductStatus)
      ? (product.status as ProductStatus)
      : "pending",
    unit_price: String(product.unit_price ?? 0),
    area: product.area === "kitchen" ? "kitchen" : "bar",
  };
}

function productDraftsEqual(left: ProductDraft, right: ProductDraft) {
  return (
    left.name === right.name &&
    left.category_id === right.category_id &&
    left.unit === right.unit &&
    left.status === right.status &&
    left.unit_price === right.unit_price &&
    left.area === right.area
  );
}

function categoryBucketsByNetwork(categories: AdminCategory[]) {
  const result = new Map<string, CategoryBuckets>();
  for (const category of categories) {
    const buckets = result.get(category.network_id) ?? { bar: [], kitchen: [] };
    buckets[category.area === "kitchen" ? "kitchen" : "bar"].push(category);
    result.set(category.network_id, buckets);
  }
  return result;
}

export const ProductsSection = memo(function ProductsSection({
  sessionToken,
  isSuperAdmin,
  selectedNetworkId,
  effectiveCreationNetworkId,
  categories,
}: {
  sessionToken: string;
  isSuperAdmin: boolean;
  selectedNetworkId?: string;
  effectiveCreationNetworkId: string;
  categories: AdminCategory[];
}) {
  const queryClient = useQueryClient();
  const listProducts = useServerFn(listProductsFn);
  const updateProductsBatch = useServerFn(updateProductsBatchFn);
  const restoreProduct = useServerFn(restoreProductFn);

  const [productSearch, setProductSearch] = useState("");
  const deferredSearch = useDeferredValue(productSearch);
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productAreaFilter, setProductAreaFilter] = useState<"all" | ProductArea>("all");
  const [productStatusFilter, setProductStatusFilter] = useState<ProductStatusFilter>("active");
  const [productSaveMessage, setProductSaveMessage] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [page, setPage] = useState(1);

  const productsQuery = useQuery({
    queryKey: ["products", selectedNetworkId],
    queryFn: () =>
      listProducts({ data: { session_token: sessionToken, network_id: selectedNetworkId } }),
  });
  const products = useMemo(() => (productsQuery.data ?? []) as Product[], [productsQuery.data]);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const baseDraftById = useMemo(
    () => new Map(products.map((product) => [product.id, productDraftFromProduct(product)])),
    [products],
  );
  const categoriesByNetwork = useMemo(() => categoryBucketsByNetwork(categories), [categories]);
  const categoriesByArea = useMemo(
    () => ({
      bar: categories.filter((category) => category.area !== "kitchen"),
      kitchen: categories.filter((category) => category.area === "kitchen"),
    }),
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const search = deferredSearch.trim().toLowerCase();
    return products.filter((product) => {
      const isArchived = product.status === "archived";
      if (productStatusFilter === "active" && isArchived) return false;
      if (productStatusFilter === "archived" && !isArchived) return false;
      if (productAreaFilter !== "all" && (product.area ?? "bar") !== productAreaFilter) {
        return false;
      }
      if (productCategoryFilter !== "all" && product.category_id !== productCategoryFilter) {
        return false;
      }
      return !search || product.name.toLowerCase().includes(search);
    });
  }, [deferredSearch, productAreaFilter, productCategoryFilter, productStatusFilter, products]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = useMemo(
    () => filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, filteredProducts],
  );

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, productAreaFilter, productCategoryFilter, productStatusFilter]);

  const clearSavedProductDrafts = useCallback((changes: ProductChange[], savedIds: string[]) => {
    const savedIdSet = new Set(savedIds);
    setProductDrafts((previous) => {
      const next = { ...previous };
      for (const change of changes) {
        if (
          savedIdSet.has(change.id) &&
          next[change.id] &&
          productDraftsEqual(next[change.id], change.draft)
        ) {
          delete next[change.id];
        }
      }
      return next;
    });
  }, []);

  const saveProductsMutation = useMutation({
    mutationFn: async (changes: ProductChange[]) => {
      const startedAt = startDevelopmentTimer();
      const updatedProducts = await updateProductsBatch({
        data: {
          session_token: sessionToken,
          products: changes.map(({ id, draft }) => ({
            id,
            ...draft,
            name: draft.name.trim(),
            unit_price: parseMoneyInput(draft.unit_price),
          })),
        },
      });
      logDevelopmentTiming(`batch product request (${changes.length})`, startedAt);
      return updatedProducts as Product[];
    },
    onSuccess: (updatedProducts, changes) => {
      const cacheStartedAt = startDevelopmentTimer();
      queryClient.setQueryData<Product[]>(["products", selectedNetworkId], (current) =>
        replaceProductsInCache(current, updatedProducts, selectedNetworkId),
      );
      logDevelopmentTiming(
        `batch product cache update (${updatedProducts.length})`,
        cacheStartedAt,
      );
      clearSavedProductDrafts(
        changes,
        updatedProducts.map((product) => product.id),
      );
      setProductSaveMessage("Изменения сохранены");
      void queryClient.invalidateQueries({
        queryKey: ["products", selectedNetworkId],
        exact: true,
      });
    },
    onError: () => setProductSaveMessage(null),
  });

  const restoreProductMutation = useMutation({
    mutationFn: (id: string) => restoreProduct({ data: { id, session_token: sessionToken } }),
    onSuccess: (product, id) => {
      queryClient.setQueryData<Product[]>(["products", selectedNetworkId], (current) =>
        addProductToCache(current, product as Product, selectedNetworkId),
      );
      setProductDrafts((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setProductSaveMessage("Товар восстановлен");
      void queryClient.invalidateQueries({
        queryKey: ["products", selectedNetworkId],
        exact: true,
      });
    },
  });
  const restoreProductMutate = restoreProductMutation.mutate;

  const setProductDraft = useCallback(
    (id: string, patch: Partial<ProductDraft>) => {
      const original = productById.get(id);
      const originalDraft = baseDraftById.get(id);
      if (!original || !originalDraft) return;
      setProductSaveMessage(null);
      setProductDrafts((previous) => {
        const nextDraft = { ...(previous[id] ?? originalDraft), ...patch };
        const next = { ...previous };
        if (productDraftsEqual(nextDraft, originalDraft)) delete next[id];
        else next[id] = nextDraft;
        return next;
      });
    },
    [baseDraftById, productById],
  );

  const restoreProductById = useCallback(
    (id: string) => restoreProductMutate(id),
    [restoreProductMutate],
  );

  function saveProductChanges() {
    const changes = Object.entries(productDrafts).map(([id, draft]) => ({ id, draft }));
    if (changes.length === 0) return;
    setProductSaveMessage(null);
    saveProductsMutation.mutate(changes);
  }

  const filterCategories =
    (selectedNetworkId && categoriesByNetwork.get(selectedNetworkId)) || categoriesByArea;
  const allFilterCategories = useMemo(
    () => [...filterCategories.bar, ...filterCategories.kitchen],
    [filterCategories],
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <SectionTitle />
      <ProductCreateForm
        sessionToken={sessionToken}
        isSuperAdmin={isSuperAdmin}
        selectedNetworkId={selectedNetworkId}
        effectiveCreationNetworkId={effectiveCreationNetworkId}
        categories={categories}
      />

      <ErrorText error={saveProductsMutation.error} fallback="Не удалось сохранить товары" />
      <ErrorText error={restoreProductMutation.error} fallback="Не удалось восстановить товар" />
      {productSaveMessage && (
        <p className="mb-3 text-sm text-muted-foreground">{productSaveMessage}</p>
      )}

      <div className="mb-3 flex flex-col gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          value={productStatusFilter}
          onValueChange={(value) => {
            if (value) setProductStatusFilter(value as ProductStatusFilter);
          }}
          className="w-full justify-start overflow-x-auto sm:w-auto"
          aria-label="Фильтр статуса товаров"
        >
          <ToggleGroupItem value="active" className="px-3">
            Активные
          </ToggleGroupItem>
          <ToggleGroupItem value="archived" className="px-3">
            Архив
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="px-3">
            Все
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Поиск по названию"
            className="sm:max-w-sm"
          />
          <select
            value={productAreaFilter}
            onChange={(event) => {
              setProductAreaFilter(event.target.value as "all" | ProductArea);
              setProductCategoryFilter("all");
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все зоны</option>
            <option value="bar">Бар</option>
            <option value="kitchen">Кухня</option>
          </select>
          <select
            value={productCategoryFilter}
            onChange={(event) => setProductCategoryFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все категории</option>
            {allFilterCategories
              .filter(
                (category) =>
                  productAreaFilter === "all" || (category.area ?? "bar") === productAreaFilter,
              )
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {Object.keys(productDrafts).length > 0
              ? `Есть несохранённые изменения: ${Object.keys(productDrafts).length}`
              : "Все изменения сохранены"}
          </p>
          <Button
            type="button"
            disabled={Object.keys(productDrafts).length === 0 || saveProductsMutation.isPending}
            onClick={saveProductChanges}
          >
            <Save className="size-4" />
            {saveProductsMutation.isPending ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      </div>

      <ProductTable
        products={visibleProducts}
        baseDraftById={baseDraftById}
        productDrafts={productDrafts}
        categoriesByNetwork={categoriesByNetwork}
        restorePending={restoreProductMutation.isPending}
        onChange={setProductDraft}
        onRestore={restoreProductById}
      />

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages} · {filteredProducts.length} товаров
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              aria-label="Предыдущая страница"
              title="Предыдущая страница"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              aria-label="Следующая страница"
              title="Следующая страница"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
});

const ProductCreateForm = memo(function ProductCreateForm({
  sessionToken,
  isSuperAdmin,
  selectedNetworkId,
  effectiveCreationNetworkId,
  categories,
}: {
  sessionToken: string;
  isSuperAdmin: boolean;
  selectedNetworkId?: string;
  effectiveCreationNetworkId: string;
  categories: AdminCategory[];
}) {
  const queryClient = useQueryClient();
  const createProduct = useServerFn(createProductFn);
  const [message, setMessage] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<ProductDraft>({
    name: "",
    category_id: "",
    unit: "бут",
    status: "approved",
    unit_price: "0",
    area: "bar",
  });

  const creationCategories = useMemo(
    () =>
      getCreationCategories(categories, effectiveCreationNetworkId, newProduct.area, isSuperAdmin),
    [categories, effectiveCreationNetworkId, isSuperAdmin, newProduct.area],
  );

  useEffect(() => {
    setNewProduct((previous) => {
      if (
        !previous.category_id ||
        creationCategories.some((category) => category.id === previous.category_id)
      ) {
        return previous;
      }
      return { ...previous, category_id: "" };
    });
  }, [creationCategories, effectiveCreationNetworkId, newProduct.area]);

  const createProductMutation = useMutation({
    mutationFn: async (draft: ProductDraft) => {
      const startedAt = startDevelopmentTimer();
      const product = await createProduct({
        data: {
          ...draft,
          network_id: isSuperAdmin ? effectiveCreationNetworkId : undefined,
          unit_price: parseMoneyInput(draft.unit_price),
          session_token: sessionToken,
        },
      });
      logDevelopmentTiming("create product request", startedAt);
      return product as Product;
    },
    onSuccess: (product) => {
      const cacheStartedAt = startDevelopmentTimer();
      queryClient.setQueryData<Product[]>(["products", selectedNetworkId], (current) =>
        addProductToCache(current, product, selectedNetworkId),
      );
      logDevelopmentTiming("create product cache update", cacheStartedAt);
      setNewProduct({
        name: "",
        category_id: "",
        unit: "бут",
        status: "approved",
        unit_price: "0",
        area: "bar",
      });
      setMessage("Товар создан");
      void queryClient.invalidateQueries({
        queryKey: ["products", selectedNetworkId],
        exact: true,
      });
    },
    onError: () => setMessage(null),
  });

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      newProduct.name.trim() &&
      newProduct.category_id &&
      newProduct.unit &&
      (!isSuperAdmin || effectiveCreationNetworkId)
    ) {
      createProductMutation.mutate(newProduct);
    }
  }

  return (
    <>
      <form onSubmit={submitProduct} className="mb-4 grid gap-2 lg:grid-cols-7">
        <Input
          value={newProduct.name}
          onChange={(event) =>
            setNewProduct((previous) => ({ ...previous, name: event.target.value }))
          }
          placeholder="Название товара"
        />
        <CategorySelect
          value={newProduct.category_id}
          categories={creationCategories}
          onChange={(value) => setNewProduct((previous) => ({ ...previous, category_id: value }))}
        />
        <UnitSelect
          value={newProduct.unit}
          onChange={(value) => setNewProduct((previous) => ({ ...previous, unit: value }))}
        />
        <StatusSelect
          value={newProduct.status}
          onChange={(value) => setNewProduct((previous) => ({ ...previous, status: value }))}
        />
        <AreaSelect
          value={newProduct.area}
          onChange={(value) =>
            setNewProduct((previous) => ({ ...previous, area: value, category_id: "" }))
          }
        />
        <Input
          inputMode="decimal"
          value={newProduct.unit_price}
          onChange={(event) =>
            setNewProduct((previous) => ({ ...previous, unit_price: event.target.value }))
          }
          placeholder="Стоимость за единицу, BYN"
        />
        <Button
          type="submit"
          disabled={createProductMutation.isPending || creationCategories.length === 0}
        >
          <Package className="size-4" />
          {createProductMutation.isPending ? "Создание..." : "Создать товар"}
        </Button>
      </form>
      <ErrorText error={createProductMutation.error} fallback="Не удалось создать товар" />
      {message && <p className="mb-3 text-sm text-muted-foreground">{message}</p>}
    </>
  );
});

const ProductTable = memo(function ProductTable({
  products,
  baseDraftById,
  productDrafts,
  categoriesByNetwork,
  restorePending,
  onChange,
  onRestore,
}: {
  products: Product[];
  baseDraftById: Map<string, ProductDraft>;
  productDrafts: Record<string, ProductDraft>;
  categoriesByNetwork: Map<string, CategoryBuckets>;
  restorePending: boolean;
  onChange: (id: string, patch: Partial<ProductDraft>) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left font-medium">Название</th>
            <th className="px-3 py-2 text-left font-medium">Категория</th>
            <th className="px-3 py-2 text-left font-medium">Ед.</th>
            <th className="px-3 py-2 text-left font-medium">Зона</th>
            <th className="px-3 py-2 text-left font-medium">Цена, BYN</th>
            <th className="px-3 py-2 text-left font-medium">Статус</th>
            <th className="px-3 py-2 text-left font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const draft = productDrafts[product.id] ?? baseDraftById.get(product.id)!;
            const categoryBuckets = categoriesByNetwork.get(product.network_id) ?? EMPTY_CATEGORIES;
            return (
              <ProductRow
                key={product.id}
                product={product}
                draft={draft}
                isChanged={Boolean(productDrafts[product.id])}
                availableCategories={categoryBuckets[draft.area]}
                pending={restorePending}
                onChange={onChange}
                onRestore={onRestore}
              />
            );
          })}
          {products.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                Товары не найдены.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
});

const ProductRow = memo(function ProductRow({
  product,
  draft,
  isChanged,
  availableCategories,
  pending,
  onChange,
  onRestore,
}: {
  product: Product;
  draft: ProductDraft;
  isChanged: boolean;
  availableCategories: AdminCategory[];
  pending: boolean;
  onChange: (id: string, patch: Partial<ProductDraft>) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <tr className={`border-b border-border last:border-b-0 ${isChanged ? "bg-primary/5" : ""}`}>
      <td className="px-3 py-2">
        <Input
          value={draft.name}
          onChange={(event) => onChange(product.id, { name: event.target.value })}
          className="min-w-48"
        />
      </td>
      <td className="px-3 py-2">
        <CategorySelect
          value={draft.category_id}
          categories={availableCategories}
          onChange={(value) => onChange(product.id, { category_id: value })}
        />
      </td>
      <td className="px-3 py-2">
        <UnitSelect
          value={draft.unit}
          onChange={(value) => onChange(product.id, { unit: value })}
        />
      </td>
      <td className="px-3 py-2">
        <AreaSelect
          value={draft.area}
          onChange={(value) => onChange(product.id, { area: value, category_id: "" })}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          inputMode="decimal"
          value={draft.unit_price}
          onChange={(event) => onChange(product.id, { unit_price: event.target.value })}
          className="min-w-28 text-right"
        />
      </td>
      <td className="px-3 py-2">
        {product.status === "archived" ? (
          <span className="whitespace-nowrap text-muted-foreground">В архиве</span>
        ) : (
          <StatusSelect
            value={draft.status}
            onChange={(value) => onChange(product.id, { status: value })}
          />
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex min-w-32 gap-2">
          {product.status === "archived" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => onRestore(product.id)}
            >
              <RotateCcw className="size-4" />
              Восстановить
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
});

function SectionTitle() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Package className="size-5 text-primary" />
      <h2 className="text-lg font-semibold">Товары</h2>
    </div>
  );
}

function ErrorText({ error, fallback }: { error: unknown; fallback: string }) {
  if (!error) return null;
  return (
    <p className="mb-3 text-sm text-destructive">
      {error instanceof Error ? error.message : fallback}
    </p>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: AdminCategory[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">Категория</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}

function AreaSelect({
  value,
  onChange,
}: {
  value: ProductArea;
  onChange: (value: ProductArea) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ProductArea)}
      className="h-9 min-w-28 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="bar">Бар</option>
      <option value="kitchen">Кухня</option>
    </select>
  );
}

function UnitSelect({
  value,
  onChange,
}: {
  value: ProductUnit;
  onChange: (value: ProductUnit) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ProductUnit)}
      className="h-9 min-w-24 rounded-md border border-input bg-background px-3 text-sm"
    >
      {productUnits.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: ProductStatus;
  onChange: (value: ProductStatus) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ProductStatus)}
      className="h-9 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="approved">Активен</option>
      <option value="pending">На подтверждении</option>
      <option value="archived">В архиве</option>
    </select>
  );
}
