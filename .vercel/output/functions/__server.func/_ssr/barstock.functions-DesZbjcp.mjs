import { T as TSS_SERVER_FUNCTION, a as createServerFn } from "./server-B-fI4YJN.mjs";
import { pbkdf2Sync, timingSafeEqual, randomBytes, createHmac } from "node:crypto";
import "../_libs/seroval.mjs";
import "../_libs/react.mjs";
import { o as objectType, s as stringType, e as enumType, n as numberType, b as booleanType, a as arrayType } from "../_libs/zod.mjs";
import "node:async_hooks";
import "../_libs/h3-v2.mjs";
import "../_libs/rou3.mjs";
import "../_libs/srvx.mjs";
import "node:stream";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "../_libs/tanstack__react-router.mjs";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
var createServerRpc = (serverFnMeta, splitImportFn) => {
  const url = "/_serverFn/" + serverFnMeta.id;
  return Object.assign(splitImportFn, {
    url,
    serverFnMeta,
    [TSS_SERVER_FUNCTION]: true
  });
};
const idSchema = objectType({
  id: stringType().uuid()
});
const sessionSchema = objectType({
  session_token: stringType().min(32).max(2048)
});
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_ITERATIONS = 21e4;
const productUnitSchema = enumType(["л", "кг", "шт", "бут"]);
const productStatusSchema = enumType(["approved", "pending", "archived"]);
const moneySchema = numberType().min(0).max(1e6);
const inventoryEntryTypeSchema = enumType(["add", "set"]);
function getSessionSecret() {
  const secret = process.env.BARSTOCK_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BarStock session secret is not configured");
  }
  return secret;
}
function toBase64Url(input) {
  return Buffer.from(input).toString("base64url");
}
function fromBase64Url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function signPayload(payload) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}
function createSessionToken(userId) {
  const payload = JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1e3) + SESSION_TTL_SECONDS
  });
  const encoded = toBase64Url(payload);
  return `${encoded}.${signPayload(encoded)}`;
}
function verifySessionToken(token) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Сессия недействительна");
  const expected = signPayload(encoded);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Сессия недействительна");
  }
  const payload = JSON.parse(fromBase64Url(encoded));
  if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) {
    throw new Error("Сессия истекла. Войдите снова");
  }
  return payload.sub;
}
function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("base64url");
  return `pbkdf2$sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") {
    return stored === password;
  }
  const iterations = Number(parts[2]);
  const salt = parts[3];
  const expected = parts[4];
  if (!Number.isInteger(iterations) || iterations < 1e5 || !salt || !expected) {
    return false;
  }
  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}
async function loadRestaurant(sb, id) {
  if (!id) return null;
  const {
    data
  } = await sb.from("restaurants").select("id,name").eq("id", id).maybeSingle();
  return data ?? null;
}
async function requireSession(sessionToken) {
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const userId = verifySessionToken(sessionToken);
  const {
    data: user,
    error
  } = await sb.from("users").select("id,name,login,role,restaurant_id,is_active").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!user || user.role !== "bartender" && user.role !== "accountant") {
    throw new Error("Пользователь не найден");
  }
  if (user.is_active === false) {
    throw new Error("Пользователь отключён");
  }
  return {
    user,
    restaurant: await loadRestaurant(sb, user.restaurant_id)
  };
}
function requireRole(ctx, role) {
  if (ctx.user.role !== role) {
    throw new Error("Недостаточно прав");
  }
}
function requireBartenderRestaurant(ctx, restaurantId) {
  requireRole(ctx, "bartender");
  if (!ctx.user.restaurant_id || ctx.user.restaurant_id !== restaurantId) {
    throw new Error("Нет доступа к этому ресторану");
  }
}
const loginFn_createServerFn_handler = createServerRpc({
  id: "28a8d70050c42d28343de998b458253a1cc39e87791d2aff4f34559a633907fa",
  name: "loginFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => loginFn.__executeServer(opts));
const loginFn = createServerFn({
  method: "POST"
}).inputValidator((input) => objectType({
  login: stringType().min(1).max(120),
  password: stringType().min(1).max(200)
}).parse(input)).handler(loginFn_createServerFn_handler, async ({
  data
}) => {
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: user,
    error
  } = await sb.from("users").select("id,name,login,role,restaurant_id,password_hash,is_active").eq("login", data.login).maybeSingle();
  if (error) throw new Error(error.message);
  if (!user || user.is_active === false || !verifyPassword(data.password, user.password_hash)) {
    throw new Error("Неверный логин или пароль");
  }
  if (!String(user.password_hash ?? "").startsWith("pbkdf2$sha256$")) {
    await sb.from("users").update({
      password_hash: hashPassword(data.password)
    }).eq("id", user.id);
  }
  return {
    user: {
      id: user.id,
      name: user.name,
      login: user.login,
      role: user.role,
      restaurant_id: user.restaurant_id
    },
    restaurant: await loadRestaurant(sb, user.restaurant_id),
    session_token: createSessionToken(user.id)
  };
});
const currentSessionFn_createServerFn_handler = createServerRpc({
  id: "4c3054a4c581398a90f98d9bfe064ba85d1b9f9cafd25ae4a6637fa4e1648fb7",
  name: "currentSessionFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => currentSessionFn.__executeServer(opts));
const currentSessionFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(currentSessionFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  return {
    user: {
      id: ctx.user.id,
      name: ctx.user.name,
      login: ctx.user.login,
      role: ctx.user.role,
      restaurant_id: ctx.user.restaurant_id
    },
    restaurant: ctx.restaurant,
    session_token: data.session_token
  };
});
const listRestaurantsFn_createServerFn_handler = createServerRpc({
  id: "6b8777e599c3e44fd6892de7ce7d6a77476cfe303fd0a2c7d9c5491890212d89",
  name: "listRestaurantsFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listRestaurantsFn.__executeServer(opts));
const listRestaurantsFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(listRestaurantsFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: rows,
    error
  } = await getBarstock().from("restaurants").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return rows ?? [];
});
const createRestaurantFn_createServerFn_handler = createServerRpc({
  id: "d19fedc8da2a6716bb4c8f6ebedd3e0503667715c5ca88e81d39d36ddb4109ac",
  name: "createRestaurantFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => createRestaurantFn.__executeServer(opts));
const createRestaurantFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(160)
}).parse(input)).handler(createRestaurantFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: restaurant,
    error
  } = await getBarstock().from("restaurants").insert({
    name: data.name
  }).select("id,name").single();
  if (error) throw new Error(error.message);
  return restaurant;
});
const listBartendersFn_createServerFn_handler = createServerRpc({
  id: "3872da7760fede97169c893c112c8841d0772877c596b11c0d281c95dfbcd4d0",
  name: "listBartendersFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listBartendersFn.__executeServer(opts));
const listBartendersFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(listBartendersFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: rows,
    error
  } = await getBarstock().from("users").select("id,name,login,restaurant_id").eq("role", "bartender").neq("is_active", false).order("name");
  if (error) throw new Error(error.message);
  return rows ?? [];
});
const createBartenderFn_createServerFn_handler = createServerRpc({
  id: "d7d2d3ae529b2726155ccd7968978de146442052be24027412b4a0d270ec0a4a",
  name: "createBartenderFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => createBartenderFn.__executeServer(opts));
const createBartenderFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(160),
  login: stringType().trim().min(1).max(120),
  password: stringType().min(6).max(200),
  restaurant_id: stringType().uuid()
}).parse(input)).handler(createBartenderFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: restaurant,
    error: restaurantError
  } = await sb.from("restaurants").select("id").eq("id", data.restaurant_id).maybeSingle();
  if (restaurantError) throw new Error(restaurantError.message);
  if (!restaurant) throw new Error("Ресторан не найден");
  const {
    data: user,
    error
  } = await sb.from("users").insert({
    name: data.name,
    login: data.login,
    password_hash: hashPassword(data.password),
    role: "bartender",
    restaurant_id: data.restaurant_id,
    is_active: true
  }).select("id,name,login,restaurant_id").single();
  if (error) throw new Error(error.message);
  return user;
});
const deleteBartenderFn_createServerFn_handler = createServerRpc({
  id: "e0a2021f31cb14a3635cb9144998e7adf149efd1b550fd7a8f343b17d8d26ef6",
  name: "deleteBartenderFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => deleteBartenderFn.__executeServer(opts));
const deleteBartenderFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(deleteBartenderFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  if (ctx.user.id === data.id) {
    throw new Error("Нельзя удалить текущего пользователя");
  }
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: bartender,
    error: bartenderError
  } = await sb.from("users").select("id,role").eq("id", data.id).maybeSingle();
  if (bartenderError) throw new Error(bartenderError.message);
  if (!bartender || bartender.role !== "bartender") throw new Error("Бармен не найден");
  const [{
    count: createdCount,
    error: createdError
  }, {
    count: participantCount,
    error: participantError
  }] = await Promise.all([sb.from("inventories").select("id", {
    count: "exact",
    head: true
  }).eq("created_by", data.id), sb.from("inventory_participants").select("inventory_id", {
    count: "exact",
    head: true
  }).eq("user_id", data.id)]);
  if (createdError) throw new Error(createdError.message);
  if (participantError) throw new Error(participantError.message);
  if ((createdCount ?? 0) > 0 || (participantCount ?? 0) > 0) {
    const {
      error: error2
    } = await sb.from("users").update({
      is_active: false
    }).eq("id", data.id);
    if (error2) throw new Error(error2.message);
    return {
      ok: true,
      mode: "soft"
    };
  }
  const {
    error
  } = await sb.from("users").delete().eq("id", data.id).eq("role", "bartender");
  if (error) throw new Error(error.message);
  return {
    ok: true,
    mode: "hard"
  };
});
const updateBartenderRestaurantFn_createServerFn_handler = createServerRpc({
  id: "31ab4ff1ed51ddae6c6250152c1362aa05a0e84c4d6fc71a921b4489a8aaa03b",
  name: "updateBartenderRestaurantFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => updateBartenderRestaurantFn.__executeServer(opts));
const updateBartenderRestaurantFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  id: stringType().uuid(),
  restaurant_id: stringType().uuid()
}).parse(input)).handler(updateBartenderRestaurantFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const [{
    data: bartender,
    error: bartenderError
  }, {
    data: restaurant,
    error: restaurantError
  }] = await Promise.all([sb.from("users").select("id,role").eq("id", data.id).maybeSingle(), sb.from("restaurants").select("id").eq("id", data.restaurant_id).maybeSingle()]);
  if (bartenderError) throw new Error(bartenderError.message);
  if (restaurantError) throw new Error(restaurantError.message);
  if (!bartender || bartender.role !== "bartender") throw new Error("Бармен не найден");
  if (!restaurant) throw new Error("Ресторан не найден");
  const {
    data: user,
    error
  } = await sb.from("users").update({
    restaurant_id: data.restaurant_id
  }).eq("id", data.id).eq("role", "bartender").select("id,name,login,restaurant_id").single();
  if (error) throw new Error(error.message);
  return user;
});
const deleteRestaurantFn_createServerFn_handler = createServerRpc({
  id: "2f8343c58ec82e662486993840fcfe54670861373086e866b40e85fae1b6118b",
  name: "deleteRestaurantFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => deleteRestaurantFn.__executeServer(opts));
const deleteRestaurantFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(deleteRestaurantFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const [{
    count: activeBartendersCount,
    error: activeBartendersError
  }, {
    count: inventoriesCount,
    error: inventoriesError
  }] = await Promise.all([sb.from("users").select("id", {
    count: "exact",
    head: true
  }).eq("role", "bartender").eq("restaurant_id", data.id).neq("is_active", false), sb.from("inventories").select("id", {
    count: "exact",
    head: true
  }).eq("restaurant_id", data.id)]);
  if (activeBartendersError) throw new Error(activeBartendersError.message);
  if (inventoriesError) throw new Error(inventoriesError.message);
  if ((activeBartendersCount ?? 0) > 0 || (inventoriesCount ?? 0) > 0) {
    throw new Error("Нельзя удалить ресторан: есть сотрудники или переучёты");
  }
  const {
    error
  } = await sb.from("restaurants").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return {
    ok: true
  };
});
const listCategoriesFn_createServerFn_handler = createServerRpc({
  id: "39b9915fc50c4e205f8ba3d1ea553bf69fdaa9959fe77960e4badb2c3e0e58e6",
  name: "listCategoriesFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listCategoriesFn.__executeServer(opts));
const listCategoriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(listCategoriesFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: rows,
    error
  } = await getBarstock().from("categories").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return rows ?? [];
});
const createCategoryFn_createServerFn_handler = createServerRpc({
  id: "812e0f6a53b09ddf26c7779de1cbd8f7f142fcafa0f06c6547b142c793bde5e7",
  name: "createCategoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => createCategoryFn.__executeServer(opts));
const createCategoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(160)
}).parse(input)).handler(createCategoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: category,
    error
  } = await getBarstock().from("categories").insert({
    name: data.name
  }).select("id,name").single();
  if (error) throw new Error(error.message);
  return category;
});
const updateCategoryFn_createServerFn_handler = createServerRpc({
  id: "0f3a5c56d8ec9fc9112e02ac12cd2ded40bc59f3f658d412c4a68d82985bf07a",
  name: "updateCategoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => updateCategoryFn.__executeServer(opts));
const updateCategoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  id: stringType().uuid(),
  name: stringType().trim().min(1).max(160)
}).parse(input)).handler(updateCategoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: category,
    error
  } = await getBarstock().from("categories").update({
    name: data.name
  }).eq("id", data.id).select("id,name").single();
  if (error) throw new Error(error.message);
  return category;
});
const deleteCategoryFn_createServerFn_handler = createServerRpc({
  id: "b7f383bacd4c25fb6d7039e363c5dc7667a3adf6a2f932ba0d4b7d1fcb18601b",
  name: "deleteCategoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => deleteCategoryFn.__executeServer(opts));
const deleteCategoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(deleteCategoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    count,
    error: countError
  } = await sb.from("products").select("id", {
    count: "exact",
    head: true
  }).eq("category_id", data.id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error("Нельзя удалить категорию, если к ней привязаны товары");
  }
  const {
    error
  } = await sb.from("categories").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return {
    ok: true
  };
});
const listProductsFn_createServerFn_handler = createServerRpc({
  id: "e828ea5540d9b7fde089901de6e26903caf03d2d4f3bffe932f372f7a619afad",
  name: "listProductsFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listProductsFn.__executeServer(opts));
const listProductsFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.parse(input)).handler(listProductsFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: rows,
    error
  } = await getBarstock().from("products").select("id,name,category_id,unit,status,unit_price").order("name");
  if (error) throw new Error(error.message);
  return rows ?? [];
});
const createProductFn_createServerFn_handler = createServerRpc({
  id: "cc149b014e351603c81e43e66c9fffef1957edd2972687867580fe349d0dbd16",
  name: "createProductFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => createProductFn.__executeServer(opts));
const createProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  name: stringType().trim().min(1).max(200),
  category_id: stringType().uuid(),
  unit: productUnitSchema,
  status: productStatusSchema.default("approved"),
  unit_price: moneySchema.default(0)
}).parse(input)).handler(createProductFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: product,
    error
  } = await getBarstock().from("products").insert({
    name: data.name,
    category_id: data.category_id,
    unit: data.unit,
    status: data.status,
    unit_price: data.unit_price
  }).select("id,name,category_id,unit,status,unit_price").single();
  if (error) throw new Error(error.message);
  return product;
});
const updateProductFn_createServerFn_handler = createServerRpc({
  id: "fe46b218a09d31b6db7c65268ab84911f538008263d1bd018774e4cc64733faf",
  name: "updateProductFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => updateProductFn.__executeServer(opts));
const updateProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  id: stringType().uuid(),
  name: stringType().trim().min(1).max(200),
  category_id: stringType().uuid(),
  unit: productUnitSchema,
  status: productStatusSchema,
  unit_price: moneySchema
}).parse(input)).handler(updateProductFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: product,
    error
  } = await getBarstock().from("products").update({
    name: data.name,
    category_id: data.category_id,
    unit: data.unit,
    status: data.status,
    unit_price: data.unit_price
  }).eq("id", data.id).select("id,name,category_id,unit,status,unit_price").single();
  if (error) throw new Error(error.message);
  return product;
});
const archiveProductFn_createServerFn_handler = createServerRpc({
  id: "2210c7275d29f1e36c09a57d185a92ddf01de92a1b1fd901744b159ea7184bbc",
  name: "archiveProductFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => archiveProductFn.__executeServer(opts));
const archiveProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(archiveProductFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    data: product,
    error
  } = await getBarstock().from("products").update({
    status: "archived"
  }).eq("id", data.id).select("id,name,category_id,unit,status,unit_price").single();
  if (error) throw new Error(error.message);
  return product;
});
const deleteProductFn_createServerFn_handler = createServerRpc({
  id: "5cd8c0b34cc855caabeafe7e9ea8aacde0512f8d533d1962bd159c4f33885b7b",
  name: "deleteProductFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => deleteProductFn.__executeServer(opts));
const deleteProductFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(deleteProductFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: product,
    error: productError
  } = await sb.from("products").select("id").eq("id", data.id).maybeSingle();
  if (productError) throw new Error(productError.message);
  if (!product) throw new Error("Товар не найден");
  const [{
    count: actualCount,
    error: actualError
  }, {
    count: expectedCount,
    error: expectedError
  }] = await Promise.all([sb.from("inventory_items").select("product_id", {
    count: "exact",
    head: true
  }).eq("product_id", data.id), sb.from("expected_items").select("product_id", {
    count: "exact",
    head: true
  }).eq("product_id", data.id)]);
  if (actualError) throw new Error(actualError.message);
  if (expectedError) throw new Error(expectedError.message);
  if ((actualCount ?? 0) > 0 || (expectedCount ?? 0) > 0) {
    const {
      error: error2
    } = await sb.from("products").update({
      status: "archived"
    }).eq("id", data.id);
    if (error2) throw new Error(error2.message);
    return {
      ok: true,
      mode: "archived",
      message: "Товар использовался в переучётах, поэтому перенесён в архив"
    };
  }
  const {
    error
  } = await sb.from("products").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return {
    ok: true,
    mode: "deleted",
    message: "Товар удалён"
  };
});
const listInventoriesFn_createServerFn_handler = createServerRpc({
  id: "a1680a4dd17d890f330c5861ac967436f9926e765a2688a245446bd6234ac72b",
  name: "listInventoriesFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listInventoriesFn.__executeServer(opts));
const listInventoriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  restaurant_id: stringType().uuid().optional()
}).parse(input)).handler(listInventoriesFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "bartender");
  if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: invs,
    error
  } = await sb.from("inventories").select("id,restaurant_id,status,created_at,created_by,correction_comment").eq("restaurant_id", ctx.user.restaurant_id).order("created_at", {
    ascending: false
  });
  if (error) throw new Error(error.message);
  return enrichInventoryRows(sb, invs ?? []);
});
const createInventoryFn_createServerFn_handler = createServerRpc({
  id: "06966c5b910e848ae37fa095345b22fa3bafabc28b34eedebe8ab1ff6761b2f2",
  name: "createInventoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => createInventoryFn.__executeServer(opts));
const createInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  restaurant_id: stringType().uuid().optional()
}).parse(input)).handler(createInventoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "bartender");
  if (!ctx.user.restaurant_id) throw new Error("У пользователя не указан ресторан");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: inv,
    error
  } = await sb.from("inventories").insert({
    restaurant_id: ctx.user.restaurant_id,
    created_by: ctx.user.id,
    status: "draft"
  }).select("id,restaurant_id,status,created_at,created_by,correction_comment").single();
  if (error) throw new Error(error.message);
  const {
    error: participantError
  } = await sb.from("inventory_participants").insert({
    inventory_id: inv.id,
    user_id: ctx.user.id
  });
  if (participantError) throw new Error(participantError.message);
  return inv;
});
const getInventoryFn_createServerFn_handler = createServerRpc({
  id: "ba086f8b7adf9a6f8fcca41533177ac5ff52297b6785cc9d4a76ecb451b61326",
  name: "getInventoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => getInventoryFn.__executeServer(opts));
const getInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(getInventoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "bartender");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const [{
    data: inv,
    error: e1
  }, {
    data: cats
  }, {
    data: prods
  }, {
    data: items
  }, {
    data: entryCounts
  }] = await Promise.all([sb.from("inventories").select("id,restaurant_id,status,created_at,created_by,correction_comment").eq("id", data.id).maybeSingle(), sb.from("categories").select("id,name").order("name"), sb.from("products").select("id,name,unit,category_id,status").order("name"), sb.from("inventory_items").select("inventory_id,product_id,quantity").eq("inventory_id", data.id), sb.from("inventory_item_entries").select("product_id").eq("inventory_id", data.id)]);
  if (e1) throw new Error(e1.message);
  if (!inv) throw new Error("Переучёт не найден");
  requireBartenderRestaurant(ctx, inv.restaurant_id);
  const countedProductIds = new Set((items ?? []).map((item) => item.product_id));
  const entryCountsByProduct = (entryCounts ?? []).reduce((acc, entry) => {
    acc[entry.product_id] = (acc[entry.product_id] ?? 0) + 1;
    return acc;
  }, {});
  return {
    inventory: inv,
    categories: cats ?? [],
    products: (prods ?? []).filter((product) => product.status === "approved" || countedProductIds.has(product.id)),
    items: items ?? [],
    entry_counts: Object.entries(entryCountsByProduct).map(([product_id, count]) => ({
      product_id,
      count
    })),
    discrepancies: []
  };
});
const getInventoryEntriesFn_createServerFn_handler = createServerRpc({
  id: "981f2468946cb7215ba7e483496aedaca4a20a91f74e45c795702aad848e8c70",
  name: "getInventoryEntriesFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => getInventoryEntriesFn.__executeServer(opts));
const getInventoryEntriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  product_id: stringType().uuid()
}).parse(input)).handler(getInventoryEntriesFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "bartender");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: inv,
    error: invError
  } = await sb.from("inventories").select("id,restaurant_id").eq("id", data.inventory_id).maybeSingle();
  if (invError) throw new Error(invError.message);
  if (!inv) throw new Error("Переучёт не найден");
  requireBartenderRestaurant(ctx, inv.restaurant_id);
  const {
    data: entries,
    error,
    count
  } = await sb.from("inventory_item_entries").select("id,product_id,user_id,quantity,entry_type,created_at", {
    count: "exact"
  }).eq("inventory_id", data.inventory_id).eq("product_id", data.product_id).order("created_at", {
    ascending: false
  }).limit(5);
  if (error) throw new Error(error.message);
  const userIds = Array.from(new Set((entries ?? []).map((entry) => entry.user_id).filter(Boolean)));
  let users = {};
  if (userIds.length) {
    const {
      data: rows,
      error: usersError
    } = await sb.from("users").select("id,name").in("id", userIds);
    if (usersError) throw new Error(usersError.message);
    users = Object.fromEntries((rows ?? []).map((user) => [user.id, user.name]));
  }
  return {
    entries: (entries ?? []).map((entry) => ({
      ...entry,
      quantity: Number(entry.quantity),
      user_name: entry.user_id ? users[entry.user_id] ?? null : null
    })),
    total: count ?? entries?.length ?? 0
  };
});
const upsertItemFn_createServerFn_handler = createServerRpc({
  id: "f5eb5399f13447825e98da7150ae3353e440165a4207a6fa89a6b79057a56482",
  name: "upsertItemFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => upsertItemFn.__executeServer(opts));
const upsertItemFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  product_id: stringType().uuid(),
  quantity: numberType().min(0).max(1e6),
  entry_type: inventoryEntryTypeSchema.default("set")
}).parse(input)).handler(upsertItemFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "bartender");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: inv,
    error: invError
  } = await sb.from("inventories").select("id,restaurant_id,status").eq("id", data.inventory_id).maybeSingle();
  if (invError) throw new Error(invError.message);
  if (!inv) throw new Error("Переучёт не найден");
  requireBartenderRestaurant(ctx, inv.restaurant_id);
  if (inv.status !== "draft" && inv.status !== "correction_required") {
    throw new Error("Закрытый переучёт нельзя редактировать");
  }
  const {
    data: currentItem,
    error: currentItemError
  } = await sb.from("inventory_items").select("quantity").eq("inventory_id", data.inventory_id).eq("product_id", data.product_id).maybeSingle();
  if (currentItemError) throw new Error(currentItemError.message);
  const currentQuantity = Number(currentItem?.quantity ?? 0);
  const nextQuantity = data.entry_type === "add" ? currentQuantity + data.quantity : data.quantity;
  const normalizedQuantity = Math.round(nextQuantity * 1e12) / 1e12;
  const {
    error
  } = await sb.from("inventory_items").upsert({
    inventory_id: data.inventory_id,
    product_id: data.product_id,
    quantity: normalizedQuantity
  }, {
    onConflict: "inventory_id,product_id"
  });
  if (error) throw new Error(error.message);
  const {
    error: entryError
  } = await sb.from("inventory_item_entries").insert({
    inventory_id: data.inventory_id,
    product_id: data.product_id,
    user_id: ctx.user.id,
    quantity: data.quantity,
    entry_type: data.entry_type
  });
  if (entryError) throw new Error(entryError.message);
  return {
    ok: true,
    quantity: normalizedQuantity
  };
});
const closeInventoryFn_createServerFn_handler = createServerRpc({
  id: "c182782f0a5b50a810a44c1985aebc44e77bd55a32358d9a2f42348a1f461526",
  name: "closeInventoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => closeInventoryFn.__executeServer(opts));
const closeInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(closeInventoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "bartender");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const [{
    data: inv,
    error: invError
  }, {
    data: participant
  }, {
    data: approvedProducts,
    error: productsError
  }, {
    data: existingItems,
    error: itemsError
  }] = await Promise.all([sb.from("inventories").select("id,restaurant_id,status").eq("id", data.id).maybeSingle(), sb.from("inventory_participants").select("inventory_id,user_id").eq("inventory_id", data.id).eq("user_id", ctx.user.id).maybeSingle(), sb.from("products").select("id").eq("status", "approved"), sb.from("inventory_items").select("product_id").eq("inventory_id", data.id)]);
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
  const missingRows = (approvedProducts ?? []).filter((product) => !existingProductIds.has(product.id)).map((product) => ({
    inventory_id: data.id,
    product_id: product.id,
    quantity: 0
  }));
  if (missingRows.length > 0) {
    const {
      error: insertMissingError
    } = await sb.from("inventory_items").insert(missingRows);
    if (insertMissingError) throw new Error(insertMissingError.message);
  }
  const {
    error
  } = await sb.from("inventories").update({
    status: "completed"
  }).eq("id", data.id);
  if (error) throw new Error(error.message);
  if (inv.status === "correction_required") {
    const {
      error: commentError
    } = await sb.from("inventories").update({
      correction_comment: null
    }).eq("id", data.id);
    if (commentError && !commentError.message.includes("correction_comment")) {
      throw new Error(commentError.message);
    }
  }
  return {
    ok: true
  };
});
const addDiscrepancyFn_createServerFn_handler = createServerRpc({
  id: "73435ff690c97b1613261c2bced090ad441a0df7586ccbcc1c1bb23b10030d12",
  name: "addDiscrepancyFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => addDiscrepancyFn.__executeServer(opts));
const addDiscrepancyFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  amount: numberType(),
  comment: stringType().min(1).max(500)
}).parse(input)).handler(addDiscrepancyFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    error
  } = await getBarstock().from("discrepancies").upsert({
    inventory_id: data.inventory_id,
    amount: data.amount,
    comment: data.comment
  }, {
    onConflict: "inventory_id"
  });
  if (error) throw new Error(error.message);
  return {
    ok: true
  };
});
const listClosedInventoriesFn_createServerFn_handler = createServerRpc({
  id: "eb469f7c88a1aefe33911af5821c8d55aba974c753495230a8ea69e50536cdb0",
  name: "listClosedInventoriesFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listClosedInventoriesFn.__executeServer(opts));
const listClosedInventoriesFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  restaurant_id: stringType().uuid().nullable().optional()
}).parse(input)).handler(listClosedInventoriesFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  let query = sb.from("inventories").select("id,restaurant_id,status,created_at,created_by,correction_comment").in("status", ["completed", "correction_required"]).order("created_at", {
    ascending: false
  });
  if (data.restaurant_id) query = query.eq("restaurant_id", data.restaurant_id);
  const {
    data: invs,
    error
  } = await query;
  if (error) throw new Error(error.message);
  return enrichInventoryRows(sb, invs ?? [], true);
});
const deleteInventoryFn_createServerFn_handler = createServerRpc({
  id: "881691b44cbd7c032ea63f2962d858bc7c03338509b29ee98744916b34e7dfe8",
  name: "deleteInventoryFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => deleteInventoryFn.__executeServer(opts));
const deleteInventoryFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(deleteInventoryFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: inv,
    error: invError
  } = await sb.from("inventories").select("id").eq("id", data.id).maybeSingle();
  if (invError) throw new Error(invError.message);
  if (!inv) throw new Error("Переучёт не найден");
  const childDeletes = await Promise.all([sb.from("inventory_items").delete().eq("inventory_id", data.id), sb.from("expected_items").delete().eq("inventory_id", data.id), sb.from("discrepancies").delete().eq("inventory_id", data.id), sb.from("inventory_participants").delete().eq("inventory_id", data.id)]);
  const childError = childDeletes.find((result) => result.error)?.error;
  if (childError) throw new Error(childError.message);
  const {
    error
  } = await sb.from("inventories").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return {
    ok: true
  };
});
const requestInventoryCorrectionFn_createServerFn_handler = createServerRpc({
  id: "2f6def3949bb8b39bc8e3f1fa1101cd5ad867fbc9ce2baefa99b743fb31284c7",
  name: "requestInventoryCorrectionFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => requestInventoryCorrectionFn.__executeServer(opts));
const requestInventoryCorrectionFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).extend({
  correction_comment: stringType().trim().min(1).max(1e3)
}).parse(input)).handler(requestInventoryCorrectionFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    data: inv,
    error: invError
  } = await sb.from("inventories").select("id,status").eq("id", data.id).maybeSingle();
  if (invError) throw new Error(invError.message);
  if (!inv) throw new Error("Переучёт не найден");
  if (inv.status === "draft") {
    throw new Error("Черновик уже доступен бармену для редактирования");
  }
  const {
    error
  } = await sb.from("inventories").update({
    status: "correction_required",
    correction_comment: data.correction_comment.trim()
  }).eq("id", data.id);
  if (error) throw new Error(error.message);
  return {
    ok: true
  };
});
const getInventoryReportFn_createServerFn_handler = createServerRpc({
  id: "19773996e586c53314eec0ac66f347406a103d10aedcfdcf4a6e046d964f1913",
  name: "getInventoryReportFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => getInventoryReportFn.__executeServer(opts));
const getInventoryReportFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(getInventoryReportFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    classifyDiscrepancy
  } = await import("./expectedStock-DKdbGQ3j.mjs");
  const sb = getBarstock();
  const [{
    data: inv,
    error: e1
  }, {
    data: restaurant
  }, {
    data: cats
  }, {
    data: prods
  }, {
    data: items
  }, {
    data: expected
  }, {
    data: discrepancy
  }] = await Promise.all([sb.from("inventories").select("id,restaurant_id,status,created_at,created_by,correction_comment").eq("id", data.id).maybeSingle(), sb.from("inventories").select("restaurants(id,name)").eq("id", data.id).maybeSingle(), sb.from("categories").select("id,name").order("name"), sb.from("products").select("id,name,unit,category_id,status,unit_price").order("name"), sb.from("inventory_items").select("product_id,quantity").eq("inventory_id", data.id), sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id), sb.from("discrepancies").select("comment").eq("inventory_id", data.id).maybeSingle()]);
  if (e1) throw new Error(e1.message);
  if (!inv) throw new Error("Переучёт не найден");
  const actualMap = /* @__PURE__ */ new Map();
  (items ?? []).forEach((it) => actualMap.set(it.product_id, Number(it.quantity)));
  const expectedMap = /* @__PURE__ */ new Map();
  (expected ?? []).forEach((it) => expectedMap.set(it.product_id, Number(it.quantity)));
  const rows = (prods ?? []).filter((p) => actualMap.has(p.id) || expectedMap.has(p.id)).map((p) => {
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
      comment: status === "match" ? "" : discrepancy?.comment ?? ""
    };
  });
  return {
    inventory: inv,
    restaurant: Array.isArray(restaurant?.restaurants) ? restaurant.restaurants[0] ?? null : restaurant?.restaurants ?? null,
    categories: cats ?? [],
    rows
  };
});
const getMonthlyArchiveFn_createServerFn_handler = createServerRpc({
  id: "e6e307219fdc6cb3d248148372f4dd315403b976e113b752e69978f77ab2a98c",
  name: "getMonthlyArchiveFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => getMonthlyArchiveFn.__executeServer(opts));
const getMonthlyArchiveFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  month: stringType().regex(/^\d{4}-\d{2}$/),
  restaurant_id: stringType().uuid().nullable().optional()
}).parse(input)).handler(getMonthlyArchiveFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const {
    classifyDiscrepancy
  } = await import("./expectedStock-DKdbGQ3j.mjs");
  const sb = getBarstock();
  const [year, month] = data.month.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  let inventoryQuery = sb.from("inventories").select("id,restaurant_id,status,created_at,created_by,correction_comment").in("status", ["completed", "correction_required"]).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at", {
    ascending: true
  });
  if (data.restaurant_id) inventoryQuery = inventoryQuery.eq("restaurant_id", data.restaurant_id);
  const {
    data: inventories,
    error: inventoriesError
  } = await inventoryQuery;
  if (inventoriesError) throw new Error(inventoriesError.message);
  const invs = inventories ?? [];
  const inventoryIds = invs.map((inventory) => inventory.id);
  const restaurantIds = Array.from(new Set(invs.map((inventory) => inventory.restaurant_id).filter(Boolean)));
  const [{
    data: restaurants,
    error: restaurantsError
  }, {
    data: categories,
    error: categoriesError
  }, {
    data: products,
    error: productsError
  }, {
    data: items,
    error: itemsError
  }, {
    data: expected,
    error: expectedError
  }] = await Promise.all([restaurantIds.length ? sb.from("restaurants").select("id,name").in("id", restaurantIds) : Promise.resolve({
    data: [],
    error: null
  }), sb.from("categories").select("id,name").order("name"), sb.from("products").select("id,name,unit,category_id,status,unit_price").order("name"), inventoryIds.length ? sb.from("inventory_items").select("inventory_id,product_id,quantity").in("inventory_id", inventoryIds) : Promise.resolve({
    data: [],
    error: null
  }), inventoryIds.length ? sb.from("expected_items").select("inventory_id,product_id,quantity").in("inventory_id", inventoryIds) : Promise.resolve({
    data: [],
    error: null
  })]);
  if (restaurantsError) throw new Error(restaurantsError.message);
  if (categoriesError) throw new Error(categoriesError.message);
  if (productsError) throw new Error(productsError.message);
  if (itemsError) throw new Error(itemsError.message);
  if (expectedError) throw new Error(expectedError.message);
  const restaurantById = new Map((restaurants ?? []).map((restaurant) => [restaurant.id, restaurant]));
  const productById = new Map((products ?? []).map((product) => [product.id, product]));
  const actualByInventory = /* @__PURE__ */ new Map();
  const expectedByInventory = /* @__PURE__ */ new Map();
  (items ?? []).forEach((item) => {
    const map = actualByInventory.get(item.inventory_id) ?? /* @__PURE__ */ new Map();
    map.set(item.product_id, Number(item.quantity));
    actualByInventory.set(item.inventory_id, map);
  });
  (expected ?? []).forEach((item) => {
    const map = expectedByInventory.get(item.inventory_id) ?? /* @__PURE__ */ new Map();
    map.set(item.product_id, Number(item.quantity));
    expectedByInventory.set(item.inventory_id, map);
  });
  return {
    month: data.month,
    categories: categories ?? [],
    inventories: invs.map((inventory) => {
      const actualMap = actualByInventory.get(inventory.id) ?? /* @__PURE__ */ new Map();
      const expectedMap = expectedByInventory.get(inventory.id) ?? /* @__PURE__ */ new Map();
      const productIds = Array.from(/* @__PURE__ */ new Set([...actualMap.keys(), ...expectedMap.keys()]));
      const rows = productIds.flatMap((productId) => {
        const product = productById.get(productId);
        if (!product) return [];
        const actual = actualMap.get(productId) ?? 0;
        const hasExpected = expectedMap.has(productId);
        const expectedQty = expectedMap.get(productId);
        const diff = actual - (expectedQty ?? 0);
        const unitPrice = Number(product.unit_price ?? 0);
        return [{
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
          status: classifyDiscrepancy(diff)
        }];
      });
      return {
        inventory,
        restaurant: restaurantById.get(inventory.restaurant_id) ?? null,
        rows
      };
    })
  };
});
const listExpectedFn_createServerFn_handler = createServerRpc({
  id: "33a6d8e0f3abd65538c3c8c7cf1a8661fe9aea2cbd655f74633c67696b86085a",
  name: "listExpectedFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => listExpectedFn.__executeServer(opts));
const listExpectedFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.merge(idSchema).parse(input)).handler(listExpectedFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const [{
    data: inv,
    error: e1
  }, {
    data: cats
  }, {
    data: prods
  }, {
    data: expected
  }] = await Promise.all([sb.from("inventories").select("id,restaurant_id,status,created_at,created_by,correction_comment").eq("id", data.id).maybeSingle(), sb.from("categories").select("id,name").order("name"), sb.from("products").select("id,name,unit,category_id,status").order("name"), sb.from("expected_items").select("product_id,quantity").eq("inventory_id", data.id)]);
  if (e1) throw new Error(e1.message);
  if (!inv) throw new Error("Переучёт не найден");
  return {
    inventory: inv,
    categories: cats ?? [],
    products: prods ?? [],
    expected: expected ?? []
  };
});
const upsertExpectedFn_createServerFn_handler = createServerRpc({
  id: "9bd4e14599148af33c8d0b51435bb2b13111fc07d77122e7f231c828ac398121",
  name: "upsertExpectedFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => upsertExpectedFn.__executeServer(opts));
const upsertExpectedFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  product_id: stringType().uuid(),
  quantity: numberType().min(0).max(1e6)
}).parse(input)).handler(upsertExpectedFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  const {
    error
  } = await sb.from("expected_items").upsert({
    inventory_id: data.inventory_id,
    product_id: data.product_id,
    quantity: data.quantity,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }, {
    onConflict: "inventory_id,product_id"
  });
  if (error) throw new Error(error.message);
  return {
    ok: true
  };
});
const bulkSetExpectedFn_createServerFn_handler = createServerRpc({
  id: "8ba55f84cbd660174f7e3602ee61d495fe4d776c96e73e6b9b3c5bfc569bddf8",
  name: "bulkSetExpectedFn",
  filename: "src/lib/barstock.functions.ts"
}, (opts) => bulkSetExpectedFn.__executeServer(opts));
const bulkSetExpectedFn = createServerFn({
  method: "POST"
}).inputValidator((input) => sessionSchema.extend({
  inventory_id: stringType().uuid(),
  items: arrayType(objectType({
    product_id: stringType().uuid(),
    quantity: numberType().min(0).max(1e6)
  })).min(1).max(5e3),
  replace: booleanType().optional()
}).parse(input)).handler(bulkSetExpectedFn_createServerFn_handler, async ({
  data
}) => {
  const ctx = await requireSession(data.session_token);
  requireRole(ctx, "accountant");
  const {
    getBarstock
  } = await import("./barstock.server-D2PMjSaP.mjs");
  const sb = getBarstock();
  if (data.replace) {
    const {
      error: delErr
    } = await sb.from("expected_items").delete().eq("inventory_id", data.inventory_id);
    if (delErr) throw new Error(delErr.message);
  }
  const rows = data.items.map((it) => ({
    inventory_id: data.inventory_id,
    product_id: it.product_id,
    quantity: it.quantity,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }));
  const {
    error
  } = await sb.from("expected_items").upsert(rows, {
    onConflict: "inventory_id,product_id"
  });
  if (error) throw new Error(error.message);
  return {
    ok: true,
    count: rows.length
  };
});
async function enrichInventoryRows(sb, invs, includeRestaurants = false) {
  const ids = invs.map((i) => i.id);
  const userIds = Array.from(new Set(invs.map((i) => i.created_by).filter(Boolean)));
  const restaurantIds = Array.from(new Set(invs.map((i) => i.restaurant_id).filter(Boolean)));
  let users = {};
  if (userIds.length) {
    const {
      data: us
    } = await sb.from("users").select("id,name").in("id", userIds);
    users = Object.fromEntries((us ?? []).map((u) => [u.id, u.name]));
  }
  let restaurants = {};
  if (includeRestaurants && restaurantIds.length) {
    const {
      data: rs
    } = await sb.from("restaurants").select("id,name").in("id", restaurantIds);
    restaurants = Object.fromEntries((rs ?? []).map((r) => [r.id, r.name]));
  }
  let counts = {};
  if (ids.length) {
    const {
      data: items
    } = await sb.from("inventory_items").select("inventory_id").in("inventory_id", ids);
    counts = (items ?? []).reduce((acc, it) => {
      acc[it.inventory_id] = (acc[it.inventory_id] ?? 0) + 1;
      return acc;
    }, {});
  }
  return invs.map((i) => ({
    ...i,
    created_by_name: i.created_by ? users[i.created_by] ?? null : null,
    restaurant_name: includeRestaurants ? restaurants[i.restaurant_id] ?? null : void 0,
    items_count: counts[i.id] ?? 0
  }));
}
export {
  addDiscrepancyFn_createServerFn_handler,
  archiveProductFn_createServerFn_handler,
  bulkSetExpectedFn_createServerFn_handler,
  closeInventoryFn_createServerFn_handler,
  createBartenderFn_createServerFn_handler,
  createCategoryFn_createServerFn_handler,
  createInventoryFn_createServerFn_handler,
  createProductFn_createServerFn_handler,
  createRestaurantFn_createServerFn_handler,
  currentSessionFn_createServerFn_handler,
  deleteBartenderFn_createServerFn_handler,
  deleteCategoryFn_createServerFn_handler,
  deleteInventoryFn_createServerFn_handler,
  deleteProductFn_createServerFn_handler,
  deleteRestaurantFn_createServerFn_handler,
  getInventoryEntriesFn_createServerFn_handler,
  getInventoryFn_createServerFn_handler,
  getInventoryReportFn_createServerFn_handler,
  getMonthlyArchiveFn_createServerFn_handler,
  listBartendersFn_createServerFn_handler,
  listCategoriesFn_createServerFn_handler,
  listClosedInventoriesFn_createServerFn_handler,
  listExpectedFn_createServerFn_handler,
  listInventoriesFn_createServerFn_handler,
  listProductsFn_createServerFn_handler,
  listRestaurantsFn_createServerFn_handler,
  loginFn_createServerFn_handler,
  requestInventoryCorrectionFn_createServerFn_handler,
  updateBartenderRestaurantFn_createServerFn_handler,
  updateCategoryFn_createServerFn_handler,
  updateProductFn_createServerFn_handler,
  upsertExpectedFn_createServerFn_handler,
  upsertItemFn_createServerFn_handler
};
