import { createServerFn } from "@tanstack/react-start";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });
const sessionSchema = z.object({ session_token: z.string().min(32).max(2048) });
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 210_000;
const productUnitSchema = z.enum(["л", "кг", "шт", "бут"]);
const productStatusSchema = z.enum(["approved", "pending", "archived"]);
const staffRoleSchema = z.enum([
  "bartender",
  "kitchen_manager",
  "accountant",
  "manager",
  "super_admin",
]);
const inventoryAreaSchema = z.enum(["bar", "kitchen"]);
const moneySchema = z.number().min(0).max(1_000_000);
const inventoryEntryTypeSchema = z.enum(["add", "set"]);
const writeOffFiltersSchema = sessionSchema.extend({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  restaurant_id: z.string().uuid().nullable().optional(),
  area: inventoryAreaSchema.nullable().optional(),
});

type StaffRole = z.infer<typeof staffRoleSchema>;
type InventoryArea = z.infer<typeof inventoryAreaSchema>;
type OperationalRole = Extract<StaffRole, "bartender" | "kitchen_manager">;

type AuthUser = {
  id: string;
  name: string;
  login: string;
  role: StaffRole;
  restaurant_id: string | null;
};

type AuthContext = {
  user: AuthUser;
  restaurant: { id: string; name: string } | null;
};

type InventoryRow = {
  id: string;
  restaurant_id: string;
  status: string;
  created_at: string;
  created_by: string | null;
  area?: InventoryArea | string | null;
  correction_comment?: string | null;
};

function getSessionSecret() {
  const secret = process.env.BARSTOCK_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BarStock session secret is not configured");
  }
  return secret;
}

function toBase64Url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function createSessionToken(userId: string) {
  const payload = JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  const encoded = toBase64Url(payload);
  return `${encoded}.${signPayload(encoded)}`;
}

function verifySessionToken(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Сессия недействительна");

  const expected = signPayload(encoded);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("Сессия недействительна");
  }

  const payload = JSON.parse(fromBase64Url(encoded)) as { sub?: string; exp?: number };
  if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Сессия истекла. Войдите снова");
  }
  return payload.sub;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("base64url");
  return `pbkdf2$sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    return stored === password;
  }

  const iterations = Number(parts[2]);
  const salt = parts[3];
  const expected = parts[4];
  if (!Number.isInteger(iterations) || iterations < 100_000 || !salt || !expected) {
    return false;
  }

  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

async function loadRestaurant(
  sb: ReturnType<typeof import("./barstock.server").getBarstock>,
  id: string | null,
) {
  if (!id) return null;
  const { data } = await sb.from("restaurants").select("id,name").eq("id", id).maybeSingle();
  return data ?? null;
}

async function requireSession(sessionToken: string): Promise<AuthContext> {
  const { getBarstock } = await import("./barstock.server");
  const sb = getBarstock();
  const userId = verifySessionToken(sessionToken);
  const { data: user, error } = await sb
    .from("users")
    .select("id,name,login,role,restaurant_id,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user || !staffRoleSchema.safeParse(user.role).success) {
    throw new Error("Пользователь не найден");
  }
  if (user.is_active === false) {
    throw new Error("Пользователь отключён");
  }

  return {
    user: user as AuthUser,
    restaurant: await loadRestaurant(sb, user.restaurant_id),
  };
}

function requireRole(ctx: AuthContext, role: StaffRole | StaffRole[]) {
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(ctx.user.role)) {
    throw new Error("Недостаточно прав");
  }
}

function requireAccountingAccess(ctx: AuthContext) {
  requireRole(ctx, ["accountant", "super_admin"]);
}

function roleArea(role: OperationalRole): InventoryArea {
  return role === "kitchen_manager" ? "kitchen" : "bar";
}

function requireOperationalRole(ctx: AuthContext): InventoryArea {
  requireRole(ctx, ["bartender", "kitchen_manager"]);
  return roleArea(ctx.user.role as OperationalRole);
}

function requireOperationalInventoryAccess(
  ctx: AuthContext,
  inventory: { restaurant_id: string | null; area?: string | null },
) {
  const area = requireOperationalRole(ctx);
  if (!ctx.user.restaurant_id || ctx.user.restaurant_id !== inventory.restaurant_id) {
    throw new Error("Нет доступа к этому ресторану");
  }
  if ((inventory.area ?? "bar") !== area) {
    throw new Error(
      "\u041d\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u043a \u044d\u0442\u043e\u0439 \u0437\u043e\u043d\u0435",
    );
  }
}

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ login: z.string().min(1).max(120), password: z.string().min(1).max(200) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: user, error } = await sb
      .from("users")
      .select("id,name,login,role,restaurant_id,password_hash,is_active")
      .eq("login", data.login)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!user || user.is_active === false || !verifyPassword(data.password, user.password_hash)) {
      throw new Error("Неверный логин или пароль");
    }

    if (!String(user.password_hash ?? "").startsWith("pbkdf2$sha256$")) {
      await sb
        .from("users")
        .update({ password_hash: hashPassword(data.password) })
        .eq("id", user.id);
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        restaurant_id: user.restaurant_id,
      },
      restaurant: await loadRestaurant(sb, user.restaurant_id),
      session_token: createSessionToken(user.id),
    };
  });

export const currentSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        login: ctx.user.login,
        role: ctx.user.role,
        restaurant_id: ctx.user.restaurant_id,
      },
      restaurant: ctx.restaurant,
      session_token: data.session_token,
    };
  });

export const listRestaurantsFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("restaurants")
      .select("id,name")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ name: z.string().trim().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: restaurant, error } = await getBarstock()
      .from("restaurants")
      .insert({ name: data.name })
      .select("id,name")
      .single();
    if (error) throw new Error(error.message);
    return restaurant;
  });

export const listBartendersFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    let query = getBarstock()
      .from("users")
      .select("id,name,login,role,restaurant_id,is_active")
      .in("role", ["bartender", "kitchen_manager", "accountant", "manager", "super_admin"])
      .order("name");
    if (ctx.user.role !== "super_admin") {
      query = query.neq("role", "super_admin").neq("is_active", false);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createBartenderFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        name: z.string().trim().min(1).max(160),
        login: z.string().trim().min(1).max(120),
        password: z.string().min(6).max(200),
        role: staffRoleSchema.default("bartender"),
        restaurant_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const role = data.role;
    if (role === "super_admin" && ctx.user.role !== "super_admin") {
      throw new Error("Только администратор системы может назначить эту роль");
    }
    const restaurantId = data.restaurant_id ?? null;
    if ((role === "bartender" || role === "kitchen_manager") && !restaurantId) {
      throw new Error("Restaurant is required for this role");
    }
    if (restaurantId) {
      const { data: restaurant, error: restaurantError } = await sb
        .from("restaurants")
        .select("id")
        .eq("id", restaurantId)
        .maybeSingle();
      if (restaurantError) throw new Error(restaurantError.message);
      if (!restaurant) throw new Error("Restaurant not found");
    }

    const { data: user, error } = await sb
      .from("users")
      .insert({
        name: data.name,
        login: data.login,
        password_hash: hashPassword(data.password),
        role,
        restaurant_id: role === "accountant" || role === "super_admin" ? null : restaurantId,
        is_active: true,
      })
      .select("id,name,login,role,restaurant_id,is_active")
      .single();
    if (error) throw new Error(error.message);
    return user;
  });

export const deleteBartenderFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);
    if (ctx.user.id === data.id) {
      throw new Error("Нельзя удалить текущего пользователя");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: bartender, error: bartenderError } = await sb
      .from("users")
      .select("id,role")
      .eq("id", data.id)
      .maybeSingle();
    if (bartenderError) throw new Error(bartenderError.message);
    if (!bartender || !staffRoleSchema.safeParse(bartender.role).success) {
      throw new Error("Staff member not found");
    }
    if (bartender.role === "super_admin" && ctx.user.role !== "super_admin") {
      throw new Error("Только администратор системы может удалить другого администратора");
    }
    if (ctx.user.role === "accountant" && ["manager", "accountant"].includes(bartender.role)) {
      throw new Error("Бухгалтер не может удалить этого пользователя");
    }

    const [
      { count: createdCount, error: createdError },
      { count: participantCount, error: participantError },
      { count: writeOffCount, error: writeOffError },
    ] = await Promise.all([
      sb.from("inventories").select("id", { count: "exact", head: true }).eq("created_by", data.id),
      sb
        .from("inventory_participants")
        .select("inventory_id", { count: "exact", head: true })
        .eq("user_id", data.id),
      sb.from("write_offs").select("id", { count: "exact", head: true }).eq("user_id", data.id),
    ]);
    if (createdError) throw new Error(createdError.message);
    if (participantError) throw new Error(participantError.message);
    if (writeOffError) throw new Error(writeOffError.message);

    if ((createdCount ?? 0) > 0 || (participantCount ?? 0) > 0 || (writeOffCount ?? 0) > 0) {
      const { error } = await sb.from("users").update({ is_active: false }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, mode: "soft" };
    }

    const { error } = await sb.from("users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, mode: "hard" };
  });

export const updateBartenderRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({ id: z.string().uuid(), restaurant_id: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: bartender, error: bartenderError } = await sb
      .from("users")
      .select("id,role")
      .eq("id", data.id)
      .maybeSingle();
    if (bartenderError) throw new Error(bartenderError.message);
    if (!bartender || !["bartender", "kitchen_manager", "manager"].includes(bartender.role))
      throw new Error("Staff member not found");
    if (
      (bartender.role === "bartender" || bartender.role === "kitchen_manager") &&
      !data.restaurant_id
    ) {
      throw new Error("Для этой роли ресторан обязателен");
    }
    if (data.restaurant_id) {
      const { data: restaurant, error: restaurantError } = await sb
        .from("restaurants")
        .select("id")
        .eq("id", data.restaurant_id)
        .maybeSingle();
      if (restaurantError) throw new Error(restaurantError.message);
      if (!restaurant) throw new Error("Ресторан не найден");
    }

    const { data: user, error } = await sb
      .from("users")
      .update({ restaurant_id: data.restaurant_id })
      .eq("id", data.id)
      .in("role", ["bartender", "kitchen_manager", "manager"])
      .select("id,name,login,role,restaurant_id,is_active")
      .single();
    if (error) throw new Error(error.message);
    return user;
  });

export const deleteRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { count: activeBartendersCount, error: activeBartendersError },
      { count: inventoriesCount, error: inventoriesError },
    ] = await Promise.all([
      sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .in("role", ["bartender", "kitchen_manager", "manager"])
        .eq("restaurant_id", data.id)
        .neq("is_active", false),
      sb
        .from("inventories")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", data.id),
    ]);
    if (activeBartendersError) throw new Error(activeBartendersError.message);
    if (inventoriesError) throw new Error(inventoriesError.message);
    if ((activeBartendersCount ?? 0) > 0 || (inventoriesCount ?? 0) > 0) {
      throw new Error("Нельзя удалить ресторан: есть сотрудники или переучёты");
    }

    const { error } = await sb.from("restaurants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCategoriesFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("categories")
      .select("id,name,area")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({ name: z.string().trim().min(1).max(160), area: inventoryAreaSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: category, error } = await getBarstock()
      .from("categories")
      .insert({ name: data.name, area: data.area })
      .select("id,name,area")
      .single();
    if (error) throw new Error(error.message);
    return category;
  });

export const updateCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        area: inventoryAreaSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { count, error: productsError } = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id)
      .neq("area", data.area);
    if (productsError) throw new Error(productsError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Нельзя изменить зону категории: в ней есть товары другой зоны");
    }

    const { data: category, error } = await sb
      .from("categories")
      .update({ name: data.name, area: data.area })
      .eq("id", data.id)
      .select("id,name,area")
      .single();
    if (error) throw new Error(error.message);
    return category;
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { count, error: countError } = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Нельзя удалить категорию, если к ней привязаны товары");
    }

    const { error } = await sb.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProductsFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("products")
      .select("id,name,category_id,unit,status,unit_price,area")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        name: z.string().trim().min(1).max(200),
        category_id: z.string().uuid(),
        unit: productUnitSchema,
        status: productStatusSchema.default("approved"),
        unit_price: moneySchema.default(0),
        area: inventoryAreaSchema.default("bar"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: category, error: categoryError } = await sb
      .from("categories")
      .select("id,area")
      .eq("id", data.category_id)
      .maybeSingle();
    if (categoryError) throw new Error(categoryError.message);
    if (!category) throw new Error("Категория не найдена");
    if ((category.area ?? "bar") !== data.area) {
      throw new Error("Зона товара должна совпадать с зоной категории");
    }

    const { data: product, error } = await sb
      .from("products")
      .insert({
        name: data.name,
        category_id: data.category_id,
        unit: data.unit,
        status: data.status,
        unit_price: data.unit_price,
        area: data.area,
      })
      .select("id,name,category_id,unit,status,unit_price,area")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const updateProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        category_id: z.string().uuid(),
        unit: productUnitSchema,
        status: productStatusSchema,
        unit_price: moneySchema,
        area: inventoryAreaSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: category, error: categoryError } = await sb
      .from("categories")
      .select("id,area")
      .eq("id", data.category_id)
      .maybeSingle();
    if (categoryError) throw new Error(categoryError.message);
    if (!category) throw new Error("Категория не найдена");
    if ((category.area ?? "bar") !== data.area) {
      throw new Error("Зона товара должна совпадать с зоной категории");
    }

    const { data: product, error } = await sb
      .from("products")
      .update({
        name: data.name,
        category_id: data.category_id,
        unit: data.unit,
        status: data.status,
        unit_price: data.unit_price,
        area: data.area,
      })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status,unit_price,area")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const archiveProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: product, error } = await getBarstock()
      .from("products")
      .update({ status: "archived" })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status,unit_price,area")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const restoreProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { data: product, error } = await getBarstock()
      .from("products")
      .update({ status: "approved" })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status,unit_price,area")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: product, error: productError } = await sb
      .from("products")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Товар не найден");

    const [
      { count: actualCount, error: actualError },
      { count: expectedCount, error: expectedError },
    ] = await Promise.all([
      sb
        .from("inventory_items")
        .select("product_id", { count: "exact", head: true })
        .eq("product_id", data.id),
      sb
        .from("expected_items")
        .select("product_id", { count: "exact", head: true })
        .eq("product_id", data.id),
    ]);
    if (actualError) throw new Error(actualError.message);
    if (expectedError) throw new Error(expectedError.message);

    if ((actualCount ?? 0) > 0 || (expectedCount ?? 0) > 0) {
      const { error } = await sb.from("products").update({ status: "archived" }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return {
        ok: true,
        mode: "archived",
        message: "Товар использовался в переучётах, поэтому перенесён в архив",
      };
    }

    const { error } = await sb.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, mode: "deleted", message: "Товар удалён" };
  });

export const listInventoriesFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ restaurant_id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: invs, error } = await sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
      .eq("restaurant_id", ctx.user.restaurant_id)
      .eq("area", area)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return enrichInventoryRows(sb, invs ?? []);
  });

export const createInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ restaurant_id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error } = await sb
      .from("inventories")
      .insert({
        restaurant_id: ctx.user.restaurant_id,
        created_by: ctx.user.id,
        area,
        status: "draft",
      })
      .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
      .single();
    if (error) throw new Error(error.message);

    const { error: participantError } = await sb
      .from("inventory_participants")
      .insert({ inventory_id: inv.id, user_id: ctx.user.id });
    if (participantError) throw new Error(participantError.message);

    return inv;
  });

export const getInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { data: inv, error: e1 },
      { data: cats },
      { data: prods },
      { data: items },
      { data: entryCounts },
    ] = await Promise.all([
      sb
        .from("inventories")
        .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
        .eq("id", data.id)
        .maybeSingle(),
      sb.from("categories").select("id,name,area").order("name"),
      sb.from("products").select("id,name,unit,category_id,status,area").order("name"),
      sb
        .from("inventory_items")
        .select("inventory_id,product_id,quantity")
        .eq("inventory_id", data.id),
      sb.from("inventory_item_entries").select("product_id").eq("inventory_id", data.id),
    ]);
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireOperationalInventoryAccess(ctx, inv);

    const countedProductIds = new Set((items ?? []).map((item) => item.product_id));
    const entryCountsByProduct = (entryCounts ?? []).reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.product_id] = (acc[entry.product_id] ?? 0) + 1;
        return acc;
      },
      {},
    );

    return {
      inventory: inv,
      categories: (cats ?? []).filter(
        (category) => (category.area ?? "bar") === (inv.area ?? "bar"),
      ),
      products: (prods ?? []).filter(
        (product) =>
          (product.area ?? "bar") === (inv.area ?? "bar") &&
          (product.status === "approved" || countedProductIds.has(product.id)),
      ),
      items: items ?? [],
      entry_counts: Object.entries(entryCountsByProduct).map(([product_id, count]) => ({
        product_id,
        count,
      })),
      discrepancies: [],
    };
  });

export const getInventoryEntriesFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        inventory_id: z.string().uuid(),
        product_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,restaurant_id,area")
      .eq("id", data.inventory_id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireOperationalInventoryAccess(ctx, inv);

    const {
      data: entries,
      error,
      count,
    } = await sb
      .from("inventory_item_entries")
      .select("id,product_id,user_id,quantity,entry_type,created_at", { count: "exact" })
      .eq("inventory_id", data.inventory_id)
      .eq("product_id", data.product_id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);

    const userIds = Array.from(
      new Set((entries ?? []).map((entry) => entry.user_id).filter(Boolean) as string[]),
    );
    let users: Record<string, string> = {};
    if (userIds.length) {
      const { data: rows, error: usersError } = await sb
        .from("users")
        .select("id,name")
        .in("id", userIds);
      if (usersError) throw new Error(usersError.message);
      users = Object.fromEntries((rows ?? []).map((user) => [user.id, user.name]));
    }

    return {
      entries: (entries ?? []).map((entry) => ({
        ...entry,
        quantity: Number(entry.quantity),
        user_name: entry.user_id ? (users[entry.user_id] ?? null) : null,
      })),
      total: count ?? entries?.length ?? 0,
    };
  });

export const upsertItemFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        inventory_id: z.string().uuid(),
        product_id: z.string().uuid(),
        quantity: z.number().min(0).max(1_000_000),
        entry_type: inventoryEntryTypeSchema.default("set"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,restaurant_id,status,area")
      .eq("id", data.inventory_id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireOperationalInventoryAccess(ctx, inv);
    if (inv.status !== "draft" && inv.status !== "correction_required") {
      throw new Error("Закрытый переучёт нельзя редактировать");
    }

    const { data: product, error: productError } = await sb
      .from("products")
      .select("id,area,status")
      .eq("id", data.product_id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product || (product.area ?? "bar") !== (inv.area ?? "bar")) {
      throw new Error(
        "\u0422\u043e\u0432\u0430\u0440 \u043d\u0435 \u043f\u0440\u0438\u043d\u0430\u0434\u043b\u0435\u0436\u0438\u0442 \u044d\u0442\u043e\u0439 \u0437\u043e\u043d\u0435",
      );
    }

    const { data: currentItem, error: currentItemError } = await sb
      .from("inventory_items")
      .select("quantity")
      .eq("inventory_id", data.inventory_id)
      .eq("product_id", data.product_id)
      .maybeSingle();
    if (currentItemError) throw new Error(currentItemError.message);

    const currentQuantity = Number(currentItem?.quantity ?? 0);
    const nextQuantity =
      data.entry_type === "add" ? currentQuantity + data.quantity : data.quantity;
    const normalizedQuantity = Math.round(nextQuantity * 1_000_000_000_000) / 1_000_000_000_000;

    const { error } = await sb.from("inventory_items").upsert(
      {
        inventory_id: data.inventory_id,
        product_id: data.product_id,
        quantity: normalizedQuantity,
      },
      { onConflict: "inventory_id,product_id" },
    );
    if (error) throw new Error(error.message);

    const { error: entryError } = await sb.from("inventory_item_entries").insert({
      inventory_id: data.inventory_id,
      product_id: data.product_id,
      user_id: ctx.user.id,
      quantity: data.quantity,
      entry_type: data.entry_type,
    });
    if (entryError) throw new Error(entryError.message);

    return { ok: true, quantity: normalizedQuantity };
  });

export const closeInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { data: inv, error: invError },
      { data: participant },
      { data: approvedProducts, error: productsError },
      { data: existingItems, error: itemsError },
    ] = await Promise.all([
      sb.from("inventories").select("id,restaurant_id,status,area").eq("id", data.id).maybeSingle(),
      sb
        .from("inventory_participants")
        .select("inventory_id,user_id")
        .eq("inventory_id", data.id)
        .eq("user_id", ctx.user.id)
        .maybeSingle(),
      sb.from("products").select("id,area").eq("status", "approved"),
      sb.from("inventory_items").select("product_id").eq("inventory_id", data.id),
    ]);
    if (invError) throw new Error(invError.message);
    if (productsError) throw new Error(productsError.message);
    if (itemsError) throw new Error(itemsError.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireOperationalInventoryAccess(ctx, inv);
    if (!participant && ctx.user.restaurant_id !== inv.restaurant_id) {
      throw new Error("Нет права закрыть этот переучёт");
    }
    if (inv.status !== "draft" && inv.status !== "correction_required") {
      throw new Error("Переучёт уже закрыт");
    }

    const existingProductIds = new Set((existingItems ?? []).map((item) => item.product_id));
    const missingRows = (approvedProducts ?? [])
      .filter((product) => (product.area ?? "bar") === (inv.area ?? "bar"))
      .filter((product) => !existingProductIds.has(product.id))
      .map((product) => ({
        inventory_id: data.id,
        product_id: product.id,
        quantity: 0,
      }));

    if (missingRows.length > 0) {
      const { error: insertMissingError } = await sb.from("inventory_items").insert(missingRows);
      if (insertMissingError) throw new Error(insertMissingError.message);
    }

    const { error } = await sb
      .from("inventories")
      .update({ status: "completed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (inv.status === "correction_required") {
      const { error: commentError } = await sb
        .from("inventories")
        .update({ correction_comment: null })
        .eq("id", data.id);
      if (commentError && !commentError.message.includes("correction_comment")) {
        throw new Error(commentError.message);
      }
    }

    return { ok: true };
  });

export const addDiscrepancyFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        inventory_id: z.string().uuid(),
        amount: z.number(),
        comment: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { error } = await getBarstock().from("discrepancies").upsert(
      {
        inventory_id: data.inventory_id,
        amount: data.amount,
        comment: data.comment,
      },
      { onConflict: "inventory_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listClosedInventoriesFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        restaurant_id: z.string().uuid().nullable().optional(),
        area: inventoryAreaSchema.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    let query = sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
      .in("status", ["completed", "correction_required"])
      .order("created_at", { ascending: false });

    if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);
    if (data.area) query = query.eq("area", data.area);

    const { data: invs, error } = await query;
    if (error) throw new Error(error.message);
    return enrichInventoryRows(sb, invs ?? [], true);
  });

export const deleteInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");

    const childDeletes = await Promise.all([
      sb.from("inventory_items").delete().eq("inventory_id", data.id),
      sb.from("expected_items").delete().eq("inventory_id", data.id),
      sb.from("discrepancies").delete().eq("inventory_id", data.id),
      sb.from("inventory_participants").delete().eq("inventory_id", data.id),
    ]);
    const childError = childDeletes.find((result) => result.error)?.error;
    if (childError) throw new Error(childError.message);

    const { error } = await sb.from("inventories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestInventoryCorrectionFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .merge(idSchema)
      .extend({ correction_comment: z.string().trim().min(1).max(1000) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,status")
      .eq("id", data.id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    if (inv.status === "draft") {
      throw new Error("Черновик уже доступен бармену для редактирования");
    }

    const { error } = await sb
      .from("inventories")
      .update({
        status: "correction_required",
        correction_comment: data.correction_comment.trim(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInventoryReportFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, ["accountant", "manager", "super_admin"]);

    const { getBarstock } = await import("./barstock.server");
    const { classifyDiscrepancy } = await import("./expectedStock");
    const sb = getBarstock();
    const [
      { data: inv, error: e1 },
      { data: restaurant },
      { data: cats },
      { data: prods },
      { data: items },
      { data: expected },
      { data: discrepancy },
    ] = await Promise.all([
      sb
        .from("inventories")
        .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
        .eq("id", data.id)
        .maybeSingle(),
      sb.from("inventories").select("restaurants(id,name)").eq("id", data.id).maybeSingle(),
      sb.from("categories").select("id,name,area").order("name"),
      sb.from("products").select("id,name,unit,category_id,status,unit_price,area").order("name"),
      sb.from("inventory_items").select("product_id,quantity").eq("inventory_id", data.id),
      sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id),
      sb.from("discrepancies").select("comment").eq("inventory_id", data.id).maybeSingle(),
    ]);
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    if (ctx.user.role === "manager") {
      if (inv.status !== "completed")
        throw new Error("Управляющему доступны только закрытые отчёты");
      if (ctx.user.restaurant_id && ctx.user.restaurant_id !== inv.restaurant_id) {
        throw new Error("Нет доступа к отчёту другого ресторана");
      }
    }

    const actualMap = new Map<string, number>();
    (items ?? []).forEach((it) => actualMap.set(it.product_id, Number(it.quantity)));
    const expectedMap = new Map<string, number>();
    (expected ?? []).forEach((it) => expectedMap.set(it.product_id, Number(it.quantity)));
    const rows = (prods ?? [])
      .filter((p) => actualMap.has(p.id) || expectedMap.has(p.id))
      .map((p) => {
        const actual = actualMap.get(p.id) ?? 0;
        const hasExpected = expectedMap.has(p.id);
        const expectedQty = expectedMap.get(p.id);
        const diff = actual - (expectedQty ?? 0);
        const unitPrice = Number(p.unit_price ?? 0);
        const status = classifyDiscrepancy(diff);
        return {
          product_id: p.id,
          name: p.name,
          unit: p.unit,
          category_id: p.category_id,
          unit_price: unitPrice,
          actual,
          expected: expectedQty ?? null,
          expected_set: hasExpected,
          diff,
          money_diff: diff * unitPrice,
          status,
          comment: status === "match" ? "" : (discrepancy?.comment ?? ""),
        };
      });
    return {
      inventory: inv,
      restaurant: Array.isArray(restaurant?.restaurants)
        ? (restaurant.restaurants[0] ?? null)
        : (restaurant?.restaurants ?? null),
      categories: cats ?? [],
      rows,
    };
  });

export const getMonthlyArchiveFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        restaurant_id: z.string().uuid().nullable().optional(),
        area: inventoryAreaSchema.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const { classifyDiscrepancy } = await import("./expectedStock");
    const sb = getBarstock();
    const [year, month] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    let inventoryQuery = sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
      .in("status", ["completed", "correction_required"])
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true });
    if (data.restaurant_id) inventoryQuery = inventoryQuery.eq("restaurant_id", data.restaurant_id);
    if (data.area) inventoryQuery = inventoryQuery.eq("area", data.area);

    const { data: inventories, error: inventoriesError } = await inventoryQuery;
    if (inventoriesError) throw new Error(inventoriesError.message);
    const invs = inventories ?? [];
    const inventoryIds = invs.map((inventory) => inventory.id);
    const restaurantIds = Array.from(
      new Set(invs.map((inventory) => inventory.restaurant_id).filter(Boolean)),
    );

    const [
      { data: restaurants, error: restaurantsError },
      { data: categories, error: categoriesError },
      { data: products, error: productsError },
      { data: items, error: itemsError },
      { data: expected, error: expectedError },
    ] = await Promise.all([
      restaurantIds.length
        ? sb.from("restaurants").select("id,name").in("id", restaurantIds)
        : Promise.resolve({ data: [], error: null }),
      sb.from("categories").select("id,name,area").order("name"),
      sb.from("products").select("id,name,unit,category_id,status,unit_price,area").order("name"),
      inventoryIds.length
        ? sb
            .from("inventory_items")
            .select("inventory_id,product_id,quantity")
            .in("inventory_id", inventoryIds)
        : Promise.resolve({ data: [], error: null }),
      inventoryIds.length
        ? sb
            .from("expected_items")
            .select("inventory_id,product_id,quantity")
            .in("inventory_id", inventoryIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (restaurantsError) throw new Error(restaurantsError.message);
    if (categoriesError) throw new Error(categoriesError.message);
    if (productsError) throw new Error(productsError.message);
    if (itemsError) throw new Error(itemsError.message);
    if (expectedError) throw new Error(expectedError.message);

    const restaurantById = new Map(
      (restaurants ?? []).map((restaurant) => [restaurant.id, restaurant]),
    );
    const productById = new Map((products ?? []).map((product) => [product.id, product]));
    const actualByInventory = new Map<string, Map<string, number>>();
    const expectedByInventory = new Map<string, Map<string, number>>();

    (items ?? []).forEach((item) => {
      const map = actualByInventory.get(item.inventory_id) ?? new Map<string, number>();
      map.set(item.product_id, Number(item.quantity));
      actualByInventory.set(item.inventory_id, map);
    });
    (expected ?? []).forEach((item) => {
      const map = expectedByInventory.get(item.inventory_id) ?? new Map<string, number>();
      map.set(item.product_id, Number(item.quantity));
      expectedByInventory.set(item.inventory_id, map);
    });

    return {
      month: data.month,
      categories: categories ?? [],
      inventories: invs.map((inventory) => {
        const actualMap = actualByInventory.get(inventory.id) ?? new Map<string, number>();
        const expectedMap = expectedByInventory.get(inventory.id) ?? new Map<string, number>();
        const productIds = Array.from(new Set([...actualMap.keys(), ...expectedMap.keys()]));
        const rows = productIds.flatMap((productId) => {
          const product = productById.get(productId);
          if (!product) return [];
          const actual = actualMap.get(productId) ?? 0;
          const hasExpected = expectedMap.has(productId);
          const expectedQty = expectedMap.get(productId);
          const diff = actual - (expectedQty ?? 0);
          const unitPrice = Number(product.unit_price ?? 0);
          return [
            {
              product_id: product.id,
              name: product.name,
              category_id: product.category_id,
              unit: product.unit,
              unit_price: unitPrice,
              actual,
              expected: expectedQty ?? null,
              expected_set: hasExpected,
              diff,
              money_diff: diff * unitPrice,
              status: classifyDiscrepancy(diff),
            },
          ];
        });

        return {
          inventory,
          restaurant: restaurantById.get(inventory.restaurant_id) ?? null,
          rows,
        };
      }),
    };
  });

export const createWriteOffFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        product_id: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
        reason: z.string().trim().min(3).max(1_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) {
      throw new Error("Пользователю не назначен ресторан");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: product, error: productError } = await sb
      .from("products")
      .select("id,area,status")
      .eq("id", data.product_id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Товар не найден");
    if ((product.area ?? "bar") !== area) {
      throw new Error("Нельзя списать товар другой зоны");
    }
    if (product.status !== "approved") {
      throw new Error("Можно списывать только активные товары");
    }

    const { data: writeOff, error } = await sb
      .from("write_offs")
      .insert({
        restaurant_id: ctx.user.restaurant_id,
        area,
        product_id: product.id,
        user_id: ctx.user.id,
        quantity: data.quantity,
        reason: data.reason,
      })
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return writeOff;
  });

export const listWriteOffsFn = createServerFn({ method: "POST" })
  .inputValidator((input) => writeOffFiltersSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, ["bartender", "kitchen_manager", "accountant", "super_admin"]);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const isAccountant = ctx.user.role === "accountant" || ctx.user.role === "super_admin";
    let query = sb
      .from("write_offs")
      .select("id,restaurant_id,area,product_id,user_id,quantity,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(isAccountant ? 1_000 : 100);

    if (isAccountant) {
      if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);
      if (data.area) query = query.eq("area", data.area);
      if (data.month) {
        const [year, month] = data.month.split("-").map(Number);
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
      }
    } else {
      const area = requireOperationalRole(ctx);
      if (!ctx.user.restaurant_id) throw new Error("Пользователю не назначен ресторан");
      query = query
        .eq("user_id", ctx.user.id)
        .eq("restaurant_id", ctx.user.restaurant_id)
        .eq("area", area);
    }

    const { data: writeOffs, error } = await query;
    if (error) throw new Error(error.message);

    const rows = writeOffs ?? [];
    const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const restaurantIds = Array.from(new Set(rows.map((row) => row.restaurant_id)));
    const operationalArea = isAccountant ? null : requireOperationalRole(ctx);

    const [
      productsResult,
      usersResult,
      usedRestaurantsResult,
      availableProductsResult,
      restaurantsResult,
    ] = await Promise.all([
      productIds.length
        ? sb.from("products").select("id,name,unit,unit_price").in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? sb.from("users").select("id,name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      restaurantIds.length
        ? sb.from("restaurants").select("id,name").in("id", restaurantIds)
        : Promise.resolve({ data: [], error: null }),
      operationalArea
        ? sb
            .from("products")
            .select("id,name,unit")
            .eq("area", operationalArea)
            .eq("status", "approved")
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      isAccountant
        ? sb.from("restaurants").select("id,name").order("name")
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [
      productsResult,
      usersResult,
      usedRestaurantsResult,
      availableProductsResult,
      restaurantsResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const productById = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
    const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row.name]));
    const restaurantById = new Map(
      (usedRestaurantsResult.data ?? []).map((row) => [row.id, row.name]),
    );

    return {
      write_offs: rows.map((row) => {
        const product = productById.get(row.product_id);
        const quantity = Number(row.quantity);
        const unitPrice = Number(product?.unit_price ?? 0);
        return {
          ...row,
          quantity,
          product_name: product?.name ?? "Неизвестный товар",
          unit: product?.unit ?? "",
          unit_price: isAccountant ? unitPrice : null,
          amount: isAccountant ? quantity * unitPrice : null,
          user_name: userById.get(row.user_id) ?? "Неизвестный пользователь",
          restaurant_name: restaurantById.get(row.restaurant_id) ?? "Без названия",
        };
      }),
      products: availableProductsResult.data ?? [],
      restaurants: restaurantsResult.data ?? [],
    };
  });

export const getManagerStatsFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        restaurant_id: z.string().uuid().nullable().optional(),
        area: inventoryAreaSchema.nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, ["manager", "accountant", "super_admin"]);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [year, month] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const fixedRestaurantId = ctx.user.role === "manager" ? ctx.user.restaurant_id : null;
    const effectiveRestaurantId = fixedRestaurantId ?? data.restaurant_id ?? null;

    let inventoryQuery = sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,area")
      .eq("status", "completed")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (effectiveRestaurantId) {
      inventoryQuery = inventoryQuery.eq("restaurant_id", effectiveRestaurantId);
    }
    if (data.area) inventoryQuery = inventoryQuery.eq("area", data.area);

    let writeOffQuery = sb
      .from("write_offs")
      .select("id,restaurant_id,area,product_id,user_id,quantity,reason,created_at")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (effectiveRestaurantId) {
      writeOffQuery = writeOffQuery.eq("restaurant_id", effectiveRestaurantId);
    }
    if (data.area) writeOffQuery = writeOffQuery.eq("area", data.area);

    const [
      { data: inventories, error: inventoriesError },
      { data: writeOffs, error: writeOffsError },
      restaurantsResult,
    ] = await Promise.all([
      inventoryQuery,
      writeOffQuery,
      fixedRestaurantId
        ? sb.from("restaurants").select("id,name").eq("id", fixedRestaurantId).order("name")
        : sb.from("restaurants").select("id,name").order("name"),
    ]);
    if (inventoriesError) throw new Error(inventoriesError.message);
    if (writeOffsError) throw new Error(writeOffsError.message);
    if (restaurantsResult.error) throw new Error(restaurantsResult.error.message);

    const invs = inventories ?? [];
    const inventoryIds = invs.map((inventory) => inventory.id);
    const [{ data: items, error: itemsError }, { data: expected, error: expectedError }] =
      inventoryIds.length
        ? await Promise.all([
            sb
              .from("inventory_items")
              .select("inventory_id,product_id,quantity")
              .in("inventory_id", inventoryIds),
            sb
              .from("expected_items")
              .select("inventory_id,product_id,quantity")
              .in("inventory_id", inventoryIds),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];
    if (itemsError) throw new Error(itemsError.message);
    if (expectedError) throw new Error(expectedError.message);

    const productIds = Array.from(
      new Set([
        ...[...(items ?? []), ...(expected ?? [])].map((row) => row.product_id),
        ...(writeOffs ?? []).map((row) => row.product_id),
      ]),
    );
    const userIds = Array.from(
      new Set([
        ...(invs.map((inventory) => inventory.created_by).filter(Boolean) as string[]),
        ...(writeOffs ?? []).map((row) => row.user_id),
      ]),
    );
    const restaurantIds = Array.from(
      new Set([
        ...invs.map((inventory) => inventory.restaurant_id),
        ...(writeOffs ?? []).map((row) => row.restaurant_id),
      ]),
    );
    const [productsResult, usersResult, usedRestaurantsResult] = await Promise.all([
      productIds.length
        ? sb.from("products").select("id,name,unit_price").in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? sb.from("users").select("id,name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      restaurantIds.length
        ? sb.from("restaurants").select("id,name").in("id", restaurantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (productsResult.error) throw new Error(productsResult.error.message);
    if (usersResult.error) throw new Error(usersResult.error.message);
    if (usedRestaurantsResult.error) throw new Error(usedRestaurantsResult.error.message);

    const productById = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
    const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row.name]));
    const restaurantById = new Map(
      (usedRestaurantsResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const actualByInventory = new Map<string, Map<string, number>>();
    const expectedByInventory = new Map<string, Map<string, number>>();

    for (const item of items ?? []) {
      const map = actualByInventory.get(item.inventory_id) ?? new Map<string, number>();
      map.set(item.product_id, Number(item.quantity ?? 0));
      actualByInventory.set(item.inventory_id, map);
    }
    for (const item of expected ?? []) {
      const map = expectedByInventory.get(item.inventory_id) ?? new Map<string, number>();
      map.set(item.product_id, Number(item.quantity ?? 0));
      expectedByInventory.set(item.inventory_id, map);
    }

    type MoneyTotals = { shortage: number; surplus: number; problemPositions: number };
    type ProductTotals = MoneyTotals & {
      product_id: string;
      product_name: string;
      restaurant_id: string;
      restaurant_name: string;
      area: InventoryArea;
      shortage_count: number;
      surplus_count: number;
    };
    type RestaurantTotals = MoneyTotals & {
      restaurant_id: string;
      restaurant_name: string;
      inventories: number;
      write_offs: number;
    };
    type WriteOffProductTotals = {
      product_id: string;
      product_name: string;
      restaurant_id: string;
      restaurant_name: string;
      area: InventoryArea;
      count: number;
      amount: number;
    };

    const totals: MoneyTotals = { shortage: 0, surplus: 0, problemPositions: 0 };
    const products = new Map<string, ProductTotals>();
    const restaurants = new Map<string, RestaurantTotals>();
    const latest = invs.map((inventory) => {
      const restaurantName = restaurantById.get(inventory.restaurant_id) ?? "Без названия";
      const restaurant = restaurants.get(inventory.restaurant_id) ?? {
        restaurant_id: inventory.restaurant_id,
        restaurant_name: restaurantName,
        inventories: 0,
        shortage: 0,
        surplus: 0,
        problemPositions: 0,
        write_offs: 0,
      };
      restaurant.inventories += 1;

      let shortage = 0;
      let surplus = 0;
      let problemPositions = 0;
      const actualMap = actualByInventory.get(inventory.id) ?? new Map<string, number>();
      const expectedMap = expectedByInventory.get(inventory.id) ?? new Map<string, number>();
      const ids = new Set([...actualMap.keys(), ...expectedMap.keys()]);

      for (const productId of ids) {
        const product = productById.get(productId);
        if (!product) continue;
        const diff = (actualMap.get(productId) ?? 0) - (expectedMap.get(productId) ?? 0);
        const money = diff * Number(product.unit_price ?? 0);
        if (diff === 0) continue;

        problemPositions += 1;
        totals.problemPositions += 1;
        restaurant.problemPositions += 1;
        const key = `${productId}:${inventory.restaurant_id}:${inventory.area ?? "bar"}`;
        const productTotals = products.get(key) ?? {
          product_id: productId,
          product_name: product.name,
          restaurant_id: inventory.restaurant_id,
          restaurant_name: restaurantName,
          area: (inventory.area ?? "bar") as InventoryArea,
          shortage: 0,
          surplus: 0,
          problemPositions: 0,
          shortage_count: 0,
          surplus_count: 0,
        };
        productTotals.problemPositions += 1;

        if (diff < 0) {
          const amount = Math.abs(money);
          shortage += amount;
          totals.shortage += amount;
          restaurant.shortage += amount;
          productTotals.shortage += amount;
          productTotals.shortage_count += 1;
        } else {
          surplus += money;
          totals.surplus += money;
          restaurant.surplus += money;
          productTotals.surplus += money;
          productTotals.surplus_count += 1;
        }
        products.set(key, productTotals);
      }

      restaurants.set(inventory.restaurant_id, restaurant);
      return {
        id: inventory.id,
        created_at: inventory.created_at,
        restaurant_id: inventory.restaurant_id,
        restaurant_name: restaurantName,
        area: (inventory.area ?? "bar") as InventoryArea,
        created_by_name: inventory.created_by
          ? (userById.get(inventory.created_by) ?? "Неизвестно")
          : "Неизвестно",
        shortage,
        surplus,
        net: surplus - shortage,
        problem_positions: problemPositions,
      };
    });

    const writeOffProducts = new Map<string, WriteOffProductTotals>();
    const recentWriteOffs = (writeOffs ?? []).map((writeOff) => {
      const product = productById.get(writeOff.product_id);
      const restaurantName = restaurantById.get(writeOff.restaurant_id) ?? "Без названия";
      const quantity = Number(writeOff.quantity ?? 0);
      const amount = quantity * Number(product?.unit_price ?? 0);
      const area = (writeOff.area ?? "bar") as InventoryArea;
      const restaurant = restaurants.get(writeOff.restaurant_id) ?? {
        restaurant_id: writeOff.restaurant_id,
        restaurant_name: restaurantName,
        inventories: 0,
        shortage: 0,
        surplus: 0,
        problemPositions: 0,
        write_offs: 0,
      };
      restaurant.write_offs += amount;
      restaurants.set(writeOff.restaurant_id, restaurant);

      const key = `${writeOff.product_id}:${writeOff.restaurant_id}:${area}`;
      const productTotals = writeOffProducts.get(key) ?? {
        product_id: writeOff.product_id,
        product_name: product?.name ?? "Неизвестный товар",
        restaurant_id: writeOff.restaurant_id,
        restaurant_name: restaurantName,
        area,
        count: 0,
        amount: 0,
      };
      productTotals.count += 1;
      productTotals.amount += amount;
      writeOffProducts.set(key, productTotals);

      return {
        id: writeOff.id,
        created_at: writeOff.created_at,
        restaurant_id: writeOff.restaurant_id,
        restaurant_name: restaurantName,
        area,
        product_id: writeOff.product_id,
        product_name: product?.name ?? "Неизвестный товар",
        quantity,
        amount,
        user_name: userById.get(writeOff.user_id) ?? "Неизвестный пользователь",
        reason: writeOff.reason,
      };
    });
    const writeOffsTotal = recentWriteOffs.reduce((sum, row) => sum + row.amount, 0);
    const writeOffsByRestaurant = Array.from(restaurants.values()).map((restaurant) => ({
      restaurant_id: restaurant.restaurant_id,
      restaurant_name: restaurant.restaurant_name,
      amount: restaurant.write_offs,
    }));
    const shortageByDate = new Map<string, number>();
    for (const inventory of latest) {
      if (inventory.shortage <= 0) continue;
      const date = inventory.created_at.slice(0, 10);
      shortageByDate.set(date, (shortageByDate.get(date) ?? 0) + inventory.shortage);
    }

    return {
      month: data.month,
      scope_restaurant_id: fixedRestaurantId,
      restaurants: restaurantsResult.data ?? [],
      summary: {
        inventories: invs.length,
        shortage: totals.shortage,
        surplus: totals.surplus,
        net: totals.surplus - totals.shortage - writeOffsTotal,
        problem_positions: totals.problemPositions,
        write_offs_amount: writeOffsTotal,
      },
      writeOffsTotal,
      writeOffsByRestaurant,
      shortage_trend: Array.from(shortageByDate, ([date, amount]) => ({ date, amount })).sort(
        (left, right) => left.date.localeCompare(right.date),
      ),
      topWriteOffProducts: Array.from(writeOffProducts.values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 20),
      recentWriteOffs: recentWriteOffs.slice(0, 10),
      top_products: Array.from(products.values())
        .sort((a, b) => b.shortage + b.surplus - (a.shortage + a.surplus))
        .slice(0, 20),
      restaurant_stats: Array.from(restaurants.values())
        .map((restaurant) => ({
          ...restaurant,
          net: restaurant.surplus - restaurant.shortage - restaurant.write_offs,
        }))
        .sort((a, b) => b.shortage + b.surplus - (a.shortage + a.surplus)),
      latest_inventories: latest.slice(0, 10),
    };
  });

export const listExpectedFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [{ data: inv, error: e1 }, { data: cats }, { data: prods }, { data: expected }] =
      await Promise.all([
        sb
          .from("inventories")
          .select("id,restaurant_id,status,created_at,created_by,area,correction_comment")
          .eq("id", data.id)
          .maybeSingle(),
        sb.from("categories").select("id,name,area").order("name"),
        sb.from("products").select("id,name,unit,category_id,status,area").order("name"),
        sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id),
      ]);
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    return {
      inventory: inv,
      categories: (cats ?? []).filter(
        (category) => (category.area ?? "bar") === (inv.area ?? "bar"),
      ),
      products: (prods ?? []).filter((product) => (product.area ?? "bar") === (inv.area ?? "bar")),
      expected: expected ?? [],
    };
  });

export const upsertExpectedFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        inventory_id: z.string().uuid(),
        product_id: z.string().uuid(),
        quantity: z.number().min(0).max(1_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { error } = await sb.from("expected_items").upsert(
      {
        inventory_id: data.inventory_id,
        product_id: data.product_id,
        quantity: data.quantity,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "inventory_id,product_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkSetExpectedFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        inventory_id: z.string().uuid(),
        items: z
          .array(
            z.object({
              product_id: z.string().uuid(),
              quantity: z.number().min(0).max(1_000_000),
            }),
          )
          .min(1)
          .max(5000),
        replace: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireAccountingAccess(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    if (data.replace) {
      const { error: delErr } = await sb
        .from("expected_items")
        .delete()
        .eq("inventory_id", data.inventory_id);
      if (delErr) throw new Error(delErr.message);
    }
    const rows = data.items.map((it) => ({
      inventory_id: data.inventory_id,
      product_id: it.product_id,
      quantity: it.quantity,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await sb
      .from("expected_items")
      .upsert(rows, { onConflict: "inventory_id,product_id" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

async function enrichInventoryRows(
  sb: ReturnType<typeof import("./barstock.server").getBarstock>,
  invs: InventoryRow[],
  includeRestaurants = false,
) {
  const ids = invs.map((i) => i.id);
  const userIds = Array.from(new Set(invs.map((i) => i.created_by).filter(Boolean) as string[]));
  const restaurantIds = Array.from(new Set(invs.map((i) => i.restaurant_id).filter(Boolean)));

  let users: Record<string, string> = {};
  if (userIds.length) {
    const { data: us } = await sb.from("users").select("id,name").in("id", userIds);
    users = Object.fromEntries((us ?? []).map((u) => [u.id, u.name]));
  }

  let restaurants: Record<string, string> = {};
  if (includeRestaurants && restaurantIds.length) {
    const { data: rs } = await sb.from("restaurants").select("id,name").in("id", restaurantIds);
    restaurants = Object.fromEntries((rs ?? []).map((r) => [r.id, r.name]));
  }

  let counts: Record<string, number> = {};
  if (ids.length) {
    const { data: items } = await sb
      .from("inventory_items")
      .select("inventory_id")
      .in("inventory_id", ids);
    counts = (items ?? []).reduce<Record<string, number>>((acc, it) => {
      acc[it.inventory_id] = (acc[it.inventory_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return invs.map((i) => ({
    ...i,
    created_by_name: i.created_by ? (users[i.created_by] ?? null) : null,
    restaurant_name: includeRestaurants ? (restaurants[i.restaurant_id] ?? null) : undefined,
    items_count: counts[i.id] ?? 0,
  }));
}
