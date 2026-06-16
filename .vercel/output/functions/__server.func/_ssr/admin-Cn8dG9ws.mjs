import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { u as useServerFn, a as listRestaurantsFn, b as createRestaurantFn, d as listBartendersFn, e as createBartenderFn, f as deleteBartenderFn, g as deleteRestaurantFn, h as updateBartenderRestaurantFn, i as listCategoriesFn, j as createCategoryFn, k as updateCategoryFn, m as deleteCategoryFn, n as listProductsFn, o as createProductFn, p as updateProductFn, q as archiveProductFn, r as deleteProductFn, B as Button } from "./barstock.functions-DEpRpfrC.mjs";
import { u as useQueryClient, a as useQuery, b as useMutation } from "../_libs/tanstack__react-query.mjs";
import { A as AppShell } from "./AppShell-PxePPgmF.mjs";
import { I as Input } from "./input-hnyhQ6XQ.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import "../_libs/seroval.mjs";
import { B as Building2, T as Trash2, U as UserPlus, S as Save, a as Tags, P as Package, A as Archive } from "../_libs/lucide-react.mjs";
import "../_libs/tanstack__react-router.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "./server-B-fI4YJN.mjs";
import "node:async_hooks";
import "../_libs/h3-v2.mjs";
import "../_libs/rou3.mjs";
import "../_libs/srvx.mjs";
import "../_libs/zod.mjs";
import "../_libs/tanstack__query-core.mjs";
const productUnits = ["л", "кг", "шт", "бут"];
const productStatuses = ["approved", "pending", "archived"];
function productStatusLabel(status) {
  if (status === "approved") return "Активен";
  if (status === "pending") return "На подтверждении";
  return "В архиве";
}
function parseMoneyInput(value) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Введите стоимость от 0");
  }
  return parsed;
}
function AdminPage() {
  const {
    session
  } = useSession();
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
  const [restaurantName, setRestaurantName] = reactExports.useState("");
  const [bartenderName, setBartenderName] = reactExports.useState("");
  const [bartenderLogin, setBartenderLogin] = reactExports.useState("");
  const [bartenderPassword, setBartenderPassword] = reactExports.useState("");
  const [bartenderRestaurantId, setBartenderRestaurantId] = reactExports.useState("");
  const [assignments, setAssignments] = reactExports.useState({});
  const [bartenderAssignmentMessage, setBartenderAssignmentMessage] = reactExports.useState(null);
  const [categoryName, setCategoryName] = reactExports.useState("");
  const [categoryNames, setCategoryNames] = reactExports.useState({});
  const [productSearch, setProductSearch] = reactExports.useState("");
  const [productCategoryFilter, setProductCategoryFilter] = reactExports.useState("all");
  const [productDeleteMessage, setProductDeleteMessage] = reactExports.useState(null);
  const [productDrafts, setProductDrafts] = reactExports.useState({});
  const [newProduct, setNewProduct] = reactExports.useState({
    name: "",
    category_id: "",
    unit: "бут",
    status: "approved",
    unit_price: "0"
  });
  const restaurantsQuery = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => listRestaurants({
      data: {
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const bartendersQuery = useQuery({
    queryKey: ["bartenders"],
    queryFn: () => listBartenders({
      data: {
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories({
      data: {
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => listProducts({
      data: {
        session_token: sessionToken
      }
    }),
    enabled: !!sessionToken
  });
  const restaurants = reactExports.useMemo(() => restaurantsQuery.data ?? [], [restaurantsQuery.data]);
  const bartenders = reactExports.useMemo(() => bartendersQuery.data ?? [], [bartendersQuery.data]);
  const categories = reactExports.useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const products = reactExports.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const restaurantById = reactExports.useMemo(() => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name])), [restaurants]);
  reactExports.useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const filteredProducts = reactExports.useMemo(() => {
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
    await Promise.all([queryClient.invalidateQueries({
      queryKey: ["restaurants"]
    }), queryClient.invalidateQueries({
      queryKey: ["bartenders"]
    }), queryClient.invalidateQueries({
      queryKey: ["categories"]
    }), queryClient.invalidateQueries({
      queryKey: ["products"]
    })]);
  };
  const createRestaurantMutation = useMutation({
    mutationFn: () => createRestaurant({
      data: {
        name: restaurantName.trim(),
        session_token: sessionToken
      }
    }),
    onSuccess: async (restaurant) => {
      setRestaurantName("");
      if (!bartenderRestaurantId) setBartenderRestaurantId(restaurant.id);
      await refreshAdminData();
    }
  });
  const createBartenderMutation = useMutation({
    mutationFn: () => createBartender({
      data: {
        name: bartenderName.trim(),
        login: bartenderLogin.trim(),
        password: bartenderPassword,
        restaurant_id: bartenderRestaurantId,
        session_token: sessionToken
      }
    }),
    onSuccess: async () => {
      setBartenderName("");
      setBartenderLogin("");
      setBartenderPassword("");
      await refreshAdminData();
    }
  });
  const updateBartenderMutation = useMutation({
    mutationFn: ({
      id,
      restaurantId
    }) => updateBartenderRestaurant({
      data: {
        id,
        restaurant_id: restaurantId,
        session_token: sessionToken
      }
    }),
    onSuccess: async () => {
      setBartenderAssignmentMessage("Пользователю нужно войти заново, чтобы увидеть новый ресторан");
      await refreshAdminData();
    }
  });
  const deleteBartenderMutation = useMutation({
    mutationFn: (id) => deleteBartender({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: refreshAdminData
  });
  const deleteRestaurantMutation = useMutation({
    mutationFn: (id) => deleteRestaurant({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: refreshAdminData
  });
  const createCategoryMutation = useMutation({
    mutationFn: () => createCategory({
      data: {
        name: categoryName.trim(),
        session_token: sessionToken
      }
    }),
    onSuccess: async () => {
      setCategoryName("");
      await refreshAdminData();
    }
  });
  const updateCategoryMutation = useMutation({
    mutationFn: ({
      id,
      name
    }) => updateCategory({
      data: {
        id,
        name: name.trim(),
        session_token: sessionToken
      }
    }),
    onSuccess: refreshAdminData
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id) => deleteCategory({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: refreshAdminData
  });
  const createProductMutation = useMutation({
    mutationFn: () => createProduct({
      data: {
        ...newProduct,
        unit_price: parseMoneyInput(newProduct.unit_price),
        session_token: sessionToken
      }
    }),
    onSuccess: async () => {
      setNewProduct({
        name: "",
        category_id: "",
        unit: "бут",
        status: "approved",
        unit_price: "0"
      });
      await refreshAdminData();
    }
  });
  const updateProductMutation = useMutation({
    mutationFn: ({
      id,
      draft
    }) => updateProduct({
      data: {
        id,
        ...draft,
        unit_price: parseMoneyInput(draft.unit_price),
        session_token: sessionToken
      }
    }),
    onSuccess: refreshAdminData
  });
  const archiveProductMutation = useMutation({
    mutationFn: (id) => archiveProduct({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: refreshAdminData
  });
  const deleteProductMutation = useMutation({
    mutationFn: (id) => deleteProduct({
      data: {
        id,
        session_token: sessionToken
      }
    }),
    onSuccess: async (result) => {
      setProductDeleteMessage(result.message);
      await refreshAdminData();
    }
  });
  function productDraft(product) {
    return productDrafts[product.id] ?? {
      name: product.name,
      category_id: product.category_id ?? "",
      unit: productUnits.includes(product.unit) ? product.unit : "бут",
      status: productStatuses.includes(product.status) ? product.status : "pending",
      unit_price: String(product.unit_price ?? 0)
    };
  }
  function setProductDraft(id, patch) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    setProductDrafts((prev) => ({
      ...prev,
      [id]: {
        ...productDraft(product),
        ...patch
      }
    }));
  }
  function submitRestaurant(event) {
    event.preventDefault();
    if (restaurantName.trim()) createRestaurantMutation.mutate();
  }
  function submitBartender(event) {
    event.preventDefault();
    if (bartenderName.trim() && bartenderLogin.trim() && bartenderPassword && bartenderRestaurantId) {
      createBartenderMutation.mutate();
    }
  }
  function submitCategory(event) {
    event.preventDefault();
    if (categoryName.trim()) createCategoryMutation.mutate();
  }
  function submitProduct(event) {
    event.preventDefault();
    if (newProduct.name.trim() && newProduct.category_id && newProduct.unit) {
      createProductMutation.mutate();
    }
  }
  function confirmDeleteBartender(id, name) {
    if (!window.confirm(`Удалить бармена "${name}"?`)) return;
    deleteBartenderMutation.mutate(id);
  }
  function confirmDeleteRestaurant(id, name) {
    if (!window.confirm(`Удалить ресторан "${name}"?`)) return;
    deleteRestaurantMutation.mutate(id);
  }
  function confirmDeleteProduct(id, name) {
    if (!window.confirm(`Удалить товар "${name}"?`)) return;
    setProductDeleteMessage(null);
    deleteProductMutation.mutate(id);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Управление" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Рестораны, бармены, категории и товары для переучётов." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl border border-border bg-card p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "size-5 text-primary" }), title: "Рестораны" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submitRestaurant, className: "mb-4 flex flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: restaurantName, onChange: (event) => setRestaurantName(event.target.value), placeholder: "Название ресторана", className: "sm:max-w-sm" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "submit", disabled: createRestaurantMutation.isPending, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { className: "size-4" }),
          createRestaurantMutation.isPending ? "Сохранение..." : "Создать ресторан"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: createRestaurantMutation.error, fallback: "Не удалось создать ресторан" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: deleteRestaurantMutation.error, fallback: "Не удалось удалить ресторан" }),
      restaurantsQuery.isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Загрузка..." }) : restaurants.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Ресторанов пока нет." }) : /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-border rounded-lg border border-border", children: restaurants.map((restaurant) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center justify-between gap-3 px-3 py-2 text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: restaurant.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "destructive", size: "sm", disabled: deleteRestaurantMutation.isPending, onClick: () => confirmDeleteRestaurant(restaurant.id, restaurant.name), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }),
          "Удалить"
        ] })
      ] }, restaurant.id)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl border border-border bg-card p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(UserPlus, { className: "size-5 text-primary" }), title: "Бармены" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submitBartender, className: "mb-5 grid gap-2 md:grid-cols-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: bartenderName, onChange: (event) => setBartenderName(event.target.value), placeholder: "Имя" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: bartenderLogin, onChange: (event) => setBartenderLogin(event.target.value), placeholder: "Логин" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: bartenderPassword, onChange: (event) => setBartenderPassword(event.target.value), placeholder: "Пароль", type: "password" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(RestaurantSelect, { value: bartenderRestaurantId, restaurants, onChange: setBartenderRestaurantId }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "submit", disabled: createBartenderMutation.isPending || restaurants.length === 0, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(UserPlus, { className: "size-4" }),
          createBartenderMutation.isPending ? "Создание..." : "Создать бармена"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: createBartenderMutation.error, fallback: "Не удалось создать бармена" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: updateBartenderMutation.error, fallback: "Не удалось изменить ресторан бармена" }),
      bartenderAssignmentMessage && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-3 text-sm text-muted-foreground", children: bartenderAssignmentMessage }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: deleteBartenderMutation.error, fallback: "Не удалось удалить бармена" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto rounded-lg border border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-xs uppercase text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Имя" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Логин" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Ресторан" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Назначение" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Удаление" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: bartenders.map((bartender) => {
          const selectedRestaurantId = assignments[bartender.id] ?? bartender.restaurant_id ?? "";
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border last:border-b-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2 font-medium", children: bartender.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: bartender.login }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: bartender.restaurant_id ? restaurantById.get(bartender.restaurant_id) ?? "Не найден" : "Не назначен" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-64 gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(RestaurantSelect, { value: selectedRestaurantId, restaurants, onChange: (value) => setAssignments((prev) => ({
                ...prev,
                [bartender.id]: value
              })) }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", size: "sm", disabled: !selectedRestaurantId || selectedRestaurantId === bartender.restaurant_id || updateBartenderMutation.isPending, onClick: () => updateBartenderMutation.mutate({
                id: bartender.id,
                restaurantId: selectedRestaurantId
              }), children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "size-4" }),
                "Сохранить"
              ] })
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "destructive", size: "sm", disabled: deleteBartenderMutation.isPending, onClick: () => confirmDeleteBartender(bartender.id, bartender.name), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }),
              "Удалить"
            ] }) })
          ] }, bartender.id);
        }) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl border border-border bg-card p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Tags, { className: "size-5 text-primary" }), title: "Категории товаров" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submitCategory, className: "mb-4 flex flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: categoryName, onChange: (event) => setCategoryName(event.target.value), placeholder: "Название категории", className: "sm:max-w-sm" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "submit", disabled: createCategoryMutation.isPending, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Tags, { className: "size-4" }),
          createCategoryMutation.isPending ? "Сохранение..." : "Создать категорию"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: createCategoryMutation.error, fallback: "Не удалось создать категорию" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: updateCategoryMutation.error, fallback: "Не удалось переименовать категорию" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: deleteCategoryMutation.error, fallback: "Не удалось удалить категорию" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-border rounded-lg border border-border", children: categories.map((category) => {
        const value = categoryNames[category.id] ?? category.name;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex flex-col gap-2 px-3 py-2 sm:flex-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value, onChange: (event) => setCategoryNames((prev) => ({
            ...prev,
            [category.id]: event.target.value
          })) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", variant: "secondary", disabled: !value.trim() || value === category.name || updateCategoryMutation.isPending, onClick: () => updateCategoryMutation.mutate({
            id: category.id,
            name: value
          }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "size-4" }),
            "Сохранить"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "button", variant: "destructive", disabled: deleteCategoryMutation.isPending, onClick: () => deleteCategoryMutation.mutate(category.id), children: "Удалить" })
        ] }, category.id);
      }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl border border-border bg-card p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTitle, { icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Package, { className: "size-5 text-primary" }), title: "Товары" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: submitProduct, className: "mb-4 grid gap-2 lg:grid-cols-6", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: newProduct.name, onChange: (event) => setNewProduct((prev) => ({
          ...prev,
          name: event.target.value
        })), placeholder: "Название товара" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CategorySelect, { value: newProduct.category_id, categories, onChange: (value) => setNewProduct((prev) => ({
          ...prev,
          category_id: value
        })) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(UnitSelect, { value: newProduct.unit, onChange: (value) => setNewProduct((prev) => ({
          ...prev,
          unit: value
        })) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(StatusSelect, { value: newProduct.status, onChange: (value) => setNewProduct((prev) => ({
          ...prev,
          status: value
        })) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { inputMode: "decimal", value: newProduct.unit_price, onChange: (event) => setNewProduct((prev) => ({
          ...prev,
          unit_price: event.target.value
        })), placeholder: "Стоимость за единицу, BYN" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "submit", disabled: createProductMutation.isPending || categories.length === 0, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Package, { className: "size-4" }),
          createProductMutation.isPending ? "Создание..." : "Создать товар"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: createProductMutation.error, fallback: "Не удалось создать товар" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: updateProductMutation.error, fallback: "Не удалось сохранить товар" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: archiveProductMutation.error, fallback: "Не удалось архивировать товар" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(ErrorText, { error: deleteProductMutation.error, fallback: "Не удалось удалить товар" }),
      productDeleteMessage && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-3 text-sm text-muted-foreground", children: productDeleteMessage }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-3 flex flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: productSearch, onChange: (event) => setProductSearch(event.target.value), placeholder: "Поиск по названию", className: "sm:max-w-sm" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: productCategoryFilter, onChange: (event) => setProductCategoryFilter(event.target.value), className: "h-9 rounded-md border border-input bg-background px-3 text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "Все категории" }),
          categories.map((category) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: category.id, children: category.name }, category.id))
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto rounded-lg border border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-xs uppercase text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Название" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Категория" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Ед." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Цена, BYN" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Статус" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-3 py-2 text-left font-medium", children: "Действия" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("tbody", { children: [
          filteredProducts.map((product) => {
            const draft = productDraft(product);
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-border last:border-b-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: draft.name, onChange: (event) => setProductDraft(product.id, {
                name: event.target.value
              }), className: "min-w-48" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CategorySelect, { value: draft.category_id, categories, onChange: (value) => setProductDraft(product.id, {
                category_id: value
              }) }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(UnitSelect, { value: draft.unit, onChange: (value) => setProductDraft(product.id, {
                unit: value
              }) }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { inputMode: "decimal", value: draft.unit_price, onChange: (event) => setProductDraft(product.id, {
                unit_price: event.target.value
              }), className: "min-w-28 text-right" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(StatusSelect, { value: draft.status, onChange: (value) => setProductDraft(product.id, {
                status: value
              }) }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-56 gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", size: "sm", disabled: !draft.name.trim() || !draft.category_id || updateProductMutation.isPending, onClick: () => updateProductMutation.mutate({
                  id: product.id,
                  draft
                }), children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "size-4" }),
                  "Сохранить"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", size: "sm", variant: "secondary", disabled: product.status === "archived" || archiveProductMutation.isPending, onClick: () => archiveProductMutation.mutate(product.id), children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Archive, { className: "size-4" }),
                  "Архив"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { type: "button", size: "sm", variant: "destructive", disabled: deleteProductMutation.isPending, onClick: () => confirmDeleteProduct(product.id, product.name), children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }),
                  "Удалить"
                ] })
              ] }) })
            ] }, product.id);
          }),
          filteredProducts.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-3 py-6 text-center text-muted-foreground", colSpan: 5, children: "Товары не найдены." }) })
        ] })
      ] }) })
    ] })
  ] });
}
function SectionTitle({
  icon,
  title
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex items-center gap-2", children: [
    icon,
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: title })
  ] });
}
function ErrorText({
  error,
  fallback
}) {
  if (!error) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-3 text-sm text-destructive", children: error instanceof Error ? error.message : fallback });
}
function RestaurantSelect({
  value,
  restaurants,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value, onChange: (event) => onChange(event.target.value), className: "h-9 rounded-md border border-input bg-background px-3 text-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Ресторан" }),
    restaurants.map((restaurant) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: restaurant.id, children: restaurant.name }, restaurant.id))
  ] });
}
function CategorySelect({
  value,
  categories,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value, onChange: (event) => onChange(event.target.value), className: "h-9 rounded-md border border-input bg-background px-3 text-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Категория" }),
    categories.map((category) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: category.id, children: category.name }, category.id))
  ] });
}
function UnitSelect({
  value,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value, onChange: (event) => onChange(event.target.value), className: "h-9 rounded-md border border-input bg-background px-3 text-sm", children: productUnits.map((unit) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: unit, children: unit }, unit)) });
}
function StatusSelect({
  value,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("select", { value, onChange: (event) => onChange(event.target.value), className: "h-9 rounded-md border border-input bg-background px-3 text-sm", children: productStatuses.map((status) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: status, children: productStatusLabel(status) }, status)) });
}
const SplitComponent = () => /* @__PURE__ */ jsxRuntimeExports.jsx(AppShell, { allow: ["accountant"], children: /* @__PURE__ */ jsxRuntimeExports.jsx(AdminPage, {}) });
export {
  SplitComponent as component
};
