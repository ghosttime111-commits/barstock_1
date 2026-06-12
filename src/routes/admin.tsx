import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, Package, Save, Tags, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveProductFn,
  createBartenderFn,
  createCategoryFn,
  createProductFn,
  createRestaurantFn,
  deleteCategoryFn,
  deleteBartenderFn,
  deleteProductFn,
  deleteRestaurantFn,
  listBartendersFn,
  listCategoriesFn,
  listProductsFn,
  listRestaurantsFn,
  updateBartenderRestaurantFn,
  updateCategoryFn,
  updateProductFn,
} from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Управление — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant"]}>
      <AdminPage />
    </AppShell>
  ),
});

type Restaurant = { id: string; name: string };
type Bartender = { id: string; name: string; login: string; restaurant_id: string | null };
type Category = { id: string; name: string };
type ProductUnit = "л" | "кг" | "шт" | "бут";
type ProductStatus = "approved" | "pending" | "archived";
type Product = {
  id: string;
  name: string;
  category_id: string | null;
  unit: ProductUnit | string | null;
  status: ProductStatus | string | null;
};
type ProductDraft = {
  name: string;
  category_id: string;
  unit: ProductUnit;
  status: ProductStatus;
};

const productUnits: ProductUnit[] = ["л", "кг", "шт", "бут"];
const productStatuses: ProductStatus[] = ["approved", "pending", "archived"];

function productStatusLabel(status: ProductStatus) {
  if (status === "approved") return "Активен";
  if (status === "pending") return "На подтверждении";
  return "В архиве";
}

function AdminPage() {
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const queryClient = useQueryClient();

  const listRestaurants = useServerFn(listRestaurantsFn);
  const createRestaurant = useServerFn(createRestaurantFn);
  const listBartenders = useServerFn(listBartendersFn);
  const createBartender = useServerFn(createBartenderFn);
  const deleteBartender = useServerFn(deleteBartenderFn);
  const deleteRestaurant = useServerFn(deleteRestaurantFn);
  const updateBartenderRestaurant = useServerFn(updateBartenderRestaurantFn);
  const listCategories = useServerFn(listCategoriesFn);
  const createCategory = useServerFn(createCategoryFn);
  const updateCategory = useServerFn(updateCategoryFn);
  const deleteCategory = useServerFn(deleteCategoryFn);
  const listProducts = useServerFn(listProductsFn);
  const createProduct = useServerFn(createProductFn);
  const updateProduct = useServerFn(updateProductFn);
  const archiveProduct = useServerFn(archiveProductFn);
  const deleteProduct = useServerFn(deleteProductFn);

  const [restaurantName, setRestaurantName] = useState("");
  const [bartenderName, setBartenderName] = useState("");
  const [bartenderLogin, setBartenderLogin] = useState("");
  const [bartenderPassword, setBartenderPassword] = useState("");
  const [bartenderRestaurantId, setBartenderRestaurantId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [categoryName, setCategoryName] = useState("");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productDeleteMessage, setProductDeleteMessage] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [newProduct, setNewProduct] = useState<ProductDraft>({
    name: "",
    category_id: "",
    unit: "бут",
    status: "approved",
  });

  const restaurantsQuery = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => listRestaurants({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });
  const bartendersQuery = useQuery({
    queryKey: ["bartenders"],
    queryFn: () => listBartenders({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const restaurants = useMemo(
    () => (restaurantsQuery.data ?? []) as Restaurant[],
    [restaurantsQuery.data],
  );
  const bartenders = useMemo(
    () => (bartendersQuery.data ?? []) as Bartender[],
    [bartendersQuery.data],
  );
  const categories = useMemo(
    () => (categoriesQuery.data ?? []) as Category[],
    [categoriesQuery.data],
  );
  const products = useMemo(() => (productsQuery.data ?? []) as Product[], [productsQuery.data]);
  const restaurantById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
    [restaurants],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (productCategoryFilter !== "all" && product.category_id !== productCategoryFilter) {
        return false;
      }
      if (search && !product.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [productCategoryFilter, productSearch, products]);

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
      queryClient.invalidateQueries({ queryKey: ["bartenders"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
    ]);
  };

  const createRestaurantMutation = useMutation({
    mutationFn: () =>
      createRestaurant({ data: { name: restaurantName.trim(), session_token: sessionToken! } }),
    onSuccess: async (restaurant) => {
      setRestaurantName("");
      if (!bartenderRestaurantId) setBartenderRestaurantId(restaurant.id);
      await refreshAdminData();
    },
  });
  const createBartenderMutation = useMutation({
    mutationFn: () =>
      createBartender({
        data: {
          name: bartenderName.trim(),
          login: bartenderLogin.trim(),
          password: bartenderPassword,
          restaurant_id: bartenderRestaurantId,
          session_token: sessionToken!,
        },
      }),
    onSuccess: async () => {
      setBartenderName("");
      setBartenderLogin("");
      setBartenderPassword("");
      await refreshAdminData();
    },
  });
  const updateBartenderMutation = useMutation({
    mutationFn: ({ id, restaurantId }: { id: string; restaurantId: string }) =>
      updateBartenderRestaurant({
        data: { id, restaurant_id: restaurantId, session_token: sessionToken! },
      }),
    onSuccess: refreshAdminData,
  });
  const deleteBartenderMutation = useMutation({
    mutationFn: (id: string) => deleteBartender({ data: { id, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const deleteRestaurantMutation = useMutation({
    mutationFn: (id: string) => deleteRestaurant({ data: { id, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const createCategoryMutation = useMutation({
    mutationFn: () =>
      createCategory({ data: { name: categoryName.trim(), session_token: sessionToken! } }),
    onSuccess: async () => {
      setCategoryName("");
      await refreshAdminData();
    },
  });
  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      updateCategory({ data: { id, name: name.trim(), session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const createProductMutation = useMutation({
    mutationFn: () => createProduct({ data: { ...newProduct, session_token: sessionToken! } }),
    onSuccess: async () => {
      setNewProduct({ name: "", category_id: "", unit: "бут", status: "approved" });
      await refreshAdminData();
    },
  });
  const updateProductMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: ProductDraft }) =>
      updateProduct({ data: { id, ...draft, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const archiveProductMutation = useMutation({
    mutationFn: (id: string) => archiveProduct({ data: { id, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => deleteProduct({ data: { id, session_token: sessionToken! } }),
    onSuccess: async (result) => {
      setProductDeleteMessage(result.message);
      await refreshAdminData();
    },
  });

  function productDraft(product: Product): ProductDraft {
    return (
      productDrafts[product.id] ?? {
        name: product.name,
        category_id: product.category_id ?? "",
        unit: productUnits.includes(product.unit as ProductUnit)
          ? (product.unit as ProductUnit)
          : "бут",
        status: productStatuses.includes(product.status as ProductStatus)
          ? (product.status as ProductStatus)
          : "pending",
      }
    );
  }

  function setProductDraft(id: string, patch: Partial<ProductDraft>) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setProductDrafts((prev) => ({ ...prev, [id]: { ...productDraft(product), ...patch } }));
  }

  function submitRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (restaurantName.trim()) createRestaurantMutation.mutate();
  }

  function submitBartender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      bartenderName.trim() &&
      bartenderLogin.trim() &&
      bartenderPassword &&
      bartenderRestaurantId
    ) {
      createBartenderMutation.mutate();
    }
  }

  function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryName.trim()) createCategoryMutation.mutate();
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newProduct.name.trim() && newProduct.category_id && newProduct.unit) {
      createProductMutation.mutate();
    }
  }

  function confirmDeleteBartender(id: string, name: string) {
    if (!window.confirm(`Удалить бармена "${name}"?`)) return;
    deleteBartenderMutation.mutate(id);
  }

  function confirmDeleteRestaurant(id: string, name: string) {
    if (!window.confirm(`Удалить ресторан "${name}"?`)) return;
    deleteRestaurantMutation.mutate(id);
  }

  function confirmDeleteProduct(id: string, name: string) {
    if (!window.confirm(`Удалить товар "${name}"?`)) return;
    setProductDeleteMessage(null);
    deleteProductMutation.mutate(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Управление</h1>
        <p className="text-sm text-muted-foreground">
          Рестораны, бармены, категории и товары для переучётов.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <SectionTitle icon={<Building2 className="size-5 text-primary" />} title="Рестораны" />
        <form onSubmit={submitRestaurant} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={restaurantName}
            onChange={(event) => setRestaurantName(event.target.value)}
            placeholder="Название ресторана"
            className="sm:max-w-sm"
          />
          <Button type="submit" disabled={createRestaurantMutation.isPending}>
            <Building2 className="size-4" />
            {createRestaurantMutation.isPending ? "Сохранение..." : "Создать ресторан"}
          </Button>
        </form>
        <ErrorText error={createRestaurantMutation.error} fallback="Не удалось создать ресторан" />
        <ErrorText error={deleteRestaurantMutation.error} fallback="Не удалось удалить ресторан" />
        {restaurantsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : restaurants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ресторанов пока нет.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {restaurants.map((restaurant) => (
              <li
                key={restaurant.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>{restaurant.name}</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleteRestaurantMutation.isPending}
                  onClick={() => confirmDeleteRestaurant(restaurant.id, restaurant.name)}
                >
                  <Trash2 className="size-4" />
                  Удалить
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <SectionTitle icon={<UserPlus className="size-5 text-primary" />} title="Бармены" />
        <form onSubmit={submitBartender} className="mb-5 grid gap-2 md:grid-cols-5">
          <Input
            value={bartenderName}
            onChange={(event) => setBartenderName(event.target.value)}
            placeholder="Имя"
          />
          <Input
            value={bartenderLogin}
            onChange={(event) => setBartenderLogin(event.target.value)}
            placeholder="Логин"
          />
          <Input
            value={bartenderPassword}
            onChange={(event) => setBartenderPassword(event.target.value)}
            placeholder="Пароль"
            type="password"
          />
          <RestaurantSelect
            value={bartenderRestaurantId}
            restaurants={restaurants}
            onChange={setBartenderRestaurantId}
          />
          <Button
            type="submit"
            disabled={createBartenderMutation.isPending || restaurants.length === 0}
          >
            <UserPlus className="size-4" />
            {createBartenderMutation.isPending ? "Создание..." : "Создать бармена"}
          </Button>
        </form>
        <ErrorText error={createBartenderMutation.error} fallback="Не удалось создать бармена" />
        <ErrorText
          error={updateBartenderMutation.error}
          fallback="Не удалось изменить ресторан бармена"
        />
        <ErrorText error={deleteBartenderMutation.error} fallback="Не удалось удалить бармена" />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Имя</th>
                <th className="px-3 py-2 text-left font-medium">Логин</th>
                <th className="px-3 py-2 text-left font-medium">Ресторан</th>
                <th className="px-3 py-2 text-left font-medium">Назначение</th>
                <th className="px-3 py-2 text-left font-medium">Удаление</th>
              </tr>
            </thead>
            <tbody>
              {bartenders.map((bartender) => {
                const selectedRestaurantId =
                  assignments[bartender.id] ?? bartender.restaurant_id ?? "";
                return (
                  <tr key={bartender.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-medium">{bartender.name}</td>
                    <td className="px-3 py-2">{bartender.login}</td>
                    <td className="px-3 py-2">
                      {bartender.restaurant_id
                        ? (restaurantById.get(bartender.restaurant_id) ?? "Не найден")
                        : "Не назначен"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-64 gap-2">
                        <RestaurantSelect
                          value={selectedRestaurantId}
                          restaurants={restaurants}
                          onChange={(value) =>
                            setAssignments((prev) => ({ ...prev, [bartender.id]: value }))
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !selectedRestaurantId ||
                            selectedRestaurantId === bartender.restaurant_id ||
                            updateBartenderMutation.isPending
                          }
                          onClick={() =>
                            updateBartenderMutation.mutate({
                              id: bartender.id,
                              restaurantId: selectedRestaurantId,
                            })
                          }
                        >
                          <Save className="size-4" />
                          Сохранить
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={deleteBartenderMutation.isPending}
                        onClick={() => confirmDeleteBartender(bartender.id, bartender.name)}
                      >
                        <Trash2 className="size-4" />
                        Удалить
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <SectionTitle icon={<Tags className="size-5 text-primary" />} title="Категории товаров" />
        <form onSubmit={submitCategory} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Название категории"
            className="sm:max-w-sm"
          />
          <Button type="submit" disabled={createCategoryMutation.isPending}>
            <Tags className="size-4" />
            {createCategoryMutation.isPending ? "Сохранение..." : "Создать категорию"}
          </Button>
        </form>
        <ErrorText error={createCategoryMutation.error} fallback="Не удалось создать категорию" />
        <ErrorText
          error={updateCategoryMutation.error}
          fallback="Не удалось переименовать категорию"
        />
        <ErrorText error={deleteCategoryMutation.error} fallback="Не удалось удалить категорию" />
        <ul className="divide-y divide-border rounded-lg border border-border">
          {categories.map((category) => {
            const value = categoryNames[category.id] ?? category.name;
            return (
              <li key={category.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row">
                <Input
                  value={value}
                  onChange={(event) =>
                    setCategoryNames((prev) => ({ ...prev, [category.id]: event.target.value }))
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    !value.trim() || value === category.name || updateCategoryMutation.isPending
                  }
                  onClick={() => updateCategoryMutation.mutate({ id: category.id, name: value })}
                >
                  <Save className="size-4" />
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteCategoryMutation.isPending}
                  onClick={() => deleteCategoryMutation.mutate(category.id)}
                >
                  Удалить
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <SectionTitle icon={<Package className="size-5 text-primary" />} title="Товары" />
        <form onSubmit={submitProduct} className="mb-4 grid gap-2 lg:grid-cols-5">
          <Input
            value={newProduct.name}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Название товара"
          />
          <CategorySelect
            value={newProduct.category_id}
            categories={categories}
            onChange={(value) => setNewProduct((prev) => ({ ...prev, category_id: value }))}
          />
          <UnitSelect
            value={newProduct.unit}
            onChange={(value) => setNewProduct((prev) => ({ ...prev, unit: value }))}
          />
          <StatusSelect
            value={newProduct.status}
            onChange={(value) => setNewProduct((prev) => ({ ...prev, status: value }))}
          />
          <Button
            type="submit"
            disabled={createProductMutation.isPending || categories.length === 0}
          >
            <Package className="size-4" />
            {createProductMutation.isPending ? "Создание..." : "Создать товар"}
          </Button>
        </form>
        <ErrorText error={createProductMutation.error} fallback="Не удалось создать товар" />
        <ErrorText error={updateProductMutation.error} fallback="Не удалось сохранить товар" />
        <ErrorText error={archiveProductMutation.error} fallback="Не удалось архивировать товар" />
        <ErrorText error={deleteProductMutation.error} fallback="Не удалось удалить товар" />
        {productDeleteMessage && (
          <p className="mb-3 text-sm text-muted-foreground">{productDeleteMessage}</p>
        )}

        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Поиск по названию"
            className="sm:max-w-sm"
          />
          <select
            value={productCategoryFilter}
            onChange={(event) => setProductCategoryFilter(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Название</th>
                <th className="px-3 py-2 text-left font-medium">Категория</th>
                <th className="px-3 py-2 text-left font-medium">Ед.</th>
                <th className="px-3 py-2 text-left font-medium">Статус</th>
                <th className="px-3 py-2 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const draft = productDraft(product);
                return (
                  <tr key={product.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <Input
                        value={draft.name}
                        onChange={(event) =>
                          setProductDraft(product.id, { name: event.target.value })
                        }
                        className="min-w-48"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <CategorySelect
                        value={draft.category_id}
                        categories={categories}
                        onChange={(value) => setProductDraft(product.id, { category_id: value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <UnitSelect
                        value={draft.unit}
                        onChange={(value) => setProductDraft(product.id, { unit: value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect
                        value={draft.status}
                        onChange={(value) => setProductDraft(product.id, { status: value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-56 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !draft.name.trim() ||
                            !draft.category_id ||
                            updateProductMutation.isPending
                          }
                          onClick={() => updateProductMutation.mutate({ id: product.id, draft })}
                        >
                          <Save className="size-4" />
                          Сохранить
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={
                            product.status === "archived" || archiveProductMutation.isPending
                          }
                          onClick={() => archiveProductMutation.mutate(product.id)}
                        >
                          <Archive className="size-4" />
                          Архив
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteProductMutation.isPending}
                          onClick={() => confirmDeleteProduct(product.id, product.name)}
                        >
                          <Trash2 className="size-4" />
                          Удалить
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                    Товары не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-semibold">{title}</h2>
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

function SimpleList({
  loading,
  empty,
  items,
}: {
  loading: boolean;
  empty: string;
  items: Array<{ id: string; label: string }>;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Загрузка...</p>;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id} className="px-3 py-2 text-sm">
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function RestaurantSelect({
  value,
  restaurants,
  onChange,
}: {
  value: string;
  restaurants: Restaurant[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">Ресторан</option>
      {restaurants.map((restaurant) => (
        <option key={restaurant.id} value={restaurant.id}>
          {restaurant.name}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: Category[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      {productStatuses.map((status) => (
        <option key={status} value={status}>
          {productStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}
