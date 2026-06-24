import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Package, RotateCcw, Save, Tags, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  createBartenderFn,
  createCategoryFn,
  createProductFn,
  createRestaurantFn,
  createRestaurantNetworkFn,
  deleteCategoryFn,
  deleteBartenderFn,
  deleteRestaurantFn,
  listBartendersFn,
  listCategoriesFn,
  listProductsFn,
  listRestaurantNetworksFn,
  listRestaurantsFn,
  restoreProductFn,
  updateBartenderRestaurantFn,
  updateCategoryFn,
  updateProductFn,
  updateRestaurantNetworkFn,
} from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Управление — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant", "super_admin"]}>
      <AdminPage />
    </AppShell>
  ),
});

type RestaurantNetwork = { id: string; name: string; is_active: boolean };
type Restaurant = { id: string; name: string; network_id: string };
type StaffRole =
  | "bartender"
  | "kitchen_manager"
  | "accountant"
  | "manager"
  | "bar_manager"
  | "super_admin";
type ProductArea = "bar" | "kitchen";
type Bartender = {
  id: string;
  name: string;
  login: string;
  role: StaffRole | string;
  restaurant_id: string | null;
  network_id: string | null;
  is_active?: boolean | null;
};
type Category = {
  id: string;
  name: string;
  area?: ProductArea | string | null;
  network_id: string;
};
type ProductUnit = "л" | "кг" | "шт" | "бут";
type ProductStatus = "approved" | "pending" | "archived";
type ProductStatusFilter = "active" | "archived" | "all";
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
type StaffDraft = {
  role: StaffRole;
  restaurant_id: string;
  network_id: string;
  is_active: boolean;
};
type StaffChange = { id: string; draft: StaffDraft };
type CategoryDraft = { name: string; area: ProductArea };
type CategoryChange = { id: string; draft: CategoryDraft };
type BatchSaveError = Error & { savedIds?: string[] };

const productUnits: ProductUnit[] = ["л", "кг", "шт", "бут"];
const productStatuses: ProductStatus[] = ["approved", "pending", "archived"];
const productAreas: ProductArea[] = ["bar", "kitchen"];
const accountantStaffRoles: StaffRole[] = ["bartender", "kitchen_manager", "manager"];
const superAdminStaffRoles: StaffRole[] = [
  "bartender",
  "kitchen_manager",
  "manager",
  "bar_manager",
  "accountant",
  "super_admin",
];

function staffRoleLabel(role: string) {
  if (role === "super_admin") return "Администратор системы";
  if (role === "accountant") return "Бухгалтер";
  if (role === "manager") return "Управляющий";
  if (role === "bar_manager") return "Бар-менеджер";
  if (role === "kitchen_manager") return "Заведующий производством";
  return "Бармен";
}

function productAreaLabel(area?: string | null) {
  return area === "kitchen" ? "Кухня" : "Бар";
}

function productStatusLabel(status: ProductStatus) {
  if (status === "approved") return "Активен";
  if (status === "pending") return "На подтверждении";
  return "В архиве";
}

function parseMoneyInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Введите стоимость от 0");
  }
  return parsed;
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

function staffDraftFromStaff(staff: Bartender): StaffDraft {
  return {
    role: staff.role as StaffRole,
    restaurant_id: staff.restaurant_id ?? "",
    network_id: staff.network_id ?? "",
    is_active: staff.is_active !== false,
  };
}

function staffDraftsEqual(left: StaffDraft, right: StaffDraft) {
  return (
    left.role === right.role &&
    left.restaurant_id === right.restaurant_id &&
    left.network_id === right.network_id &&
    left.is_active === right.is_active
  );
}

function categoryDraftFromCategory(category: Category): CategoryDraft {
  return {
    name: category.name,
    area: category.area === "kitchen" ? "kitchen" : "bar",
  };
}

function categoryDraftsEqual(left: CategoryDraft, right: CategoryDraft) {
  return left.name === right.name && left.area === right.area;
}

function batchSaveResult<T extends { id: string }>(
  changes: T[],
  results: PromiseSettledResult<unknown>[],
  entityLabel: string,
) {
  const savedIds = changes
    .filter((_, index) => results[index].status === "fulfilled")
    .map(({ id }) => id);
  const failedCount = results.filter((result) => result.status === "rejected").length;
  if (failedCount > 0) {
    const error = new Error(
      `Не удалось сохранить ${failedCount} ${entityLabel}(а). Остальные изменения сохранены.`,
    ) as BatchSaveError;
    error.savedIds = savedIds;
    throw error;
  }
  return { savedIds };
}

function AdminPage() {
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const isSuperAdmin = session?.user.role === "super_admin";
  const availableStaffRoles = isSuperAdmin ? superAdminStaffRoles : accountantStaffRoles;
  const queryClient = useQueryClient();

  const listNetworks = useServerFn(listRestaurantNetworksFn);
  const createNetwork = useServerFn(createRestaurantNetworkFn);
  const updateNetwork = useServerFn(updateRestaurantNetworkFn);

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
  const restoreProduct = useServerFn(restoreProductFn);

  const [networkFilter, setNetworkFilter] = useState("all");
  const [creationNetworkId, setCreationNetworkId] = useState(session?.user.network_id ?? "");
  const [networkName, setNetworkName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [bartenderName, setBartenderName] = useState("");
  const [bartenderLogin, setBartenderLogin] = useState("");
  const [bartenderPassword, setBartenderPassword] = useState("");
  const [bartenderRole, setBartenderRole] = useState<StaffRole>("bartender");
  const [bartenderRestaurantId, setBartenderRestaurantId] = useState("");
  const [staffDrafts, setStaffDrafts] = useState<Record<string, StaffDraft>>({});
  const [bartenderAssignmentMessage, setBartenderAssignmentMessage] = useState<string | null>(null);
  const [staffActionMessage, setStaffActionMessage] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryArea, setCategoryArea] = useState<ProductArea>("bar");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [categorySaveMessage, setCategorySaveMessage] = useState<string | null>(null);
  const [categoryAreaFilter, setCategoryAreaFilter] = useState<"all" | ProductArea>("all");
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productAreaFilter, setProductAreaFilter] = useState<"all" | ProductArea>("all");
  const [productStatusFilter, setProductStatusFilter] = useState<ProductStatusFilter>("active");
  const [productSaveMessage, setProductSaveMessage] = useState<string | null>(null);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [newProduct, setNewProduct] = useState<ProductDraft>({
    name: "",
    category_id: "",
    unit: "бут",
    status: "approved",
    unit_price: "0",
    area: "bar",
  });

  const networksQuery = useQuery({
    queryKey: ["restaurant-networks"],
    queryFn: () => listNetworks({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken && isSuperAdmin,
  });
  const selectedNetworkId = isSuperAdmin && networkFilter !== "all" ? networkFilter : undefined;

  const restaurantsQuery = useQuery({
    queryKey: ["restaurants", selectedNetworkId],
    queryFn: () =>
      listRestaurants({ data: { session_token: sessionToken!, network_id: selectedNetworkId } }),
    enabled: !!sessionToken,
  });
  const bartendersQuery = useQuery({
    queryKey: ["bartenders", selectedNetworkId],
    queryFn: () =>
      listBartenders({ data: { session_token: sessionToken!, network_id: selectedNetworkId } }),
    enabled: !!sessionToken,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", selectedNetworkId],
    queryFn: () =>
      listCategories({ data: { session_token: sessionToken!, network_id: selectedNetworkId } }),
    enabled: !!sessionToken,
  });
  const productsQuery = useQuery({
    queryKey: ["products", selectedNetworkId],
    queryFn: () =>
      listProducts({ data: { session_token: sessionToken!, network_id: selectedNetworkId } }),
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
  const networks = useMemo(
    () => (networksQuery.data ?? []) as RestaurantNetwork[],
    [networksQuery.data],
  );
  const restaurantById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
    [restaurants],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          categoryAreaFilter === "all" || (category.area ?? "bar") === categoryAreaFilter,
      ),
    [categories, categoryAreaFilter],
  );
  const newProductCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          (category.area ?? "bar") === newProduct.area &&
          (!isSuperAdmin || category.network_id === creationNetworkId),
      ),
    [categories, creationNetworkId, isSuperAdmin, newProduct.area],
  );
  const creationRestaurants = useMemo(
    () =>
      isSuperAdmin
        ? restaurants.filter((restaurant) => restaurant.network_id === creationNetworkId)
        : restaurants,
    [creationNetworkId, isSuperAdmin, restaurants],
  );
  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
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
      if (search && !product.name.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [productAreaFilter, productCategoryFilter, productSearch, productStatusFilter, products]);

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
      queryClient.invalidateQueries({ queryKey: ["bartenders"] }),
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
      queryClient.invalidateQueries({ queryKey: ["products"] }),
      queryClient.invalidateQueries({ queryKey: ["restaurant-networks"] }),
    ]);
  };

  const createNetworkMutation = useMutation({
    mutationFn: () =>
      createNetwork({ data: { name: networkName.trim(), session_token: sessionToken! } }),
    onSuccess: async (network) => {
      setNetworkName("");
      setCreationNetworkId(network.id);
      setNetworkFilter(network.id);
      await refreshAdminData();
    },
  });
  const updateNetworkMutation = useMutation({
    mutationFn: (network: RestaurantNetwork) =>
      updateNetwork({ data: { ...network, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });

  const createRestaurantMutation = useMutation({
    mutationFn: () =>
      createRestaurant({
        data: {
          name: restaurantName.trim(),
          network_id: isSuperAdmin ? creationNetworkId : undefined,
          session_token: sessionToken!,
        },
      }),
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
          role: bartenderRole,
          network_id:
            isSuperAdmin && bartenderRole === "super_admin" ? null : creationNetworkId || undefined,
          restaurant_id:
            bartenderRole === "accountant" || bartenderRole === "super_admin"
              ? null
              : bartenderRole === "manager" || bartenderRole === "bar_manager"
                ? bartenderRestaurantId || null
                : bartenderRestaurantId,
          session_token: sessionToken!,
        },
      }),
    onSuccess: async () => {
      setBartenderName("");
      setBartenderLogin("");
      setBartenderPassword("");
      setBartenderRole("bartender");
      setStaffActionMessage("Сотрудник создан");
      await refreshAdminData();
    },
  });
  const saveStaffMutation = useMutation({
    mutationFn: async (changes: StaffChange[]) => {
      const results = await Promise.allSettled(
        changes.map(({ id, draft }) =>
          updateBartenderRestaurant({
            data: {
              id,
              role: draft.role,
              restaurant_id: draft.restaurant_id || null,
              network_id: isSuperAdmin ? draft.network_id || null : undefined,
              is_active: draft.is_active,
              session_token: sessionToken!,
            },
          }),
        ),
      );
      return batchSaveResult(changes, results, "сотрудник");
    },
    onSuccess: async ({ savedIds }, changes) => {
      clearSavedStaffDrafts(changes, savedIds);
      setBartenderAssignmentMessage(
        "Пользователю нужно войти заново, чтобы увидеть новый ресторан",
      );
      setStaffActionMessage("Изменения сохранены");
      await queryClient.invalidateQueries({ queryKey: ["bartenders"] });
    },
    onError: async (error, changes) => {
      clearSavedStaffDrafts(changes, (error as BatchSaveError).savedIds ?? []);
      setStaffActionMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["bartenders"] });
    },
  });
  const deleteBartenderMutation = useMutation({
    mutationFn: (id: string) => deleteBartender({ data: { id, session_token: sessionToken! } }),
    onSuccess: async (_, id) => {
      setStaffDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setStaffActionMessage("Сотрудник удалён");
      await refreshAdminData();
    },
  });
  const deleteRestaurantMutation = useMutation({
    mutationFn: (id: string) => deleteRestaurant({ data: { id, session_token: sessionToken! } }),
    onSuccess: refreshAdminData,
  });
  const createCategoryMutation = useMutation({
    mutationFn: () =>
      createCategory({
        data: {
          name: categoryName.trim(),
          area: categoryArea,
          network_id: isSuperAdmin ? creationNetworkId : undefined,
          session_token: sessionToken!,
        },
      }),
    onSuccess: async () => {
      setCategoryName("");
      await refreshAdminData();
    },
  });
  const saveCategoriesMutation = useMutation({
    mutationFn: async (changes: CategoryChange[]) => {
      const results = await Promise.allSettled(
        changes.map(({ id, draft }) =>
          updateCategory({
            data: {
              id,
              name: draft.name.trim(),
              area: draft.area,
              session_token: sessionToken!,
            },
          }),
        ),
      );
      return batchSaveResult(changes, results, "категори");
    },
    onSuccess: async ({ savedIds }, changes) => {
      clearSavedCategoryDrafts(changes, savedIds);
      setCategorySaveMessage("Изменения сохранены");
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: async (error, changes) => {
      clearSavedCategoryDrafts(changes, (error as BatchSaveError).savedIds ?? []);
      setCategorySaveMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id, session_token: sessionToken! } }),
    onSuccess: async (_, id) => {
      setCategoryDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refreshAdminData();
    },
  });
  const createProductMutation = useMutation({
    mutationFn: () =>
      createProduct({
        data: {
          ...newProduct,
          network_id: isSuperAdmin ? creationNetworkId : undefined,
          unit_price: parseMoneyInput(newProduct.unit_price),
          session_token: sessionToken!,
        },
      }),
    onSuccess: async () => {
      setNewProduct({
        name: "",
        category_id: "",
        unit: "бут",
        status: "approved",
        unit_price: "0",
        area: "bar",
      });
      await refreshAdminData();
    },
  });
  const saveProductsMutation = useMutation({
    mutationFn: async (changes: ProductChange[]) => {
      const results = await Promise.allSettled(
        changes.map(async ({ id, draft }) =>
          updateProduct({
            data: {
              id,
              ...draft,
              unit_price: parseMoneyInput(draft.unit_price),
              session_token: sessionToken!,
            },
          }),
        ),
      );
      const savedIds = changes
        .filter((_, index) => results[index].status === "fulfilled")
        .map(({ id }) => id);
      const failedChanges = changes.filter((_, index) => results[index].status === "rejected");

      if (failedChanges.length > 0) {
        const failedNames = failedChanges
          .map(({ draft }) => draft.name.trim() || "Без названия")
          .join(", ");
        const error = new Error(
          `Не удалось сохранить ${failedChanges.length} товар(а): ${failedNames}`,
        ) as BatchSaveError;
        error.savedIds = savedIds;
        throw error;
      }

      return { savedIds };
    },
    onSuccess: async ({ savedIds }, changes) => {
      clearSavedProductDrafts(changes, savedIds);
      setProductSaveMessage("Изменения сохранены");
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: async (error, changes) => {
      clearSavedProductDrafts(changes, (error as BatchSaveError).savedIds ?? []);
      setProductSaveMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const restoreProductMutation = useMutation({
    mutationFn: (id: string) => restoreProduct({ data: { id, session_token: sessionToken! } }),
    onSuccess: async (_, id) => {
      setProductDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setProductSaveMessage("Товар восстановлен");
      await refreshAdminData();
    },
  });

  function staffDraft(staff: Bartender): StaffDraft {
    return staffDrafts[staff.id] ?? staffDraftFromStaff(staff);
  }

  function setStaffDraft(id: string, patch: Partial<StaffDraft>) {
    const staff = bartenders.find((item) => item.id === id);
    if (!staff) return;
    setStaffActionMessage(null);
    setBartenderAssignmentMessage(null);
    setStaffDrafts((prev) => {
      const original = staffDraftFromStaff(staff);
      const nextDraft = { ...(prev[id] ?? original), ...patch };
      const next = { ...prev };
      if (staffDraftsEqual(nextDraft, original)) delete next[id];
      else next[id] = nextDraft;
      return next;
    });
  }

  function clearSavedStaffDrafts(changes: StaffChange[], savedIds: string[]) {
    const savedIdSet = new Set(savedIds);
    setStaffDrafts((prev) => {
      const next = { ...prev };
      for (const change of changes) {
        if (
          savedIdSet.has(change.id) &&
          next[change.id] &&
          staffDraftsEqual(next[change.id], change.draft)
        ) {
          delete next[change.id];
        }
      }
      return next;
    });
  }

  function saveStaffChanges() {
    const changes = Object.entries(staffDrafts).map(([id, draft]) => ({ id, draft }));
    if (changes.length > 0) saveStaffMutation.mutate(changes);
  }

  function categoryDraft(category: Category): CategoryDraft {
    return categoryDrafts[category.id] ?? categoryDraftFromCategory(category);
  }

  function setCategoryDraft(id: string, patch: Partial<CategoryDraft>) {
    const category = categories.find((item) => item.id === id);
    if (!category) return;
    setCategorySaveMessage(null);
    setCategoryDrafts((prev) => {
      const original = categoryDraftFromCategory(category);
      const nextDraft = { ...(prev[id] ?? original), ...patch };
      const next = { ...prev };
      if (categoryDraftsEqual(nextDraft, original)) delete next[id];
      else next[id] = nextDraft;
      return next;
    });
  }

  function clearSavedCategoryDrafts(changes: CategoryChange[], savedIds: string[]) {
    const savedIdSet = new Set(savedIds);
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      for (const change of changes) {
        if (
          savedIdSet.has(change.id) &&
          next[change.id] &&
          categoryDraftsEqual(next[change.id], change.draft)
        ) {
          delete next[change.id];
        }
      }
      return next;
    });
  }

  function saveCategoryChanges() {
    const changes = Object.entries(categoryDrafts).map(([id, draft]) => ({ id, draft }));
    if (changes.length > 0) saveCategoriesMutation.mutate(changes);
  }

  function productDraft(product: Product): ProductDraft {
    return productDrafts[product.id] ?? productDraftFromProduct(product);
  }

  function setProductDraft(id: string, patch: Partial<ProductDraft>) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setProductSaveMessage(null);
    setProductDrafts((prev) => {
      const original = productDraftFromProduct(product);
      const nextDraft = { ...(prev[id] ?? original), ...patch };
      const next = { ...prev };
      if (productDraftsEqual(nextDraft, original)) {
        delete next[id];
      } else {
        next[id] = nextDraft;
      }
      return next;
    });
  }

  function clearSavedProductDrafts(changes: ProductChange[], savedIds: string[]) {
    const savedIdSet = new Set(savedIds);
    setProductDrafts((prev) => {
      const next = { ...prev };
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
  }

  function saveProductChanges() {
    const changes = Object.entries(productDrafts).map(([id, draft]) => ({ id, draft }));
    if (changes.length > 0) saveProductsMutation.mutate(changes);
  }

  function submitRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (restaurantName.trim() && (!isSuperAdmin || creationNetworkId)) {
      createRestaurantMutation.mutate();
    }
  }

  function submitBartender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      bartenderName.trim() &&
      bartenderLogin.trim() &&
      bartenderPassword &&
      (!isSuperAdmin || bartenderRole === "super_admin" || creationNetworkId) &&
      (["accountant", "manager", "bar_manager", "super_admin"].includes(bartenderRole) ||
        bartenderRestaurantId)
    ) {
      createBartenderMutation.mutate();
    }
  }

  function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryName.trim() && (!isSuperAdmin || creationNetworkId)) {
      createCategoryMutation.mutate();
    }
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      newProduct.name.trim() &&
      newProduct.category_id &&
      newProduct.unit &&
      (!isSuperAdmin || creationNetworkId)
    ) {
      createProductMutation.mutate();
    }
  }

  function confirmDeleteBartender(id: string, name: string) {
    if (!window.confirm(`Удалить сотрудника "${name}"?`)) return;
    setStaffActionMessage(null);
    deleteBartenderMutation.mutate(id);
  }

  function confirmDeleteRestaurant(id: string, name: string) {
    if (!window.confirm(`Удалить ресторан "${name}"?`)) return;
    deleteRestaurantMutation.mutate(id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Управление</h1>
        <p className="text-sm text-muted-foreground">
          Рестораны, бармены, категории и товары для переучётов.
        </p>
      </div>

      {isSuperAdmin && (
        <section className="rounded-xl border border-border bg-card p-4">
          <SectionTitle
            icon={<Building2 className="size-5 text-primary" />}
            title="Сети ресторанов"
          />
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Фильтр данных</span>
              <select
                value={networkFilter}
                onChange={(event) => setNetworkFilter(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Все сети</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Сеть для новых данных</span>
              <select
                value={creationNetworkId}
                onChange={(event) => setCreationNetworkId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Выберите сеть</option>
                {networks
                  .filter((network) => network.is_active)
                  .map((network) => (
                    <option key={network.id} value={network.id}>
                      {network.name}
                    </option>
                  ))}
              </select>
            </label>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (networkName.trim()) createNetworkMutation.mutate();
              }}
            >
              <Input
                value={networkName}
                onChange={(event) => setNetworkName(event.target.value)}
                placeholder="Название новой сети"
              />
              <Button
                type="submit"
                disabled={!networkName.trim() || createNetworkMutation.isPending}
              >
                Создать
              </Button>
            </form>
          </div>
          <ErrorText error={createNetworkMutation.error} fallback="Не удалось создать сеть" />
          <ErrorText error={updateNetworkMutation.error} fallback="Не удалось сохранить сеть" />
          <div className="grid gap-2">
            {networks.map((network) => (
              <NetworkEditor
                key={network.id}
                network={network}
                pending={updateNetworkMutation.isPending}
                onSave={(next) => updateNetworkMutation.mutate(next)}
              />
            ))}
          </div>
        </section>
      )}

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
        <SectionTitle icon={<UserPlus className="size-5 text-primary" />} title="Сотрудники" />
        <form onSubmit={submitBartender} className="mb-5 grid gap-2 md:grid-cols-2 lg:grid-cols-7">
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
          <StaffRoleSelect
            value={bartenderRole}
            roles={availableStaffRoles}
            onChange={setBartenderRole}
          />
          {isSuperAdmin && (
            <NetworkSelect
              value={creationNetworkId}
              networks={networks.filter((network) => network.is_active)}
              onChange={(value) => {
                setCreationNetworkId(value);
                setBartenderRestaurantId("");
              }}
            />
          )}
          <RestaurantSelect
            value={bartenderRestaurantId}
            restaurants={creationRestaurants}
            onChange={setBartenderRestaurantId}
            allowAll={bartenderRole === "manager" || bartenderRole === "bar_manager"}
            disabled={bartenderRole === "accountant" || bartenderRole === "super_admin"}
          />
          <Button
            type="submit"
            disabled={
              createBartenderMutation.isPending ||
              ((bartenderRole === "bartender" || bartenderRole === "kitchen_manager") &&
                creationRestaurants.length === 0) ||
              (isSuperAdmin && bartenderRole !== "super_admin" && !creationNetworkId)
            }
          >
            <UserPlus className="size-4" />
            {createBartenderMutation.isPending ? "Создание..." : "Создать сотрудника"}
          </Button>
        </form>
        <ErrorText error={createBartenderMutation.error} fallback="Не удалось создать сотрудника" />
        <ErrorText
          error={saveStaffMutation.error}
          fallback="Не удалось сохранить изменения сотрудников"
        />
        {bartenderAssignmentMessage && (
          <p className="mb-3 text-sm text-muted-foreground">{bartenderAssignmentMessage}</p>
        )}
        <ErrorText error={deleteBartenderMutation.error} fallback="Не удалось удалить сотрудника" />
        {staffActionMessage && (
          <p className="mb-3 text-sm text-muted-foreground">{staffActionMessage}</p>
        )}
        <div className="mb-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Несохранённых изменений: {Object.keys(staffDrafts).length}
          </p>
          <Button
            type="button"
            disabled={Object.keys(staffDrafts).length === 0 || saveStaffMutation.isPending}
            onClick={saveStaffChanges}
          >
            <Save className="size-4" />
            {saveStaffMutation.isPending
              ? "Сохранение..."
              : `Сохранить изменения (${Object.keys(staffDrafts).length})`}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Имя</th>
                <th className="px-3 py-2 text-left font-medium">Логин</th>
                <th className="px-3 py-2 text-left font-medium">{"\u0420\u043e\u043b\u044c"}</th>
                {isSuperAdmin && <th className="px-3 py-2 text-left font-medium">Сеть</th>}
                <th className="px-3 py-2 text-left font-medium">Ресторан</th>
                <th className="px-3 py-2 text-left font-medium">
                  {"\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c"}
                </th>
                <th className="px-3 py-2 text-left font-medium">Назначение</th>
                <th className="px-3 py-2 text-left font-medium">Удаление</th>
              </tr>
            </thead>
            <tbody>
              {bartenders.map((bartender) => {
                const draft = staffDraft(bartender);
                const canAssignRestaurant = [
                  "bartender",
                  "kitchen_manager",
                  "manager",
                  "bar_manager",
                ].includes(draft.role);
                const canEditRole = isSuperAdmin && bartender.id !== session?.user.id;
                const canEditActivity = isSuperAdmin
                  ? bartender.id !== session?.user.id
                  : ["bartender", "kitchen_manager"].includes(bartender.role);
                const canDeleteStaff = isSuperAdmin
                  ? bartender.id !== session?.user.id
                  : ["bartender", "kitchen_manager"].includes(bartender.role);
                return (
                  <tr
                    key={bartender.id}
                    className={`border-b border-border last:border-b-0 ${
                      staffDrafts[bartender.id] ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium">{bartender.name}</td>
                    <td className="px-3 py-2">{bartender.login}</td>
                    <td className="px-3 py-2">
                      {canEditRole ? (
                        <StaffRoleSelect
                          value={draft.role}
                          roles={superAdminStaffRoles}
                          onChange={(role) =>
                            setStaffDraft(bartender.id, {
                              role,
                              restaurant_id:
                                role === "accountant" || role === "super_admin"
                                  ? ""
                                  : draft.restaurant_id,
                            })
                          }
                        />
                      ) : (
                        staffRoleLabel(bartender.role)
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-3 py-2">
                        <NetworkSelect
                          value={draft.network_id}
                          networks={networks}
                          onChange={(network_id) =>
                            setStaffDraft(bartender.id, { network_id, restaurant_id: "" })
                          }
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      {bartender.restaurant_id
                        ? (restaurantById.get(bartender.restaurant_id) ?? "Не найден")
                        : ["manager", "bar_manager", "accountant", "super_admin"].includes(
                              bartender.role,
                            )
                          ? "Все рестораны"
                          : "Не назначен"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-28 items-center gap-2">
                        <Switch
                          checked={draft.is_active}
                          disabled={!canEditActivity}
                          onCheckedChange={(is_active) =>
                            setStaffDraft(bartender.id, { is_active })
                          }
                          aria-label={`Активность сотрудника ${bartender.name}`}
                        />
                        <span>{draft.is_active ? "Активен" : "Отключён"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {canAssignRestaurant ? (
                        <RestaurantSelect
                          value={draft.restaurant_id}
                          restaurants={restaurants.filter(
                            (restaurant) => restaurant.network_id === draft.network_id,
                          )}
                          allowAll={draft.role === "manager" || draft.role === "bar_manager"}
                          onChange={(restaurant_id) =>
                            setStaffDraft(bartender.id, { restaurant_id })
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {canDeleteStaff ? (
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
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
          <AreaSelect value={categoryArea} onChange={setCategoryArea} />
          <Button type="submit" disabled={createCategoryMutation.isPending}>
            <Tags className="size-4" />
            {createCategoryMutation.isPending ? "Сохранение..." : "Создать категорию"}
          </Button>
        </form>
        <ErrorText error={createCategoryMutation.error} fallback="Не удалось создать категорию" />
        <ErrorText
          error={saveCategoriesMutation.error}
          fallback="Не удалось сохранить изменения категорий"
        />
        <ErrorText error={deleteCategoryMutation.error} fallback="Не удалось удалить категорию" />
        {categorySaveMessage && (
          <p className="mb-3 text-sm text-muted-foreground">{categorySaveMessage}</p>
        )}
        <div className="mb-3 flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-48">
            <AreaFilter value={categoryAreaFilter} onChange={setCategoryAreaFilter} />
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-sm text-muted-foreground">
              Несохранённых изменений: {Object.keys(categoryDrafts).length}
            </p>
            <Button
              type="button"
              disabled={
                Object.keys(categoryDrafts).length === 0 || saveCategoriesMutation.isPending
              }
              onClick={saveCategoryChanges}
            >
              <Save className="size-4" />
              {saveCategoriesMutation.isPending
                ? "Сохранение..."
                : `Сохранить изменения (${Object.keys(categoryDrafts).length})`}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Название</th>
                <th className="px-3 py-2 text-left font-medium">Зона</th>
                <th className="px-3 py-2 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => {
                const draft = categoryDraft(category);
                return (
                  <tr
                    key={category.id}
                    className={`border-b border-border last:border-b-0 ${
                      categoryDrafts[category.id] ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Input
                        value={draft.name}
                        onChange={(event) =>
                          setCategoryDraft(category.id, { name: event.target.value })
                        }
                        className="min-w-48"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <AreaSelect
                        value={draft.area}
                        onChange={(nextArea) => setCategoryDraft(category.id, { area: nextArea })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteCategoryMutation.isPending}
                        onClick={() => deleteCategoryMutation.mutate(category.id)}
                      >
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
        <SectionTitle icon={<Package className="size-5 text-primary" />} title="Товары" />
        <form onSubmit={submitProduct} className="mb-4 grid gap-2 lg:grid-cols-7">
          <Input
            value={newProduct.name}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Название товара"
          />
          <CategorySelect
            value={newProduct.category_id}
            categories={newProductCategories}
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
          <AreaSelect
            value={newProduct.area}
            onChange={(value) =>
              setNewProduct((prev) => ({ ...prev, area: value, category_id: "" }))
            }
          />
          <Input
            inputMode="decimal"
            value={newProduct.unit_price}
            onChange={(event) =>
              setNewProduct((prev) => ({ ...prev, unit_price: event.target.value }))
            }
            placeholder="Стоимость за единицу, BYN"
          />
          <Button
            type="submit"
            disabled={createProductMutation.isPending || newProductCategories.length === 0}
          >
            <Package className="size-4" />
            {createProductMutation.isPending ? "Создание..." : "Создать товар"}
          </Button>
        </form>
        <ErrorText error={createProductMutation.error} fallback="Не удалось создать товар" />
        <ErrorText error={saveProductsMutation.error} fallback="Не удалось сохранить изменения" />
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
              {categories
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

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Название</th>
                <th className="px-3 py-2 text-left font-medium">Категория</th>
                <th className="px-3 py-2 text-left font-medium">Ед.</th>
                <th className="px-3 py-2 text-left font-medium">{"\u0417\u043e\u043d\u0430"}</th>
                <th className="px-3 py-2 text-left font-medium">Цена, BYN</th>
                <th className="px-3 py-2 text-left font-medium">Статус</th>
                <th className="px-3 py-2 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const draft = productDraft(product);
                return (
                  <tr
                    key={product.id}
                    className={`border-b border-border last:border-b-0 ${
                      productDrafts[product.id] ? "bg-primary/5" : ""
                    }`}
                  >
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
                        categories={categories.filter(
                          (category) => (category.area ?? "bar") === draft.area,
                        )}
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
                      <AreaSelect
                        value={draft.area}
                        onChange={(value) =>
                          setProductDraft(product.id, { area: value, category_id: "" })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        value={draft.unit_price}
                        onChange={(event) =>
                          setProductDraft(product.id, { unit_price: event.target.value })
                        }
                        className="min-w-28 text-right"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {product.status === "archived" ? (
                        <span className="whitespace-nowrap text-muted-foreground">В архиве</span>
                      ) : (
                        <StatusSelect
                          value={draft.status}
                          onChange={(value) => setProductDraft(product.id, { status: value })}
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
                            disabled={restoreProductMutation.isPending}
                            onClick={() => restoreProductMutation.mutate(product.id)}
                          >
                            <RotateCcw className="size-4" />
                            Восстановить
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
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
  allowAll = false,
  disabled = false,
}: {
  value: string;
  restaurants: Restaurant[];
  onChange: (value: string) => void;
  allowAll?: boolean;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">{allowAll ? "Все рестораны" : "Ресторан"}</option>
      {restaurants.map((restaurant) => (
        <option key={restaurant.id} value={restaurant.id}>
          {restaurant.name}
        </option>
      ))}
    </select>
  );
}

function NetworkSelect({
  value,
  networks,
  onChange,
}: {
  value: string;
  networks: RestaurantNetwork[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">Сеть ресторанов</option>
      {networks.map((network) => (
        <option key={network.id} value={network.id}>
          {network.name}
        </option>
      ))}
    </select>
  );
}

function NetworkEditor({
  network,
  pending,
  onSave,
}: {
  network: RestaurantNetwork;
  pending: boolean;
  onSave: (network: RestaurantNetwork) => void;
}) {
  const [name, setName] = useState(network.name);
  const [isActive, setIsActive] = useState(network.is_active);
  const changed = name.trim() !== network.name || isActive !== network.is_active;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center">
      <Input value={name} onChange={(event) => setName(event.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        {isActive ? "Активна" : "Отключена"}
      </label>
      <Button
        type="button"
        size="sm"
        disabled={!changed || !name.trim() || pending}
        onClick={() => onSave({ ...network, name: name.trim(), is_active: isActive })}
      >
        <Save className="size-4" />
        Сохранить
      </Button>
    </div>
  );
}

function StaffRoleSelect({
  value,
  roles,
  onChange,
}: {
  value: StaffRole;
  roles: StaffRole[];
  onChange: (value: StaffRole) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as StaffRole)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {staffRoleLabel(role)}
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
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
    >
      {productAreas.map((area) => (
        <option key={area} value={area}>
          {productAreaLabel(area)}
        </option>
      ))}
    </select>
  );
}

function AreaFilter({
  value,
  onChange,
}: {
  value: "all" | ProductArea;
  onChange: (value: "all" | ProductArea) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as "all" | ProductArea)}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      aria-label="Фильтр категорий по зоне"
    >
      <option value="all">Все зоны</option>
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
