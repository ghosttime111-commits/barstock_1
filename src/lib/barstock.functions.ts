import { createServerFn } from "@tanstack/react-start";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });
const sessionSchema = z.object({ session_token: z.string().min(32).max(2048) });
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 210_000;
const productUnitSchema = z.enum(["л", "кг", "шт", "бут"]);
const productStatusSchema = z.enum(["approved", "pending", "archived"]);

type AuthUser = {
  id: string;
  name: string;
  login: string;
  role: "bartender" | "accountant";
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
  if (!user || (user.role !== "bartender" && user.role !== "accountant")) {
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

function requireRole(ctx: AuthContext, role: AuthUser["role"]) {
  if (ctx.user.role !== role) {
    throw new Error("Недостаточно прав");
  }
}

function requireBartenderRestaurant(ctx: AuthContext, restaurantId: string | null) {
  requireRole(ctx, "bartender");
  if (!ctx.user.restaurant_id || ctx.user.restaurant_id !== restaurantId) {
    throw new Error("Нет доступа к этому ресторану");
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
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("users")
      .select("id,name,login,restaurant_id")
      .eq("role", "bartender")
      .neq("is_active", false)
      .order("name");
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
        restaurant_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: restaurant, error: restaurantError } = await sb
      .from("restaurants")
      .select("id")
      .eq("id", data.restaurant_id)
      .maybeSingle();
    if (restaurantError) throw new Error(restaurantError.message);
    if (!restaurant) throw new Error("Ресторан не найден");

    const { data: user, error } = await sb
      .from("users")
      .insert({
        name: data.name,
        login: data.login,
        password_hash: hashPassword(data.password),
        role: "bartender",
        restaurant_id: data.restaurant_id,
        is_active: true,
      })
      .select("id,name,login,restaurant_id")
      .single();
    if (error) throw new Error(error.message);
    return user;
  });

export const deleteBartenderFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");
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
    if (!bartender || bartender.role !== "bartender") throw new Error("Бармен не найден");

    const [
      { count: createdCount, error: createdError },
      { count: participantCount, error: participantError },
    ] = await Promise.all([
      sb.from("inventories").select("id", { count: "exact", head: true }).eq("created_by", data.id),
      sb
        .from("inventory_participants")
        .select("inventory_id", { count: "exact", head: true })
        .eq("user_id", data.id),
    ]);
    if (createdError) throw new Error(createdError.message);
    if (participantError) throw new Error(participantError.message);

    if ((createdCount ?? 0) > 0 || (participantCount ?? 0) > 0) {
      const { error } = await sb.from("users").update({ is_active: false }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, mode: "soft" };
    }

    const { error } = await sb.from("users").delete().eq("id", data.id).eq("role", "bartender");
    if (error) throw new Error(error.message);
    return { ok: true, mode: "hard" };
  });

export const updateBartenderRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ id: z.string().uuid(), restaurant_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { data: bartender, error: bartenderError },
      { data: restaurant, error: restaurantError },
    ] = await Promise.all([
      sb.from("users").select("id,role").eq("id", data.id).maybeSingle(),
      sb.from("restaurants").select("id").eq("id", data.restaurant_id).maybeSingle(),
    ]);
    if (bartenderError) throw new Error(bartenderError.message);
    if (restaurantError) throw new Error(restaurantError.message);
    if (!bartender || bartender.role !== "bartender") throw new Error("Бармен не найден");
    if (!restaurant) throw new Error("Ресторан не найден");

    const { data: user, error } = await sb
      .from("users")
      .update({ restaurant_id: data.restaurant_id })
      .eq("id", data.id)
      .eq("role", "bartender")
      .select("id,name,login,restaurant_id")
      .single();
    if (error) throw new Error(error.message);
    return user;
  });

export const deleteRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { count: activeBartendersCount, error: activeBartendersError },
      { count: inventoriesCount, error: inventoriesError },
    ] = await Promise.all([
      sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "bartender")
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
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("categories")
      .select("id,name")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ name: z.string().trim().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: category, error } = await getBarstock()
      .from("categories")
      .insert({ name: data.name })
      .select("id,name")
      .single();
    if (error) throw new Error(error.message);
    return category;
  });

export const updateCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({ id: z.string().uuid(), name: z.string().trim().min(1).max(160) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: category, error } = await getBarstock()
      .from("categories")
      .update({ name: data.name })
      .eq("id", data.id)
      .select("id,name")
      .single();
    if (error) throw new Error(error.message);
    return category;
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("products")
      .select("id,name,category_id,unit,status")
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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: product, error } = await getBarstock()
      .from("products")
      .insert({
        name: data.name,
        category_id: data.category_id,
        unit: data.unit,
        status: data.status,
      })
      .select("id,name,category_id,unit,status")
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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: product, error } = await getBarstock()
      .from("products")
      .update({
        name: data.name,
        category_id: data.category_id,
        unit: data.unit,
        status: data.status,
      })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const archiveProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { data: product, error } = await getBarstock()
      .from("products")
      .update({ status: "archived" })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "bartender");
    if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: invs, error } = await sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,correction_comment")
      .eq("restaurant_id", ctx.user.restaurant_id)
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
    requireRole(ctx, "bartender");
    if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error } = await sb
      .from("inventories")
      .insert({
        restaurant_id: ctx.user.restaurant_id,
        created_by: ctx.user.id,
        status: "draft",
      })
      .select("id,restaurant_id,status,created_at,created_by,correction_comment")
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
    requireRole(ctx, "bartender");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [{ data: inv, error: e1 }, { data: cats }, { data: prods }, { data: items }] =
      await Promise.all([
        sb
          .from("inventories")
          .select("id,restaurant_id,status,created_at,created_by,correction_comment")
          .eq("id", data.id)
          .maybeSingle(),
        sb.from("categories").select("id,name").order("name"),
        sb.from("products").select("id,name,unit,category_id,status").order("name"),
        sb
          .from("inventory_items")
          .select("inventory_id,product_id,quantity")
          .eq("inventory_id", data.id),
      ]);
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireBartenderRestaurant(ctx, inv.restaurant_id);

    const countedProductIds = new Set((items ?? []).map((item) => item.product_id));

    return {
      inventory: inv,
      categories: cats ?? [],
      products: (prods ?? []).filter(
        (product) => product.status === "approved" || countedProductIds.has(product.id),
      ),
      items: items ?? [],
      discrepancies: [],
    };
  });

export const upsertItemFn = createServerFn({ method: "POST" })
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
    requireRole(ctx, "bartender");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,restaurant_id,status")
      .eq("id", data.inventory_id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireBartenderRestaurant(ctx, inv.restaurant_id);
    if (inv.status !== "draft" && inv.status !== "correction_required") {
      throw new Error("Закрытый переучёт нельзя редактировать");
    }

    const { error } = await sb.from("inventory_items").upsert(
      {
        inventory_id: data.inventory_id,
        product_id: data.product_id,
        quantity: data.quantity,
      },
      { onConflict: "inventory_id,product_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "bartender");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { data: inv, error: invError },
      { data: participant },
      { data: approvedProducts, error: productsError },
      { data: existingItems, error: itemsError },
    ] = await Promise.all([
      sb.from("inventories").select("id,restaurant_id,status").eq("id", data.id).maybeSingle(),
      sb
        .from("inventory_participants")
        .select("inventory_id,user_id")
        .eq("inventory_id", data.id)
        .eq("user_id", ctx.user.id)
        .maybeSingle(),
      sb.from("products").select("id").eq("status", "approved"),
      sb.from("inventory_items").select("product_id").eq("inventory_id", data.id),
    ]);
    if (invError) throw new Error(invError.message);
    if (productsError) throw new Error(productsError.message);
    if (itemsError) throw new Error(itemsError.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireBartenderRestaurant(ctx, inv.restaurant_id);
    if (!participant && ctx.user.restaurant_id !== inv.restaurant_id) {
      throw new Error("Нет права закрыть этот переучёт");
    }
    if (inv.status !== "draft" && inv.status !== "correction_required") {
      throw new Error("Переучёт уже закрыт");
    }

    const existingProductIds = new Set((existingItems ?? []).map((item) => item.product_id));
    const missingRows = (approvedProducts ?? [])
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
    requireRole(ctx, "accountant");

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
    sessionSchema.extend({ restaurant_id: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    let query = sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,correction_comment")
      .in("status", ["completed", "correction_required"])
      .order("created_at", { ascending: false });

    if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);

    const { data: invs, error } = await query;
    if (error) throw new Error(error.message);
    return enrichInventoryRows(sb, invs ?? [], true);
  });

export const deleteInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "accountant");

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
        .select("id,restaurant_id,status,created_at,created_by,correction_comment")
        .eq("id", data.id)
        .maybeSingle(),
      sb.from("inventories").select("restaurants(id,name)").eq("id", data.id).maybeSingle(),
      sb.from("categories").select("id,name").order("name"),
      sb.from("products").select("id,name,unit,category_id,status").order("name"),
      sb.from("inventory_items").select("product_id,quantity").eq("inventory_id", data.id),
      sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id),
      sb.from("discrepancies").select("comment").eq("inventory_id", data.id).maybeSingle(),
    ]);
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");

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
        const status = classifyDiscrepancy(diff);
        return {
          product_id: p.id,
          name: p.name,
          unit: p.unit,
          category_id: p.category_id,
          actual,
          expected: expectedQty ?? null,
          expected_set: hasExpected,
          diff,
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
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const { classifyDiscrepancy } = await import("./expectedStock");
    const sb = getBarstock();
    const [year, month] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    let inventoryQuery = sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by,correction_comment")
      .in("status", ["completed", "correction_required"])
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true });
    if (data.restaurant_id) inventoryQuery = inventoryQuery.eq("restaurant_id", data.restaurant_id);

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
      sb.from("categories").select("id,name").order("name"),
      sb.from("products").select("id,name,unit,category_id,status").order("name"),
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
          return [
            {
              product_id: product.id,
              name: product.name,
              category_id: product.category_id,
              unit: product.unit,
              actual,
              expected: expectedQty ?? null,
              expected_set: hasExpected,
              diff,
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

export const listExpectedFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireRole(ctx, "accountant");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [{ data: inv, error: e1 }, { data: cats }, { data: prods }, { data: expected }] =
      await Promise.all([
        sb
          .from("inventories")
          .select("id,restaurant_id,status,created_at,created_by,correction_comment")
          .eq("id", data.id)
          .maybeSingle(),
        sb.from("categories").select("id,name").order("name"),
        sb.from("products").select("id,name,unit,category_id,status").order("name"),
        sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id),
      ]);
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    return {
      inventory: inv,
      categories: cats ?? [],
      products: prods ?? [],
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
    requireRole(ctx, "accountant");

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
    requireRole(ctx, "accountant");

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
