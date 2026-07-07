import { createServerFn } from "@tanstack/react-start";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  PERMISSIONS,
  assertAreaAccess,
  assertNetworkAccess,
  assertRestaurantAccess,
  canAccessArea,
  canAccessNetwork,
  canAccessRestaurant,
  getAllowedArea,
  getEffectiveRestaurantId,
  hasPermission,
  isPermissionKey,
  requirePermission,
  serializeAuthorization,
  type AuthorizationContext,
  type PermissionKey,
} from "./authorization";
import { normalizeCatalogKey } from "./catalogImport";
import { toSafeCategoryMutationError } from "./categoryErrors";

const idSchema = z.object({ id: z.string().uuid() });
const sessionSchema = z.object({ session_token: z.string().min(32).max(2048) });
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 210_000;
const productUnitSchema = z.enum(["л", "кг", "шт", "бут"]);
const productStatusSchema = z.enum(["approved", "pending", "archived"]);
const stockTransferStatusSchema = z.enum(["sent", "delivered", "cancelled"]);
const announcementPrioritySchema = z.enum(["normal", "important", "urgent"]);
const announcementAudienceSchema = z.enum([
  "all_staff",
  "restaurant",
  "bar_staff",
  "kitchen_staff",
]);
const staffRoleSchema = z.enum([
  "bartender",
  "kitchen_manager",
  "accountant",
  "manager",
  "bar_manager",
  "kitchen_area_manager",
  "super_admin",
]);
const roleAccessSchema = z.object({
  key: staffRoleSchema,
  network_scope: z.enum(["own", "all"]),
  restaurant_scope: z.enum(["own", "network", "assigned_or_network"]),
  area_scope: z.enum(["bar", "kitchen", "all"]),
});
const inventoryAreaSchema = z.enum(["bar", "kitchen"]);
const moneySchema = z.number().min(0).max(1_000_000);
const productUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  category_id: z.string().uuid(),
  unit: productUnitSchema,
  status: productStatusSchema,
  unit_price: moneySchema,
  area: inventoryAreaSchema,
});
const productsBatchSchema = sessionSchema
  .extend({
    products: z.array(productUpdateSchema).min(1).max(100),
  })
  .superRefine(({ products }, ctx) => {
    const ids = new Set<string>();
    for (const product of products) {
      if (ids.has(product.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Один товар нельзя отправить на сохранение дважды",
          path: ["products"],
        });
        return;
      }
      ids.add(product.id);
    }
  });
const catalogImportCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    area: inventoryAreaSchema,
  })
  .strict();
const catalogImportProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category_name: z.string().trim().min(1).max(160),
    area: inventoryAreaSchema,
    unit: productUnitSchema,
    status: productStatusSchema.default("approved"),
    unit_price: moneySchema.default(0),
  })
  .strict();
const catalogImportBatchSchema = sessionSchema
  .extend({
    network_id: z.string().uuid().nullable().optional(),
    categories: z.array(catalogImportCategorySchema).max(500),
    products: z.array(catalogImportProductSchema).max(2000),
  })
  .strict()
  .superRefine(({ categories, products }, ctx) => {
    if (categories.length === 0 && products.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Нет данных для импорта",
        path: ["products"],
      });
      return;
    }

    const categoryKeys = new Set<string>();
    for (const category of categories) {
      const key = `${category.area}:${normalizeCatalogKey(category.name)}`;
      if (categoryKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Дубликат категории в пакете импорта",
          path: ["categories"],
        });
        return;
      }
      categoryKeys.add(key);
    }

    const productKeys = new Set<string>();
    for (const product of products) {
      const key = `${product.area}:${normalizeCatalogKey(product.name)}`;
      if (productKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Дубликат товара в пакете импорта",
          path: ["products"],
        });
        return;
      }
      productKeys.add(key);
    }
  });

function parseCatalogImportBatchInput(input: unknown) {
  const result = catalogImportBatchSchema.safeParse(input);
  if (result.success) return result.data;
  const firstIssue = result.error.issues[0];
  if (firstIssue?.code === z.ZodIssueCode.unrecognized_keys) {
    throw new Error("Файл импорта содержит неподдерживаемые поля");
  }
  throw new Error(firstIssue?.message || "Некорректные данные импорта");
}
const inventoryEntryTypeSchema = z.enum(["add", "set"]);
const writeOffFiltersSchema = sessionSchema.extend({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  restaurant_id: z.string().uuid().nullable().optional(),
  area: inventoryAreaSchema.nullable().optional(),
  network_id: z.string().uuid().nullable().optional(),
});
const stockTransferFiltersSchema = sessionSchema.extend({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .nullable()
    .optional(),
  restaurant_id: z.string().uuid().nullable().optional(),
  area: inventoryAreaSchema.nullable().optional(),
  status: stockTransferStatusSchema.nullable().optional(),
  network_id: z.string().uuid().nullable().optional(),
});
const networkFilterSchema = { network_id: z.string().uuid().nullable().optional() };

type StaffRole = z.infer<typeof staffRoleSchema>;
type InventoryArea = z.infer<typeof inventoryAreaSchema>;

type AuthUser = {
  id: string;
  name: string;
  login: string;
  role: StaffRole;
  restaurant_id: string | null;
  network_id: string | null;
};

type AuthContext = AuthorizationContext & {
  user: AuthUser;
  restaurant: { id: string; name: string } | null;
  network: { id: string; name: string; is_active: boolean } | null;
};

type InventoryRow = {
  id: string;
  restaurant_id: string;
  network_id: string;
  status: string;
  created_at: string;
  created_by: string | null;
  area?: InventoryArea | string | null;
  correction_comment?: string | null;
};

type LoginEventUser = {
  id: string;
  name: string;
  role: string;
  restaurant_id: string | null;
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

async function loadNetwork(
  sb: ReturnType<typeof import("./barstock.server").getBarstock>,
  id: string | null,
) {
  if (!id) return null;
  const { data } = await sb
    .from("restaurant_networks")
    .select("id,name,is_active")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

async function recordLoginEvent(
  sb: ReturnType<typeof import("./barstock.server").getBarstock>,
  input: {
    login: string;
    success: boolean;
    failure_reason?: string | null;
    user?: LoginEventUser | null;
  },
) {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const userAgent = getRequestHeader("user-agent")?.slice(0, 1000) ?? null;
    const { error } = await sb.from("login_events").insert({
      user_id: input.user?.id ?? null,
      login: input.login,
      user_name: input.user?.name ?? null,
      role: input.user?.role ?? null,
      restaurant_id: input.user?.restaurant_id ?? null,
      success: input.success,
      failure_reason: input.failure_reason ?? null,
      user_agent: userAgent,
    });
    if (error) console.error("Failed to record login event", error.message);
  } catch (error) {
    console.error("Failed to record login event", error);
  }
}

async function requireAuthorizationContext(sessionToken: string): Promise<AuthContext> {
  const { getBarstock } = await import("./barstock.server");
  const sb = getBarstock();
  const userId = verifySessionToken(sessionToken);
  const { data: user, error } = await sb
    .from("users")
    .select("id,name,login,role,restaurant_id,network_id,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user || !staffRoleSchema.safeParse(user.role).success) {
    throw new Error("Пользователь не найден");
  }
  if (user.is_active === false) {
    throw new Error("Пользователь отключён");
  }
  if (user.role !== "super_admin" && !user.network_id) {
    throw new Error("Пользователю не назначена сеть ресторанов");
  }

  const network = await loadNetwork(sb, user.network_id);
  if (user.role !== "super_admin" && (!network || network.is_active === false)) {
    throw new Error("Сеть ресторанов отключена");
  }

  const [{ data: role, error: roleError }, { data: rolePermissions, error: permissionsError }] =
    await Promise.all([
      sb
        .from("app_roles")
        .select("key,network_scope,restaurant_scope,area_scope")
        .eq("key", user.role)
        .maybeSingle(),
      sb.from("app_role_permissions").select("permission_key").eq("role_key", user.role),
    ]);
  if (roleError) throw new Error("Не удалось загрузить роль пользователя");
  if (permissionsError) throw new Error("Не удалось загрузить права пользователя");
  const parsedRole = roleAccessSchema.safeParse(role);
  if (!parsedRole.success) throw new Error("Роль пользователя не настроена");

  return {
    userId: user.id,
    roleKey: user.role,
    networkId: user.network_id,
    restaurantId: user.restaurant_id,
    permissions: new Set(
      (rolePermissions ?? [])
        .map((item) => item.permission_key)
        .filter((permission): permission is PermissionKey => isPermissionKey(permission)),
    ),
    scope: {
      network: parsedRole.data.network_scope,
      restaurant: parsedRole.data.restaurant_scope,
      area: parsedRole.data.area_scope,
    },
    user: user as AuthUser,
    restaurant: await loadRestaurant(sb, user.restaurant_id),
    network,
  };
}

// Transitional local alias keeps server-function call sites compact while every call
// receives the freshly loaded database-backed authorization context.
const requireSession = requireAuthorizationContext;

function requireNetworkId(ctx: AuthContext) {
  if (!ctx.user.network_id) throw new Error("Пользователю не назначена сеть ресторанов");
  return ctx.user.network_id;
}

function assertSameNetwork(ctx: AuthContext, targetNetworkId: string | null | undefined) {
  assertNetworkAccess(ctx, targetNetworkId ?? null);
}

function resolveNetworkId(ctx: AuthContext, requestedNetworkId?: string | null) {
  if (ctx.scope.network === "all") {
    if (!requestedNetworkId) throw new Error("Выберите сеть ресторанов");
    return requestedNetworkId;
  }
  const networkId = requireNetworkId(ctx);
  if (requestedNetworkId && requestedNetworkId !== networkId) {
    throw new Error("Нет доступа к этой сети ресторанов");
  }
  return networkId;
}

function requireOperationalRole(ctx: AuthContext): InventoryArea {
  const area = getAllowedArea(ctx);
  if (!area || ctx.scope.restaurant !== "own") throw new Error("Недостаточно прав");
  return area;
}

function requireOperationalInventoryAccess(
  ctx: AuthContext,
  inventory: { restaurant_id: string | null; network_id?: string | null; area?: string | null },
) {
  const area = requireOperationalRole(ctx);
  assertSameNetwork(ctx, inventory.network_id);
  assertRestaurantAccess(ctx, inventory.restaurant_id, inventory.network_id ?? null);
  assertAreaAccess(ctx, inventory.area ?? "bar");
  return area;
}

type AnnouncementAccessRow = {
  network_id: string;
  author_id: string;
  audience_type: string;
  target_restaurant_id: string | null;
  target_area: string | null;
  expires_at: string | null;
  is_active: boolean;
};

function canViewAnnouncement(ctx: AuthContext, announcement: AnnouncementAccessRow) {
  if (!hasPermission(ctx, PERMISSIONS.ANNOUNCEMENTS_VIEW)) return false;
  if (!canAccessNetwork(ctx, announcement.network_id)) return false;
  if (!announcement.is_active) return false;
  if (announcement.expires_at && new Date(announcement.expires_at).getTime() <= Date.now()) {
    return false;
  }
  if (announcement.author_id === ctx.user.id) return true;
  if (announcement.audience_type === "all_staff") return true;
  if (announcement.audience_type === "restaurant") {
    return canAccessRestaurant(ctx, announcement.target_restaurant_id, announcement.network_id);
  }
  if (
    announcement.audience_type === "bar_staff" ||
    announcement.audience_type === "kitchen_staff"
  ) {
    const audienceArea = announcement.audience_type === "kitchen_staff" ? "kitchen" : "bar";
    if (!canAccessArea(ctx, audienceArea)) return false;
    return (
      !announcement.target_restaurant_id ||
      canAccessRestaurant(ctx, announcement.target_restaurant_id, announcement.network_id)
    );
  }
  return false;
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
      .select("id,name,login,role,restaurant_id,network_id,password_hash,is_active")
      .eq("login", data.login)
      .maybeSingle();

    if (error) {
      await recordLoginEvent(sb, {
        login: data.login,
        success: false,
        failure_reason: "database_error",
      });
      throw new Error(error.message);
    }
    if (!user) {
      await recordLoginEvent(sb, {
        login: data.login,
        success: false,
        failure_reason: "user_not_found",
      });
      throw new Error("Неверный логин или пароль");
    }
    const eventUser: LoginEventUser = {
      id: user.id,
      name: user.name,
      role: user.role,
      restaurant_id: user.restaurant_id,
    };
    if (user.is_active === false) {
      await recordLoginEvent(sb, {
        login: data.login,
        success: false,
        failure_reason: "inactive_user",
        user: eventUser,
      });
      throw new Error("Неверный логин или пароль");
    }
    if (!verifyPassword(data.password, user.password_hash)) {
      await recordLoginEvent(sb, {
        login: data.login,
        success: false,
        failure_reason: "invalid_password",
        user: eventUser,
      });
      throw new Error("Неверный логин или пароль");
    }
    if (user.role !== "super_admin" && !user.network_id) {
      await recordLoginEvent(sb, {
        login: data.login,
        success: false,
        failure_reason: "network_not_assigned",
        user: eventUser,
      });
      throw new Error("Пользователю не назначена сеть ресторанов");
    }
    const userNetwork = await loadNetwork(sb, user.network_id);
    if (user.role !== "super_admin" && (!userNetwork || userNetwork.is_active === false)) {
      await recordLoginEvent(sb, {
        login: data.login,
        success: false,
        failure_reason: "inactive_network",
        user: eventUser,
      });
      throw new Error("Сеть ресторанов отключена");
    }

    if (!String(user.password_hash ?? "").startsWith("pbkdf2$sha256$")) {
      await sb
        .from("users")
        .update({ password_hash: hashPassword(data.password) })
        .eq("id", user.id);
    }

    await recordLoginEvent(sb, {
      login: data.login,
      success: true,
      user: eventUser,
    });

    const sessionToken = createSessionToken(user.id);
    const authorization = await requireSession(sessionToken);
    return {
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        role: user.role,
        restaurant_id: user.restaurant_id,
        network_id: user.network_id,
      },
      restaurant: await loadRestaurant(sb, user.restaurant_id),
      network: userNetwork,
      ...serializeAuthorization(authorization),
      session_token: sessionToken,
    };
  });

export const listLoginEventsFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        period: z.enum(["today", "7days", "month"]).default("7days"),
        status: z.enum(["all", "success", "failure"]).default("all"),
        role: staffRoleSchema.nullable().optional(),
        search: z.string().trim().max(120).default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.LOGIN_HISTORY_VIEW);

    const now = new Date();
    const periodStart = new Date(now);
    if (data.period === "today") periodStart.setUTCHours(0, 0, 0, 0);
    if (data.period === "7days") periodStart.setUTCDate(periodStart.getUTCDate() - 7);
    if (data.period === "month") {
      periodStart.setUTCDate(1);
      periodStart.setUTCHours(0, 0, 0, 0);
    }

    const { getBarstock } = await import("./barstock.server");
    let query = getBarstock()
      .from("login_events")
      .select(
        "id,user_id,login,user_name,role,restaurant_id,success,failure_reason,user_agent,created_at,restaurants(name)",
      )
      .gte("created_at", periodStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (data.status === "success") query = query.eq("success", true);
    if (data.status === "failure") query = query.eq("success", false);
    if (data.role) query = query.eq("role", data.role);
    const safeSearch = data.search.replace(/[^\p{L}\p{N}@._ -]/gu, "").trim();
    if (safeSearch) {
      query = query.or(`login.ilike.%${safeSearch}%,user_name.ilike.%${safeSearch}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
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
        network_id: ctx.user.network_id,
      },
      restaurant: ctx.restaurant,
      network: ctx.network,
      ...serializeAuthorization(ctx),
      session_token: data.session_token,
    };
  });

export const createAnnouncementFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        title: z.string().trim().min(1).max(150),
        body: z.string().trim().min(1).max(5_000),
        priority: announcementPrioritySchema.default("normal"),
        audience_type: announcementAudienceSchema.default("all_staff"),
        target_restaurant_id: z.string().uuid().nullable().optional(),
        expires_at: z.string().datetime().nullable().optional(),
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.ANNOUNCEMENTS_CREATE);
    const networkId = resolveNetworkId(ctx, data.network_id);
    const targetRestaurantId = data.target_restaurant_id ?? null;
    const managerArea = getAllowedArea(ctx);

    if (data.audience_type === "restaurant" && !targetRestaurantId) {
      throw new Error("Выберите ресторан для этой аудитории");
    }
    if (managerArea === "bar" && data.audience_type === "kitchen_staff") {
      throw new Error("Бар-менеджер не может публиковать сообщения для кухни");
    }
    if (managerArea === "kitchen" && data.audience_type === "bar_staff") {
      throw new Error("Менеджер по кухне не может публиковать сообщения для бара");
    }
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
      throw new Error("Срок действия должен быть в будущем");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    if (targetRestaurantId) {
      const { data: restaurant, error: restaurantError } = await sb
        .from("restaurants")
        .select("id,network_id")
        .eq("id", targetRestaurantId)
        .maybeSingle();
      if (restaurantError) throw new Error(restaurantError.message);
      if (!restaurant || restaurant.network_id !== networkId) {
        throw new Error("Ресторан относится к другой сети");
      }
    }

    const { data: announcement, error } = await sb
      .from("announcements")
      .insert({
        network_id: networkId,
        author_id: ctx.user.id,
        title: data.title,
        body: data.body,
        priority: data.priority,
        audience_type: data.audience_type,
        target_restaurant_id: data.audience_type === "all_staff" ? null : targetRestaurantId,
        target_area:
          data.audience_type === "bar_staff"
            ? "bar"
            : data.audience_type === "kitchen_staff"
              ? "kitchen"
              : null,
        expires_at: data.expires_at ?? null,
        is_active: true,
      })
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return announcement;
  });

export const listAnnouncementsFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        include_inactive: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(200).optional().default(100),
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.ANNOUNCEMENTS_VIEW);
    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();

    let query = sb
      .from("announcements")
      .select(
        "id,network_id,author_id,title,body,priority,audience_type,target_restaurant_id,target_area,created_at,expires_at,is_active",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (ctx.scope.network === "all") {
      if (data.network_id) query = query.eq("network_id", data.network_id);
    } else {
      query = query.eq("network_id", requireNetworkId(ctx));
    }

    const { data: announcements, error } = await query;
    if (error) throw new Error(error.message);
    const visible = (announcements ?? []).filter((announcement) => {
      if (canViewAnnouncement(ctx, announcement)) return true;
      if (data.include_inactive && hasPermission(ctx, PERMISSIONS.ANNOUNCEMENTS_DEACTIVATE)) {
        return (
          (ctx.scope.network === "all" ||
            (announcement.network_id === requireNetworkId(ctx) &&
              announcement.author_id === ctx.user.id)) &&
          (!announcement.is_active ||
            Boolean(
              announcement.expires_at && new Date(announcement.expires_at).getTime() <= Date.now(),
            ))
        );
      }
      return false;
    });
    const announcementIds = visible.map((announcement) => announcement.id);
    const authorIds = Array.from(new Set(visible.map((announcement) => announcement.author_id)));
    const restaurantIds = Array.from(
      new Set(
        visible
          .map((announcement) => announcement.target_restaurant_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const networkIds = Array.from(new Set(visible.map((announcement) => announcement.network_id)));

    const [
      readsResult,
      authorsResult,
      restaurantsResult,
      networksResult,
      usersResult,
      rolesResult,
    ] = await Promise.all([
      announcementIds.length
        ? sb
            .from("announcement_reads")
            .select("announcement_id,user_id,read_at")
            .in("announcement_id", announcementIds)
        : Promise.resolve({ data: [], error: null }),
      authorIds.length
        ? sb.from("users").select("id,name").in("id", authorIds)
        : Promise.resolve({ data: [], error: null }),
      restaurantIds.length
        ? sb.from("restaurants").select("id,name").in("id", restaurantIds)
        : Promise.resolve({ data: [], error: null }),
      networkIds.length
        ? sb.from("restaurant_networks").select("id,name").in("id", networkIds)
        : Promise.resolve({ data: [], error: null }),
      networkIds.length
        ? sb
            .from("users")
            .select("id,role,restaurant_id,network_id,is_active")
            .in("network_id", networkIds)
            .neq("is_active", false)
        : Promise.resolve({ data: [], error: null }),
      sb.from("app_roles").select("key,restaurant_scope,area_scope"),
    ]);
    for (const result of [
      readsResult,
      authorsResult,
      restaurantsResult,
      networksResult,
      usersResult,
      rolesResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const reads = readsResult.data ?? [];
    const authorById = new Map((authorsResult.data ?? []).map((row) => [row.id, row.name]));
    const restaurantById = new Map((restaurantsResult.data ?? []).map((row) => [row.id, row.name]));
    const networkById = new Map((networksResult.data ?? []).map((row) => [row.id, row.name]));
    const users = usersResult.data ?? [];
    const roleScopeByKey = new Map((rolesResult.data ?? []).map((role) => [role.key, role]));

    const rows = visible.map((announcement) => {
      const announcementReads = reads.filter((read) => read.announcement_id === announcement.id);
      const recipientCount = users.filter((user) => {
        if (user.network_id !== announcement.network_id) return false;
        if (announcement.audience_type === "all_staff") return true;
        if (announcement.audience_type === "restaurant") {
          return user.restaurant_id === announcement.target_restaurant_id;
        }
        const audienceArea = announcement.audience_type === "kitchen_staff" ? "kitchen" : "bar";
        const roleScope = roleScopeByKey.get(user.role);
        if (
          !roleScope ||
          (roleScope.area_scope !== "all" && roleScope.area_scope !== audienceArea)
        ) {
          return false;
        }
        const hasNetworkRestaurantScope =
          roleScope.restaurant_scope === "network" ||
          (roleScope.restaurant_scope === "assigned_or_network" && !user.restaurant_id);
        return (
          !announcement.target_restaurant_id ||
          user.restaurant_id === announcement.target_restaurant_id ||
          hasNetworkRestaurantScope
        );
      }).length;
      return {
        ...announcement,
        author_name: authorById.get(announcement.author_id) ?? "Неизвестный автор",
        target_restaurant_name: announcement.target_restaurant_id
          ? (restaurantById.get(announcement.target_restaurant_id) ?? "Неизвестный ресторан")
          : null,
        network_name: networkById.get(announcement.network_id) ?? "Неизвестная сеть",
        is_read: announcementReads.some((read) => read.user_id === ctx.user.id),
        read_count: announcementReads.length,
        recipient_count: recipientCount,
        can_deactivate:
          hasPermission(ctx, PERMISSIONS.ANNOUNCEMENTS_DEACTIVATE) &&
          (announcement.author_id === ctx.user.id || ctx.scope.network === "all"),
      };
    });

    return {
      announcements: rows,
      unread_count: rows.filter((row) => row.is_active && !row.is_read).length,
    };
  });

export const markAnnouncementReadFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.ANNOUNCEMENTS_VIEW);
    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: announcement, error: announcementError } = await sb
      .from("announcements")
      .select(
        "id,network_id,author_id,audience_type,target_restaurant_id,target_area,expires_at,is_active",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (announcementError) throw new Error(announcementError.message);
    if (!announcement || !canViewAnnouncement(ctx, announcement)) {
      throw new Error("Сообщение недоступно");
    }

    const { error } = await sb.from("announcement_reads").upsert(
      {
        announcement_id: data.id,
        user_id: ctx.user.id,
        read_at: new Date().toISOString(),
      },
      { onConflict: "announcement_id,user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deactivateAnnouncementFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.ANNOUNCEMENTS_DEACTIVATE);
    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: announcement, error: announcementError } = await sb
      .from("announcements")
      .select("id,network_id,author_id")
      .eq("id", data.id)
      .maybeSingle();
    if (announcementError) throw new Error(announcementError.message);
    if (!announcement) throw new Error("Сообщение не найдено");
    assertSameNetwork(ctx, announcement.network_id);
    if (ctx.scope.network !== "all" && announcement.author_id !== ctx.user.id) {
      throw new Error("Можно скрыть только своё сообщение");
    }
    const { error } = await sb.from("announcements").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRestaurantNetworksFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.NETWORKS_VIEW);
    const { getBarstock } = await import("./barstock.server");
    const { data: rows, error } = await getBarstock()
      .from("restaurant_networks")
      .select("id,name,is_active,created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createRestaurantNetworkFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ name: z.string().trim().min(1).max(160) }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.NETWORKS_MANAGE);
    const { getBarstock } = await import("./barstock.server");
    const { data: network, error } = await getBarstock()
      .from("restaurant_networks")
      .insert({ name: data.name, is_active: true })
      .select("id,name,is_active,created_at")
      .single();
    if (error) throw new Error(error.message);
    return network;
  });

export const updateRestaurantNetworkFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(160),
        is_active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.NETWORKS_MANAGE);
    const { getBarstock } = await import("./barstock.server");
    const { data: network, error } = await getBarstock()
      .from("restaurant_networks")
      .update({ name: data.name, is_active: data.is_active })
      .eq("id", data.id)
      .select("id,name,is_active,created_at")
      .single();
    if (error) throw new Error(error.message);
    return network;
  });

export const listRestaurantsFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.extend(networkFilterSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.RESTAURANTS_VIEW);

    const { getBarstock } = await import("./barstock.server");
    let query = getBarstock().from("restaurants").select("id,name,network_id").order("name");
    if (ctx.scope.network === "all") {
      if (data.network_id) query = query.eq("network_id", data.network_id);
    } else {
      query = query.eq("network_id", requireNetworkId(ctx));
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAreaStaffFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema.extend({ restaurant_id: z.string().uuid().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.STAFF_DIRECTORY);
    const area = getAllowedArea(ctx);
    if (!area) throw new Error("Недостаточно прав");

    const roles: StaffRole[] =
      area === "kitchen"
        ? ["kitchen_manager", "kitchen_area_manager"]
        : ["bartender", "bar_manager"];
    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    let query = sb
      .from("users")
      .select("id,name,login,role,restaurant_id,is_active")
      .eq("network_id", requireNetworkId(ctx))
      .in("role", roles)
      .order("name");
    if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);
    const { data: staff, error } = await query;
    if (error) throw new Error(error.message);

    const restaurantIds = Array.from(
      new Set(
        (staff ?? []).map((user) => user.restaurant_id).filter((id): id is string => Boolean(id)),
      ),
    );
    const { data: restaurants, error: restaurantsError } = restaurantIds.length
      ? await sb.from("restaurants").select("id,name").in("id", restaurantIds)
      : { data: [], error: null };
    if (restaurantsError) throw new Error(restaurantsError.message);
    const restaurantById = new Map((restaurants ?? []).map((row) => [row.id, row.name]));

    return (staff ?? []).map((user) => ({
      ...user,
      restaurant_name: user.restaurant_id
        ? (restaurantById.get(user.restaurant_id) ?? "Неизвестный ресторан")
        : "Вся сеть",
    }));
  });

export const createRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({ name: z.string().trim().min(1).max(160), ...networkFilterSchema })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.RESTAURANTS_MANAGE);

    const networkId = resolveNetworkId(ctx, data.network_id);
    const { getBarstock } = await import("./barstock.server");
    const { data: restaurant, error } = await getBarstock()
      .from("restaurants")
      .insert({ name: data.name, network_id: networkId })
      .select("id,name,network_id")
      .single();
    if (error) throw new Error(error.message);
    return restaurant;
  });

export const listBartendersFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.extend(networkFilterSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.STAFF_VIEW);

    const { getBarstock } = await import("./barstock.server");
    let query = getBarstock()
      .from("users")
      .select("id,name,login,role,restaurant_id,network_id,is_active")
      .in("role", [
        "bartender",
        "kitchen_manager",
        "accountant",
        "manager",
        "bar_manager",
        "kitchen_area_manager",
        "super_admin",
      ])
      .order("name");
    if (ctx.scope.network !== "all") {
      query = query
        .eq("network_id", requireNetworkId(ctx))
        .neq("role", "super_admin")
        .neq("is_active", false);
    } else if (data.network_id) {
      query = query.eq("network_id", data.network_id);
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
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.STAFF_CREATE);
    requirePermission(ctx, PERMISSIONS.ROLES_ASSIGN);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const role = data.role;
    if (role === "super_admin" && ctx.user.role !== "super_admin") {
      throw new Error("Только администратор системы может назначить эту роль");
    }
    if (
      ctx.user.role === "accountant" &&
      (role === "bar_manager" || role === "kitchen_area_manager")
    ) {
      throw new Error("Только администратор системы может создать менеджера зоны");
    }
    const networkId =
      role === "super_admin" && data.network_id == null
        ? null
        : resolveNetworkId(ctx, data.network_id);
    const restaurantId = data.restaurant_id ?? null;
    if ((role === "bartender" || role === "kitchen_manager") && !restaurantId) {
      throw new Error("Restaurant is required for this role");
    }
    if (restaurantId) {
      const { data: restaurant, error: restaurantError } = await sb
        .from("restaurants")
        .select("id,network_id")
        .eq("id", restaurantId)
        .maybeSingle();
      if (restaurantError) throw new Error(restaurantError.message);
      if (!restaurant) throw new Error("Restaurant not found");
      if (restaurant.network_id !== networkId) throw new Error("Ресторан относится к другой сети");
    }

    const { data: user, error } = await sb
      .from("users")
      .insert({
        name: data.name,
        login: data.login,
        password_hash: hashPassword(data.password),
        role,
        network_id: networkId,
        restaurant_id: role === "accountant" || role === "super_admin" ? null : restaurantId,
        is_active: true,
      })
      .select("id,name,login,role,restaurant_id,network_id,is_active")
      .single();
    if (error) throw new Error(error.message);
    return user;
  });

export const deleteBartenderFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.STAFF_DELETE);
    if (ctx.user.id === data.id) {
      throw new Error("Нельзя удалить текущего пользователя");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: bartender, error: bartenderError } = await sb
      .from("users")
      .select("id,role,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (bartenderError) throw new Error(bartenderError.message);
    if (!bartender || !staffRoleSchema.safeParse(bartender.role).success) {
      throw new Error("Staff member not found");
    }
    assertSameNetwork(ctx, bartender.network_id);
    if (bartender.role === "super_admin" && ctx.user.role !== "super_admin") {
      throw new Error("Только администратор системы может удалить другого администратора");
    }
    if (
      ctx.user.role === "accountant" &&
      ["manager", "bar_manager", "kitchen_area_manager", "accountant"].includes(bartender.role)
    ) {
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
      .extend({
        id: z.string().uuid(),
        restaurant_id: z.string().uuid().nullable(),
        role: staffRoleSchema,
        is_active: z.boolean(),
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.STAFF_EDIT);
    requirePermission(ctx, PERMISSIONS.ROLES_ASSIGN);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: bartender, error: bartenderError } = await sb
      .from("users")
      .select("id,role,restaurant_id,network_id,is_active")
      .eq("id", data.id)
      .maybeSingle();
    if (bartenderError) throw new Error(bartenderError.message);
    if (!bartender || !staffRoleSchema.safeParse(bartender.role).success) {
      throw new Error("Сотрудник не найден");
    }
    assertSameNetwork(ctx, bartender.network_id);
    const networkId =
      ctx.user.role === "super_admin" && data.role === "super_admin" && data.network_id == null
        ? null
        : ctx.user.role === "super_admin"
          ? resolveNetworkId(ctx, data.network_id ?? bartender.network_id)
          : requireNetworkId(ctx);
    if (ctx.user.id === data.id && (data.role !== bartender.role || !data.is_active)) {
      throw new Error("Нельзя изменить свою роль или отключить себя");
    }
    if (ctx.user.role !== "super_admin") {
      if (["accountant", "super_admin"].includes(bartender.role)) {
        throw new Error("Бухгалтер не может изменить этого пользователя");
      }
      if (data.role !== bartender.role) {
        throw new Error("Только администратор системы может изменить роль сотрудника");
      }
      if (
        data.is_active !== (bartender.is_active !== false) &&
        !["bartender", "kitchen_manager"].includes(bartender.role)
      ) {
        throw new Error("Бухгалтер не может изменить активность этого пользователя");
      }
    }
    if (data.role === "super_admin" && ctx.user.role !== "super_admin") {
      throw new Error("Только администратор системы может назначить эту роль");
    }
    if ((data.role === "bartender" || data.role === "kitchen_manager") && !data.restaurant_id) {
      throw new Error("Для этой роли ресторан обязателен");
    }
    if (data.restaurant_id) {
      const { data: restaurant, error: restaurantError } = await sb
        .from("restaurants")
        .select("id,network_id")
        .eq("id", data.restaurant_id)
        .maybeSingle();
      if (restaurantError) throw new Error(restaurantError.message);
      if (!restaurant) throw new Error("Ресторан не найден");
      if (restaurant.network_id !== networkId) throw new Error("Ресторан относится к другой сети");
    }

    const { data: user, error } = await sb
      .from("users")
      .update({
        role: data.role,
        network_id: networkId,
        restaurant_id:
          data.role === "accountant" || data.role === "super_admin" ? null : data.restaurant_id,
        is_active: data.is_active,
      })
      .eq("id", data.id)
      .select("id,name,login,role,restaurant_id,network_id,is_active")
      .single();
    if (error) throw new Error(error.message);
    return user;
  });

export const deleteRestaurantFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.RESTAURANTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: restaurant, error: restaurantError } = await sb
      .from("restaurants")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (restaurantError) throw new Error(restaurantError.message);
    if (!restaurant) throw new Error("Ресторан не найден");
    assertSameNetwork(ctx, restaurant.network_id);
    const [
      { count: activeBartendersCount, error: activeBartendersError },
      { count: inventoriesCount, error: inventoriesError },
    ] = await Promise.all([
      sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .in("role", [
          "bartender",
          "kitchen_manager",
          "manager",
          "bar_manager",
          "kitchen_area_manager",
        ])
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
  .inputValidator((input) => sessionSchema.extend(networkFilterSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.CATEGORIES_VIEW);

    const { getBarstock } = await import("./barstock.server");
    let query = getBarstock().from("categories").select("id,name,area,network_id").order("name");
    if (ctx.scope.network === "all") {
      if (data.network_id) query = query.eq("network_id", data.network_id);
    } else query = query.eq("network_id", requireNetworkId(ctx));
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        name: z.string().trim().min(1).max(160),
        area: inventoryAreaSchema,
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.CATEGORIES_MANAGE);

    const networkId = resolveNetworkId(ctx, data.network_id);
    const { getBarstock } = await import("./barstock.server");
    const { data: category, error } = await getBarstock()
      .from("categories")
      .insert({ name: data.name, area: data.area, network_id: networkId })
      .select("id,name,area,network_id")
      .single();
    if (error) {
      console.error("createCategoryFn database error", error);
      throw toSafeCategoryMutationError(error, "create");
    }
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
    requirePermission(ctx, PERMISSIONS.CATEGORIES_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: existing, error: existingError } = await sb
      .from("categories")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) {
      console.error("updateCategoryFn category lookup error", existingError);
      throw toSafeCategoryMutationError(existingError, "update");
    }
    if (!existing) throw new Error("Категория не найдена");
    assertSameNetwork(ctx, existing.network_id);
    const { count, error: productsError } = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id)
      .neq("area", data.area);
    if (productsError) {
      console.error("updateCategoryFn product validation error", productsError);
      throw toSafeCategoryMutationError(productsError, "update");
    }
    if ((count ?? 0) > 0) {
      throw new Error("Нельзя изменить зону категории: в ней есть товары другой зоны");
    }

    const { data: category, error } = await sb
      .from("categories")
      .update({ name: data.name, area: data.area })
      .eq("id", data.id)
      .select("id,name,area,network_id")
      .single();
    if (error) {
      console.error("updateCategoryFn database error", error);
      throw toSafeCategoryMutationError(error, "update");
    }
    return category;
  });

export const deleteCategoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.CATEGORIES_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: existing, error: existingError } = await sb
      .from("categories")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Категория не найдена");
    assertSameNetwork(ctx, existing.network_id);
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
  .inputValidator((input) => sessionSchema.extend(networkFilterSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_VIEW);

    const { getBarstock } = await import("./barstock.server");
    let query = getBarstock()
      .from("products")
      .select("id,name,category_id,unit,status,unit_price,area,network_id")
      .order("name");
    if (ctx.scope.network === "all") {
      if (data.network_id) query = query.eq("network_id", data.network_id);
    } else query = query.eq("network_id", requireNetworkId(ctx));
    const { data: rows, error } = await query;
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
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const networkId = resolveNetworkId(ctx, data.network_id);
    const { data: category, error: categoryError } = await sb
      .from("categories")
      .select("id,area,network_id")
      .eq("id", data.category_id)
      .maybeSingle();
    if (categoryError) throw new Error(categoryError.message);
    if (!category) throw new Error("Категория не найдена");
    if (category.network_id !== networkId) throw new Error("Категория относится к другой сети");
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
        network_id: networkId,
      })
      .select("id,name,category_id,unit,status,unit_price,area,network_id")
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
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: existing, error: existingError } = await sb
      .from("products")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Товар не найден");
    assertSameNetwork(ctx, existing.network_id);
    const { data: category, error: categoryError } = await sb
      .from("categories")
      .select("id,area,network_id")
      .eq("id", data.category_id)
      .maybeSingle();
    if (categoryError) throw new Error(categoryError.message);
    if (!category) throw new Error("Категория не найдена");
    if (category.network_id !== existing.network_id) {
      throw new Error("Категория относится к другой сети");
    }
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
      .select("id,name,category_id,unit,status,unit_price,area,network_id")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const updateProductsBatchFn = createServerFn({ method: "POST" })
  .inputValidator((input) => productsBatchSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const productIds = data.products.map((product) => product.id);
    const categoryIds = [...new Set(data.products.map((product) => product.category_id))];

    const [
      { data: existingProducts, error: productsError },
      { data: categories, error: categoriesError },
    ] = await Promise.all([
      sb.from("products").select("id,network_id").in("id", productIds),
      sb.from("categories").select("id,area,network_id").in("id", categoryIds),
    ]);
    if (productsError) throw new Error(productsError.message);
    if ((existingProducts ?? []).length !== productIds.length) {
      throw new Error("Один или несколько товаров не найдены");
    }

    const productNetworkById = new Map<string, string>();
    for (const product of existingProducts ?? []) {
      if (!product.network_id) throw new Error("Товар не привязан к сети ресторанов");
      assertSameNetwork(ctx, product.network_id);
      productNetworkById.set(product.id, product.network_id);
    }

    if (categoriesError) throw new Error(categoriesError.message);
    if ((categories ?? []).length !== categoryIds.length) {
      throw new Error("Одна или несколько категорий не найдены");
    }
    const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));

    for (const product of data.products) {
      const productNetworkId = productNetworkById.get(product.id);
      const category = categoryById.get(product.category_id);
      if (!productNetworkId || !category) {
        throw new Error("Не удалось проверить товар или категорию");
      }
      if (category.network_id !== productNetworkId) {
        throw new Error(`Категория товара "${product.name}" относится к другой сети`);
      }
      if ((category.area ?? "bar") !== product.area) {
        throw new Error(`Зона товара "${product.name}" должна совпадать с зоной категории`);
      }
    }

    const { data: updatedProducts, error } = await sb.rpc("update_products_batch", {
      p_products: data.products,
    });
    if (error) throw new Error(error.message);
    if ((updatedProducts ?? []).length !== data.products.length) {
      throw new Error("Не все товары были сохранены");
    }
    return updatedProducts ?? [];
  });

type CatalogImportCreatedCategory = {
  id: string;
  name: string;
  area: InventoryArea;
  network_id: string;
};

type CatalogImportCreatedProduct = {
  id: string;
  name: string;
  category_id: string;
  unit: string;
  status: string;
  unit_price: number | string;
  area: InventoryArea;
  network_id: string;
};

type CatalogImportRpcResult = {
  created_categories?: CatalogImportCreatedCategory[];
  created_products?: CatalogImportCreatedProduct[];
  skipped_products?: Array<{ name: string; area: InventoryArea; reason: string }>;
  counts?: {
    created_categories: number;
    created_products: number;
    skipped_products: number;
  };
};

export const importCatalogBatchFn = createServerFn({ method: "POST" })
  .inputValidator(parseCatalogImportBatchInput)
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.CATEGORIES_MANAGE);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const networkId = resolveNetworkId(ctx, data.network_id);
    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { data: network, error: networkError },
      { data: categories, error: categoriesError },
      { data: products, error: productsError },
    ] = await Promise.all([
      sb.from("restaurant_networks").select("id,is_active").eq("id", networkId).maybeSingle(),
      sb.from("categories").select("id,name,area,network_id").eq("network_id", networkId),
      sb.from("products").select("id,name,area,network_id").eq("network_id", networkId),
    ]);
    if (networkError) throw new Error(networkError.message);
    if (!network || network.is_active === false) {
      throw new Error("Выбранная сеть ресторанов недоступна");
    }
    if (categoriesError) throw new Error(categoriesError.message);
    if (productsError) throw new Error(productsError.message);

    const inputCategoryKeys = new Set(
      data.categories.map((category) => `${category.area}:${normalizeCatalogKey(category.name)}`),
    );
    const existingCategoryKeys = new Set(
      (categories ?? []).map(
        (category) =>
          `${category.area === "kitchen" ? "kitchen" : "bar"}:${normalizeCatalogKey(category.name)}`,
      ),
    );
    const existingProductKeys = new Set(
      (products ?? []).map(
        (product) =>
          `${product.area === "kitchen" ? "kitchen" : "bar"}:${normalizeCatalogKey(product.name)}`,
      ),
    );
    const categoryNameAreas = new Map<string, Set<InventoryArea>>();
    for (const category of [...(categories ?? []), ...data.categories]) {
      const area = category.area === "kitchen" ? "kitchen" : "bar";
      const key = normalizeCatalogKey(category.name);
      const areas = categoryNameAreas.get(key) ?? new Set<InventoryArea>();
      areas.add(area);
      categoryNameAreas.set(key, areas);
    }

    for (const product of data.products) {
      const productKey = `${product.area}:${normalizeCatalogKey(product.name)}`;
      if (existingProductKeys.has(productKey)) continue;

      const categoryKey = `${product.area}:${normalizeCatalogKey(product.category_name)}`;
      if (!existingCategoryKeys.has(categoryKey) && !inputCategoryKeys.has(categoryKey)) {
        const sameNameAreas = categoryNameAreas.get(normalizeCatalogKey(product.category_name));
        if (sameNameAreas?.size && !sameNameAreas.has(product.area)) {
          throw new Error(`Зона товара "${product.name}" должна совпадать с зоной категории`);
        }
        throw new Error(
          `Категория "${product.category_name}" не найдена в выбранной сети и не указана в импорте`,
        );
      }
    }

    const { data: importResult, error } = await sb.rpc("import_catalog_batch", {
      p_network_id: networkId,
      p_categories: data.categories,
      p_products: data.products,
    });
    if (error) {
      console.error("importCatalogBatchFn database error", error);
      throw new Error("Не удалось импортировать справочник. Проверьте данные и попробуйте снова");
    }
    return (importResult ?? {
      created_categories: [],
      created_products: [],
      skipped_products: [],
      counts: { created_categories: 0, created_products: 0, skipped_products: 0 },
    }) as CatalogImportRpcResult;
  });

export const archiveProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: existing, error: existingError } = await sb
      .from("products")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Товар не найден");
    assertSameNetwork(ctx, existing.network_id);
    const { data: product, error } = await sb
      .from("products")
      .update({ status: "archived" })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status,unit_price,area,network_id")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const restoreProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: existing, error: existingError } = await sb
      .from("products")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error("Товар не найден");
    assertSameNetwork(ctx, existing.network_id);
    const { data: product, error } = await sb
      .from("products")
      .update({ status: "approved" })
      .eq("id", data.id)
      .select("id,name,category_id,unit,status,unit_price,area,network_id")
      .single();
    if (error) throw new Error(error.message);
    return product;
  });

export const deleteProductFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.PRODUCTS_MANAGE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: product, error: productError } = await sb
      .from("products")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Товар не найден");
    assertSameNetwork(ctx, product.network_id);

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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_VIEW);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: invs, error } = await sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
      .eq("restaurant_id", ctx.user.restaurant_id)
      .eq("network_id", requireNetworkId(ctx))
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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_CREATE);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error } = await sb
      .from("inventories")
      .insert({
        restaurant_id: ctx.user.restaurant_id,
        network_id: requireNetworkId(ctx),
        created_by: ctx.user.id,
        area,
        status: "draft",
      })
      .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_VIEW);
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
        .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
        .eq("id", data.id)
        .maybeSingle(),
      sb
        .from("categories")
        .select("id,name,area,network_id")
        .eq("network_id", requireNetworkId(ctx))
        .order("name"),
      sb
        .from("products")
        .select("id,name,unit,category_id,status,area,network_id")
        .eq("network_id", requireNetworkId(ctx))
        .order("name"),
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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_VIEW);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,restaurant_id,network_id,area")
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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_EDIT);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,area")
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
      .select("id,area,status,network_id")
      .eq("id", data.product_id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (
      !product ||
      product.network_id !== inv.network_id ||
      (product.area ?? "bar") !== (inv.area ?? "bar")
    ) {
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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_CLOSE);
    requireOperationalRole(ctx);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [
      { data: inv, error: invError },
      { data: participant },
      { data: approvedProducts, error: productsError },
      { data: existingItems, error: itemsError },
    ] = await Promise.all([
      sb
        .from("inventories")
        .select("id,restaurant_id,network_id,status,area")
        .eq("id", data.id)
        .maybeSingle(),
      sb
        .from("inventory_participants")
        .select("inventory_id,user_id")
        .eq("inventory_id", data.id)
        .eq("user_id", ctx.user.id)
        .maybeSingle(),
      sb
        .from("products")
        .select("id,area")
        .eq("network_id", requireNetworkId(ctx))
        .eq("status", "approved"),
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
    requirePermission(ctx, PERMISSIONS.REPORTS_EDIT_ACCOUNTING);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inventory, error: inventoryError } = await sb
      .from("inventories")
      .select("id,network_id")
      .eq("id", data.inventory_id)
      .maybeSingle();
    if (inventoryError) throw new Error(inventoryError.message);
    if (!inventory) throw new Error("Переучёт не найден");
    assertSameNetwork(ctx, inventory.network_id);
    const { error } = await sb.from("discrepancies").upsert(
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
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.REPORTS_LIST);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    let query = sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
      .in("status", ["completed", "correction_required"])
      .order("created_at", { ascending: false });

    if (ctx.scope.network === "all") {
      if (data.network_id) query = query.eq("network_id", data.network_id);
    } else query = query.eq("network_id", requireNetworkId(ctx));
    if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);
    const managerArea = getAllowedArea(ctx);
    if (managerArea) query = query.eq("area", managerArea);
    else if (data.area) query = query.eq("area", data.area);

    const { data: invs, error } = await query;
    if (error) throw new Error(error.message);
    return enrichInventoryRows(sb, invs ?? [], true);
  });

export const deleteInventoryFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.merge(idSchema).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.INVENTORIES_DELETE);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    assertSameNetwork(ctx, inv.network_id);

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
    requirePermission(ctx, PERMISSIONS.INVENTORIES_REOPEN);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: invError } = await sb
      .from("inventories")
      .select("id,status,network_id")
      .eq("id", data.id)
      .maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!inv) throw new Error("Переучёт не найден");
    assertSameNetwork(ctx, inv.network_id);
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
    requirePermission(ctx, PERMISSIONS.REPORTS_VIEW);

    const { getBarstock } = await import("./barstock.server");
    const { classifyDiscrepancy } = await import("./expectedStock");
    const sb = getBarstock();
    const { data: inv, error: e1 } = await sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    assertSameNetwork(ctx, inv.network_id);
    const managerArea = getAllowedArea(ctx);
    if (managerArea && (inv.area ?? "bar") !== managerArea) {
      throw new Error(
        managerArea === "kitchen"
          ? "Менеджеру по кухне доступны только кухонные отчёты"
          : "Бар-менеджеру доступны только барные отчёты",
      );
    }
    if (!hasPermission(ctx, PERMISSIONS.REPORTS_VIEW_IN_PROGRESS)) {
      if (inv.status !== "completed")
        throw new Error("Управляющему доступны только закрытые отчёты");
    }
    assertRestaurantAccess(ctx, inv.restaurant_id, inv.network_id);
    const [
      { data: restaurant },
      { data: network },
      { data: cats },
      { data: prods },
      { data: items },
      { data: expected },
      { data: discrepancy },
    ] = await Promise.all([
      sb.from("restaurants").select("id,name").eq("id", inv.restaurant_id).maybeSingle(),
      sb.from("restaurant_networks").select("id,name").eq("id", inv.network_id).maybeSingle(),
      sb.from("categories").select("id,name,area").eq("network_id", inv.network_id).order("name"),
      sb
        .from("products")
        .select("id,name,unit,category_id,status,unit_price,area")
        .eq("network_id", inv.network_id)
        .order("name"),
      sb.from("inventory_items").select("product_id,quantity").eq("inventory_id", data.id),
      sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id),
      sb.from("discrepancies").select("comment").eq("inventory_id", data.id).maybeSingle(),
    ]);

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
      restaurant: restaurant ?? null,
      network: network ?? null,
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
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.REPORTS_EXPORT);

    const { getBarstock } = await import("./barstock.server");
    const { classifyDiscrepancy } = await import("./expectedStock");
    const sb = getBarstock();
    const [year, month] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    let inventoryQuery = sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
      .in("status", ["completed", "correction_required"])
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: true });
    if (ctx.scope.network === "all") {
      if (data.network_id) inventoryQuery = inventoryQuery.eq("network_id", data.network_id);
    } else inventoryQuery = inventoryQuery.eq("network_id", requireNetworkId(ctx));
    if (data.restaurant_id) inventoryQuery = inventoryQuery.eq("restaurant_id", data.restaurant_id);
    if (data.area) inventoryQuery = inventoryQuery.eq("area", data.area);

    const { data: inventories, error: inventoriesError } = await inventoryQuery;
    if (inventoriesError) throw new Error(inventoriesError.message);
    const invs = inventories ?? [];
    const inventoryIds = invs.map((inventory) => inventory.id);
    const restaurantIds = Array.from(
      new Set(invs.map((inventory) => inventory.restaurant_id).filter(Boolean)),
    );
    const networkIds = Array.from(new Set(invs.map((inventory) => inventory.network_id)));

    const [
      { data: restaurants, error: restaurantsError },
      { data: categories, error: categoriesError },
      { data: products, error: productsError },
      { data: items, error: itemsError },
      { data: expected, error: expectedError },
      { data: networks, error: networksError },
    ] = await Promise.all([
      restaurantIds.length
        ? sb.from("restaurants").select("id,name").in("id", restaurantIds)
        : Promise.resolve({ data: [], error: null }),
      sb
        .from("categories")
        .select("id,name,area,network_id")
        .in("network_id", networkIds)
        .order("name"),
      sb
        .from("products")
        .select("id,name,unit,category_id,status,unit_price,area,network_id")
        .in("network_id", networkIds)
        .order("name"),
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
      networkIds.length
        ? sb.from("restaurant_networks").select("id,name").in("id", networkIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (restaurantsError) throw new Error(restaurantsError.message);
    if (categoriesError) throw new Error(categoriesError.message);
    if (productsError) throw new Error(productsError.message);
    if (itemsError) throw new Error(itemsError.message);
    if (expectedError) throw new Error(expectedError.message);
    if (networksError) throw new Error(networksError.message);

    const restaurantById = new Map(
      (restaurants ?? []).map((restaurant) => [restaurant.id, restaurant]),
    );
    const productById = new Map((products ?? []).map((product) => [product.id, product]));
    const networkById = new Map((networks ?? []).map((network) => [network.id, network]));
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
          network: networkById.get(inventory.network_id) ?? null,
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
    requirePermission(ctx, PERMISSIONS.WRITE_OFFS_CREATE);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) {
      throw new Error("Пользователю не назначен ресторан");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: product, error: productError } = await sb
      .from("products")
      .select("id,area,status,network_id")
      .eq("id", data.product_id)
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product) throw new Error("Товар не найден");
    if (product.network_id !== requireNetworkId(ctx)) {
      throw new Error("Товар относится к другой сети ресторанов");
    }
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
        network_id: requireNetworkId(ctx),
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
    requirePermission(ctx, PERMISSIONS.WRITE_OFFS_VIEW);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const hasNetworkView = ctx.scope.restaurant !== "own";
    const showFinance = hasPermission(ctx, PERMISSIONS.WRITE_OFFS_EXPORT);
    let query = sb
      .from("write_offs")
      .select("id,restaurant_id,network_id,area,product_id,user_id,quantity,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(hasNetworkView ? 1_000 : 100);

    if (hasNetworkView) {
      if (ctx.scope.network === "all") {
        if (data.network_id) query = query.eq("network_id", data.network_id);
      } else query = query.eq("network_id", requireNetworkId(ctx));
      if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);
      const managerArea = getAllowedArea(ctx);
      if (managerArea) query = query.eq("area", managerArea);
      else if (data.area) query = query.eq("area", data.area);
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
        .eq("network_id", requireNetworkId(ctx))
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
    const networkIds = Array.from(new Set(rows.map((row) => row.network_id)));
    const operationalArea = hasNetworkView ? null : requireOperationalRole(ctx);

    const [
      productsResult,
      usersResult,
      usedRestaurantsResult,
      availableProductsResult,
      restaurantsResult,
      networksResult,
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
            .eq("network_id", requireNetworkId(ctx))
            .eq("area", operationalArea)
            .eq("status", "approved")
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      hasNetworkView
        ? ctx.scope.network === "all" && !data.network_id
          ? sb.from("restaurants").select("id,name,network_id").order("name")
          : sb
              .from("restaurants")
              .select("id,name,network_id")
              .eq(
                "network_id",
                ctx.scope.network === "all" ? data.network_id! : requireNetworkId(ctx),
              )
              .order("name")
        : Promise.resolve({ data: [], error: null }),
      networkIds.length
        ? sb.from("restaurant_networks").select("id,name").in("id", networkIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [
      productsResult,
      usersResult,
      usedRestaurantsResult,
      availableProductsResult,
      restaurantsResult,
      networksResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const productById = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
    const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row.name]));
    const restaurantById = new Map(
      (usedRestaurantsResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const networkById = new Map((networksResult.data ?? []).map((row) => [row.id, row.name]));

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
          unit_price: showFinance ? unitPrice : null,
          amount: showFinance ? quantity * unitPrice : null,
          user_name: userById.get(row.user_id) ?? "Неизвестный пользователь",
          restaurant_name: restaurantById.get(row.restaurant_id) ?? "Без названия",
          network_name: networkById.get(row.network_id) ?? "Без сети",
        };
      }),
      products: availableProductsResult.data ?? [],
      restaurants: restaurantsResult.data ?? [],
    };
  });

export const createStockTransferFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        product_id: z.string().uuid(),
        quantity: z.number().positive().max(1_000_000),
        to_restaurant_id: z.string().uuid(),
        comment: z.string().trim().max(1_000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.TRANSFERS_CREATE);
    const area = requireOperationalRole(ctx);
    const networkId = requireNetworkId(ctx);
    const fromRestaurantId = ctx.user.restaurant_id;
    if (!fromRestaurantId) {
      throw new Error("Пользователю не назначен ресторан");
    }
    if (fromRestaurantId === data.to_restaurant_id) {
      throw new Error("Нельзя переместить товар в тот же ресторан");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [productResult, fromRestaurantResult, toRestaurantResult] = await Promise.all([
      sb
        .from("products")
        .select("id,area,status,network_id")
        .eq("id", data.product_id)
        .maybeSingle(),
      sb.from("restaurants").select("id,network_id").eq("id", fromRestaurantId).maybeSingle(),
      sb.from("restaurants").select("id,network_id").eq("id", data.to_restaurant_id).maybeSingle(),
    ]);
    if (productResult.error) throw new Error(productResult.error.message);
    if (fromRestaurantResult.error) throw new Error(fromRestaurantResult.error.message);
    if (toRestaurantResult.error) throw new Error(toRestaurantResult.error.message);
    if (!productResult.data) throw new Error("Товар не найден");
    if (!fromRestaurantResult.data) throw new Error("Ресторан отправителя не найден");
    if (!toRestaurantResult.data) throw new Error("Ресторан получателя не найден");
    if (
      productResult.data.network_id !== networkId ||
      fromRestaurantResult.data.network_id !== networkId ||
      toRestaurantResult.data.network_id !== networkId
    ) {
      throw new Error("Перемещение между разными сетями запрещено");
    }
    if ((productResult.data.area ?? "bar") !== area) {
      throw new Error("Нельзя переместить товар другой зоны");
    }
    if (productResult.data.status !== "approved") {
      throw new Error("Можно перемещать только активные товары");
    }

    const { data: transfer, error } = await sb
      .from("stock_transfers")
      .insert({
        network_id: networkId,
        from_restaurant_id: fromRestaurantId,
        to_restaurant_id: data.to_restaurant_id,
        area,
        product_id: data.product_id,
        quantity: data.quantity,
        status: "sent",
        sent_by: ctx.user.id,
        comment: data.comment || null,
      })
      .select("id,status,sent_at")
      .single();
    if (error) throw new Error(error.message);
    return transfer;
  });

export const markStockTransferDeliveredFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        transfer_id: z.string().uuid(),
        delivery_comment: z.string().trim().max(1_000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.TRANSFERS_CONFIRM);
    const area = requireOperationalRole(ctx);
    if (!ctx.user.restaurant_id) {
      throw new Error("Пользователю не назначен ресторан");
    }

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: transfer, error: transferError } = await sb
      .from("stock_transfers")
      .select("id,network_id,to_restaurant_id,area,status")
      .eq("id", data.transfer_id)
      .maybeSingle();
    if (transferError) throw new Error(transferError.message);
    if (!transfer) throw new Error("Перемещение не найдено");
    assertSameNetwork(ctx, transfer.network_id);
    if (transfer.to_restaurant_id !== ctx.user.restaurant_id) {
      throw new Error("Подтвердить доставку может только ресторан-получатель");
    }
    if ((transfer.area ?? "bar") !== area) {
      throw new Error("Нет доступа к перемещению другой зоны");
    }
    if (transfer.status !== "sent") {
      throw new Error("Это перемещение уже обработано");
    }

    const { data: updated, error } = await sb
      .from("stock_transfers")
      .update({
        status: "delivered",
        delivered_by: ctx.user.id,
        delivered_at: new Date().toISOString(),
        delivery_comment: data.delivery_comment || null,
      })
      .eq("id", data.transfer_id)
      .eq("status", "sent")
      .select("id,status,delivered_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Перемещение уже обработано другим пользователем");
    return updated;
  });

export const cancelStockTransferFn = createServerFn({ method: "POST" })
  .inputValidator((input) => sessionSchema.extend({ transfer_id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.TRANSFERS_CANCEL);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: transfer, error: transferError } = await sb
      .from("stock_transfers")
      .select("id,network_id,from_restaurant_id,area,sent_by,status")
      .eq("id", data.transfer_id)
      .maybeSingle();
    if (transferError) throw new Error(transferError.message);
    if (!transfer) throw new Error("Перемещение не найдено");
    assertSameNetwork(ctx, transfer.network_id);
    if (transfer.status !== "sent") {
      throw new Error("Отменить можно только отправленное перемещение");
    }

    if (ctx.scope.restaurant === "own") {
      const area = requireOperationalRole(ctx);
      if (
        transfer.sent_by !== ctx.user.id ||
        transfer.from_restaurant_id !== ctx.user.restaurant_id ||
        (transfer.area ?? "bar") !== area
      ) {
        throw new Error("Можно отменить только своё исходящее перемещение");
      }
    }

    const { data: updated, error } = await sb
      .from("stock_transfers")
      .update({ status: "cancelled" })
      .eq("id", data.transfer_id)
      .eq("status", "sent")
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Перемещение уже обработано другим пользователем");
    return updated;
  });

export const listStockTransfersFn = createServerFn({ method: "POST" })
  .inputValidator((input) => stockTransferFiltersSchema.parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.TRANSFERS_VIEW);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const isOperational =
      ctx.scope.restaurant === "own" && hasPermission(ctx, PERMISSIONS.TRANSFERS_CREATE);
    const ownNetworkId = ctx.scope.network === "all" ? null : requireNetworkId(ctx);
    const effectiveNetworkId =
      ctx.scope.network === "all" ? (data.network_id ?? null) : ownNetworkId;

    let query = sb
      .from("stock_transfers")
      .select(
        "id,network_id,from_restaurant_id,to_restaurant_id,area,product_id,quantity,status,sent_by,delivered_by,sent_at,delivered_at,comment,delivery_comment",
      )
      .order("sent_at", { ascending: false })
      .limit(1_000);

    if (effectiveNetworkId) query = query.eq("network_id", effectiveNetworkId);

    if (isOperational) {
      const area = requireOperationalRole(ctx);
      if (!ctx.user.restaurant_id) throw new Error("Пользователю не назначен ресторан");
      query = query
        .eq("area", area)
        .or(
          `from_restaurant_id.eq.${ctx.user.restaurant_id},to_restaurant_id.eq.${ctx.user.restaurant_id}`,
        );
    } else {
      const fixedRestaurantId = getEffectiveRestaurantId(ctx);
      const restaurantId = fixedRestaurantId ?? data.restaurant_id ?? null;
      if (restaurantId) {
        query = query.or(
          `from_restaurant_id.eq.${restaurantId},to_restaurant_id.eq.${restaurantId}`,
        );
      }
      const managerArea = getAllowedArea(ctx);
      if (managerArea) query = query.eq("area", managerArea);
      else if (data.area) query = query.eq("area", data.area);
    }

    if (data.status) query = query.eq("status", data.status);
    if (data.month) {
      const [year, month] = data.month.split("-").map(Number);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      query = query.gte("sent_at", start.toISOString()).lt("sent_at", end.toISOString());
    }

    const { data: transfers, error } = await query;
    if (error) throw new Error(error.message);
    const rows = transfers ?? [];
    const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
    const restaurantIds = Array.from(
      new Set(rows.flatMap((row) => [row.from_restaurant_id, row.to_restaurant_id])),
    );
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.sent_by, row.delivered_by])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const networkIds = Array.from(new Set(rows.map((row) => row.network_id)));

    const [
      productsResult,
      usedRestaurantsResult,
      usersResult,
      usedNetworksResult,
      availableProductsResult,
      availableRestaurantsResult,
      networksResult,
    ] = await Promise.all([
      productIds.length
        ? sb.from("products").select("id,name,unit").in("id", productIds)
        : Promise.resolve({ data: [], error: null }),
      restaurantIds.length
        ? sb.from("restaurants").select("id,name").in("id", restaurantIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? sb.from("users").select("id,name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      networkIds.length
        ? sb.from("restaurant_networks").select("id,name").in("id", networkIds)
        : Promise.resolve({ data: [], error: null }),
      isOperational
        ? sb
            .from("products")
            .select("id,name,unit")
            .eq("network_id", ownNetworkId!)
            .eq("area", requireOperationalRole(ctx))
            .eq("status", "approved")
            .order("name")
        : Promise.resolve({ data: [], error: null }),
      isOperational
        ? sb
            .from("restaurants")
            .select("id,name,network_id")
            .eq("network_id", ownNetworkId!)
            .neq("id", ctx.user.restaurant_id!)
            .order("name")
        : effectiveNetworkId
          ? sb
              .from("restaurants")
              .select("id,name,network_id")
              .eq("network_id", effectiveNetworkId)
              .order("name")
          : sb.from("restaurants").select("id,name,network_id").order("name"),
      ctx.scope.network === "all"
        ? sb.from("restaurant_networks").select("id,name,is_active").order("name")
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [
      productsResult,
      usedRestaurantsResult,
      usersResult,
      usedNetworksResult,
      availableProductsResult,
      availableRestaurantsResult,
      networksResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const productById = new Map((productsResult.data ?? []).map((row) => [row.id, row]));
    const restaurantById = new Map(
      (usedRestaurantsResult.data ?? []).map((row) => [row.id, row.name]),
    );
    const userById = new Map((usersResult.data ?? []).map((row) => [row.id, row.name]));
    const networkById = new Map((usedNetworksResult.data ?? []).map((row) => [row.id, row.name]));

    return {
      transfers: rows.map((row) => {
        const product = productById.get(row.product_id);
        return {
          ...row,
          quantity: Number(row.quantity),
          product_name: product?.name ?? "Неизвестный товар",
          unit: product?.unit ?? "",
          from_restaurant_name:
            restaurantById.get(row.from_restaurant_id) ?? "Неизвестный ресторан",
          to_restaurant_name: restaurantById.get(row.to_restaurant_id) ?? "Неизвестный ресторан",
          sent_by_name: userById.get(row.sent_by) ?? "Неизвестный пользователь",
          delivered_by_name: row.delivered_by
            ? (userById.get(row.delivered_by) ?? "Неизвестный пользователь")
            : null,
          network_name: networkById.get(row.network_id) ?? "Неизвестная сеть",
        };
      }),
      products: availableProductsResult.data ?? [],
      restaurants: availableRestaurantsResult.data ?? [],
      networks: networksResult.data ?? [],
      scope_restaurant_id: getEffectiveRestaurantId(ctx),
    };
  });

export const getManagerStatsFn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    sessionSchema
      .extend({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        restaurant_id: z.string().uuid().nullable().optional(),
        area: inventoryAreaSchema.nullable().optional(),
        ...networkFilterSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ctx = await requireSession(data.session_token);
    requirePermission(ctx, PERMISSIONS.STATISTICS_VIEW);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [year, month] = data.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const fixedRestaurantId = getEffectiveRestaurantId(ctx);
    const effectiveRestaurantId = fixedRestaurantId ?? data.restaurant_id ?? null;
    const effectiveNetworkId =
      ctx.scope.network === "all" ? (data.network_id ?? null) : requireNetworkId(ctx);
    const effectiveArea = getAllowedArea(ctx) ?? data.area;

    let inventoryQuery = sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,created_at,created_by,area")
      .eq("status", "completed")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (effectiveRestaurantId) {
      inventoryQuery = inventoryQuery.eq("restaurant_id", effectiveRestaurantId);
    }
    if (effectiveNetworkId) inventoryQuery = inventoryQuery.eq("network_id", effectiveNetworkId);
    if (effectiveArea) inventoryQuery = inventoryQuery.eq("area", effectiveArea);

    let writeOffQuery = sb
      .from("write_offs")
      .select("id,restaurant_id,network_id,area,product_id,user_id,quantity,reason,created_at")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    if (effectiveRestaurantId) {
      writeOffQuery = writeOffQuery.eq("restaurant_id", effectiveRestaurantId);
    }
    if (effectiveNetworkId) writeOffQuery = writeOffQuery.eq("network_id", effectiveNetworkId);
    if (effectiveArea) writeOffQuery = writeOffQuery.eq("area", effectiveArea);

    let transferQuery = sb
      .from("stock_transfers")
      .select("id,from_restaurant_id,to_restaurant_id,status")
      .gte("sent_at", start.toISOString())
      .lt("sent_at", end.toISOString());
    if (effectiveNetworkId) transferQuery = transferQuery.eq("network_id", effectiveNetworkId);
    if (effectiveArea) transferQuery = transferQuery.eq("area", effectiveArea);
    if (effectiveRestaurantId) {
      transferQuery = transferQuery.or(
        `from_restaurant_id.eq.${effectiveRestaurantId},to_restaurant_id.eq.${effectiveRestaurantId}`,
      );
    }

    let openInventoryQuery = sb
      .from("inventories")
      .select("id,restaurant_id,status")
      .in("status", ["draft", "correction_required"]);
    if (effectiveNetworkId) {
      openInventoryQuery = openInventoryQuery.eq("network_id", effectiveNetworkId);
    }
    if (effectiveArea) openInventoryQuery = openInventoryQuery.eq("area", effectiveArea);
    if (effectiveRestaurantId) {
      openInventoryQuery = openInventoryQuery.eq("restaurant_id", effectiveRestaurantId);
    }

    const areaStaffRoles: StaffRole[] =
      effectiveArea === "kitchen"
        ? ["kitchen_manager", "kitchen_area_manager"]
        : ["bartender", "bar_manager"];
    let areaStaffQuery = sb
      .from("users")
      .select("id,name,login,role,restaurant_id,is_active")
      .in("role", areaStaffRoles)
      .neq("is_active", false)
      .order("name");
    if (effectiveNetworkId) areaStaffQuery = areaStaffQuery.eq("network_id", effectiveNetworkId);
    if (effectiveRestaurantId) {
      areaStaffQuery = areaStaffQuery.eq("restaurant_id", effectiveRestaurantId);
    }

    const [
      { data: inventories, error: inventoriesError },
      { data: writeOffs, error: writeOffsError },
      { data: transfers, error: transfersError },
      { data: openInventories, error: openInventoriesError },
      { data: areaStaff, error: areaStaffError },
      restaurantsResult,
      networksResult,
    ] = await Promise.all([
      inventoryQuery,
      writeOffQuery,
      transferQuery,
      openInventoryQuery,
      areaStaffQuery,
      fixedRestaurantId
        ? sb
            .from("restaurants")
            .select("id,name,network_id")
            .eq("id", fixedRestaurantId)
            .order("name")
        : effectiveNetworkId
          ? sb
              .from("restaurants")
              .select("id,name,network_id")
              .eq("network_id", effectiveNetworkId)
              .order("name")
          : sb.from("restaurants").select("id,name,network_id").order("name"),
      ctx.scope.network === "all"
        ? sb.from("restaurant_networks").select("id,name,is_active").order("name")
        : sb
            .from("restaurant_networks")
            .select("id,name,is_active")
            .eq("id", requireNetworkId(ctx)),
    ]);
    if (inventoriesError) throw new Error(inventoriesError.message);
    if (writeOffsError) throw new Error(writeOffsError.message);
    if (transfersError) throw new Error(transfersError.message);
    if (openInventoriesError) throw new Error(openInventoriesError.message);
    if (areaStaffError) throw new Error(areaStaffError.message);
    if (restaurantsResult.error) throw new Error(restaurantsResult.error.message);
    if (networksResult.error) throw new Error(networksResult.error.message);

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
    const availableRestaurantById = new Map(
      (restaurantsResult.data ?? []).map((row) => [row.id, row.name]),
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
      scope_network_id: effectiveNetworkId,
      networks: networksResult.data ?? [],
      restaurants: restaurantsResult.data ?? [],
      summary: {
        inventories: invs.length,
        shortage: totals.shortage,
        surplus: totals.surplus,
        net: totals.surplus - totals.shortage - writeOffsTotal,
        problem_positions: totals.problemPositions,
        write_offs_amount: writeOffsTotal,
        transfers: (transfers ?? []).length,
        open_inventories: (openInventories ?? []).length,
        open_restaurants: new Set(
          (openInventories ?? []).map((inventory) => inventory.restaurant_id),
        ).size,
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
      area_staff:
        getAllowedArea(ctx) != null && hasPermission(ctx, PERMISSIONS.STAFF_VIEW)
          ? (areaStaff ?? []).map((staff) => ({
              ...staff,
              restaurant_name: staff.restaurant_id
                ? (availableRestaurantById.get(staff.restaurant_id) ?? "Неизвестный ресторан")
                : "Вся сеть",
            }))
          : [],
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
    requirePermission(ctx, PERMISSIONS.REPORTS_EDIT_ACCOUNTING);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inv, error: e1 } = await sb
      .from("inventories")
      .select("id,restaurant_id,network_id,status,created_at,created_by,area,correction_comment")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Переучёт не найден");
    assertSameNetwork(ctx, inv.network_id);

    const [{ data: cats, error: catsError }, { data: prods, error: prodsError }, expectedResult] =
      await Promise.all([
        sb
          .from("categories")
          .select("id,name,area,network_id")
          .eq("network_id", inv.network_id)
          .order("name"),
        sb
          .from("products")
          .select("id,name,unit,category_id,status,area,network_id")
          .eq("network_id", inv.network_id)
          .order("name"),
        sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id),
      ]);
    if (catsError) throw new Error(catsError.message);
    if (prodsError) throw new Error(prodsError.message);
    if (expectedResult.error) throw new Error(expectedResult.error.message);
    return {
      inventory: inv,
      categories: (cats ?? []).filter(
        (category) => (category.area ?? "bar") === (inv.area ?? "bar"),
      ),
      products: (prods ?? []).filter((product) => (product.area ?? "bar") === (inv.area ?? "bar")),
      expected: expectedResult.data ?? [],
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
    requirePermission(ctx, PERMISSIONS.REPORTS_EDIT_ACCOUNTING);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const [{ data: inventory, error: inventoryError }, { data: product, error: productError }] =
      await Promise.all([
        sb.from("inventories").select("id,network_id").eq("id", data.inventory_id).maybeSingle(),
        sb.from("products").select("id,network_id").eq("id", data.product_id).maybeSingle(),
      ]);
    if (inventoryError) throw new Error(inventoryError.message);
    if (productError) throw new Error(productError.message);
    if (!inventory) throw new Error("Переучёт не найден");
    if (!product) throw new Error("Товар не найден");
    assertSameNetwork(ctx, inventory.network_id);
    if (product.network_id !== inventory.network_id) {
      throw new Error("Товар относится к другой сети ресторанов");
    }
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
    requirePermission(ctx, PERMISSIONS.REPORTS_EDIT_ACCOUNTING);

    const { getBarstock } = await import("./barstock.server");
    const sb = getBarstock();
    const { data: inventory, error: inventoryError } = await sb
      .from("inventories")
      .select("id,network_id")
      .eq("id", data.inventory_id)
      .maybeSingle();
    if (inventoryError) throw new Error(inventoryError.message);
    if (!inventory) throw new Error("Переучёт не найден");
    assertSameNetwork(ctx, inventory.network_id);

    const productIds = Array.from(new Set(data.items.map((item) => item.product_id)));
    const { data: products, error: productsError } = await sb
      .from("products")
      .select("id")
      .eq("network_id", inventory.network_id)
      .in("id", productIds);
    if (productsError) throw new Error(productsError.message);
    if ((products ?? []).length !== productIds.length) {
      throw new Error("Один или несколько товаров относятся к другой сети ресторанов");
    }
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
  const networkIds = Array.from(new Set(invs.map((i) => i.network_id).filter(Boolean)));

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

  let networks: Record<string, string> = {};
  if (includeRestaurants && networkIds.length) {
    const { data: ns } = await sb
      .from("restaurant_networks")
      .select("id,name")
      .in("id", networkIds);
    networks = Object.fromEntries((ns ?? []).map((network) => [network.id, network.name]));
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
    network_name: includeRestaurants ? (networks[i.network_id] ?? null) : undefined,
    items_count: counts[i.id] ?? 0,
  }));
}
