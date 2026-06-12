import { createServerFn } from "@tanstack/react-start";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });
const sessionSchema = z.object({ session_token: z.string().min(32).max(2048) });
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 210_000;

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
    .select("id,name,login,role,restaurant_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user || (user.role !== "bartender" && user.role !== "accountant")) {
    throw new Error("Пользователь не найден");
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
      .select("id,name,login,role,restaurant_id,password_hash")
      .eq("login", data.login)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!user || !verifyPassword(data.password, user.password_hash)) {
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

export const listInventoriesFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ restaurant_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireBartenderRestaurant(ctx, data.restaurant_id);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: invs, error } = await sb
      .from("inventories")
      .select("id,restaurant_id,status,created_at,created_by")
      .eq("restaurant_id", data.restaurant_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return enrichInventoryRows(sb, invs ?? []);
  });

export const createInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ restaurant_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requireBartenderRestaurant(ctx, data.restaurant_id);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error } = await sb
      .from("inventories")
      .insert({
        restaurant_id: ctx.user.restaurant_id,
        created_by: ctx.user.id,
        status: "draft",
      })
      .select("id,restaurant_id,status,created_at,created_by")
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
          .select("id,restaurant_id,status,created_at,created_by")
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

    return {
      inventory: inv,
      categories: cats ?? [],
      products: prods ?? [],
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
    if (inv.status !== "draft") {
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
      { count: productCount },
      { count: itemCount },
    ] = await Promise.all([
      sb.from("inventories").select("id,restaurant_id,status").eq("id", data.id).maybeSingle(),
      sb
        .from("inventory_participants")
        .select("inventory_id,user_id")
        .eq("inventory_id", data.id)
        .eq("user_id", ctx.user.id)
        .maybeSingle(),
      sb.from("products").select("id", { count: "exact", head: true }).eq("status", "approved"),
      sb
        .from("inventory_items")
        .select("product_id", { count: "exact", head: true })
        .eq("inventory_id", data.id),
    ]);
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    requireBartenderRestaurant(ctx, inv.restaurant_id);
    if (!participant && ctx.user.restaurant_id !== inv.restaurant_id) {
      throw new Error("Нет права закрыть этот переучёт");
    }
    if (inv.status !== "draft") {
      throw new Error("Переучёт уже закрыт");
    }
    if ((itemCount ?? 0) < (productCount ?? 0)) {
      throw new Error("Заполните все позиции перед закрытием");
    }

    const { error } = await sb
      .from("inventories")
      .update({ status: "completed" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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
      .select("id,restaurant_id,status,created_at,created_by")
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
        .select("id,restaurant_id,status,created_at,created_by")
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
          .select("id,restaurant_id,status,created_at,created_by")
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
