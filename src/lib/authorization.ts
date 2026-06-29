export const PERMISSIONS = {
  INVENTORIES_VIEW: "inventories.view",
  INVENTORIES_CREATE: "inventories.create",
  INVENTORIES_EDIT: "inventories.edit",
  INVENTORIES_CLOSE: "inventories.close",
  INVENTORIES_REOPEN: "inventories.reopen",
  INVENTORIES_DELETE: "inventories.delete",
  REPORTS_VIEW: "reports.view",
  REPORTS_LIST: "reports.list",
  REPORTS_VIEW_IN_PROGRESS: "reports.view_in_progress",
  REPORTS_EDIT_ACCOUNTING: "reports.edit_accounting",
  REPORTS_EXPORT: "reports.export",
  STATISTICS_VIEW: "statistics.view",
  WRITE_OFFS_VIEW: "write_offs.view",
  WRITE_OFFS_CREATE: "write_offs.create",
  WRITE_OFFS_EXPORT: "write_offs.export",
  TRANSFERS_VIEW: "transfers.view",
  TRANSFERS_CREATE: "transfers.create",
  TRANSFERS_CONFIRM: "transfers.confirm",
  TRANSFERS_CANCEL: "transfers.cancel",
  ANNOUNCEMENTS_VIEW: "announcements.view",
  ANNOUNCEMENTS_CREATE: "announcements.create",
  ANNOUNCEMENTS_DEACTIVATE: "announcements.deactivate",
  STAFF_VIEW: "staff.view",
  STAFF_DIRECTORY: "staff.directory",
  STAFF_CREATE: "staff.create",
  STAFF_EDIT: "staff.edit",
  STAFF_DELETE: "staff.delete",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_MANAGE: "products.manage",
  CATEGORIES_VIEW: "categories.view",
  CATEGORIES_MANAGE: "categories.manage",
  RESTAURANTS_VIEW: "restaurants.view",
  RESTAURANTS_MANAGE: "restaurants.manage",
  NETWORKS_VIEW: "networks.view",
  NETWORKS_MANAGE: "networks.manage",
  LOGIN_HISTORY_VIEW: "login_history.view",
  ROLES_VIEW: "roles.view",
  ROLES_ASSIGN: "roles.assign",
  ADMIN_ACCESS: "admin.access",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
const PERMISSION_KEYS = new Set<string>(Object.values(PERMISSIONS));
export type NetworkScope = "own" | "all";
export type RestaurantScope = "own" | "network" | "assigned_or_network";
export type AreaScope = "bar" | "kitchen" | "all";

export type AuthorizationContext = {
  userId: string;
  roleKey: string;
  networkId: string | null;
  restaurantId: string | null;
  permissions: Set<PermissionKey>;
  scope: {
    network: NetworkScope;
    restaurant: RestaurantScope;
    area: AreaScope;
  };
};

export type SerializableAuthorization = {
  permissions: PermissionKey[];
  scope: AuthorizationContext["scope"];
};

export function hasPermission(
  context: Pick<AuthorizationContext, "permissions">,
  permission: PermissionKey,
) {
  return context.permissions.has(permission);
}

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEYS.has(value);
}

export function hasSerializedPermission(
  authorization: Partial<SerializableAuthorization> | null | undefined,
  permission: PermissionKey,
) {
  return authorization?.permissions?.includes(permission) ?? false;
}

export function getDefaultPath(authorization: Partial<SerializableAuthorization>) {
  if (hasSerializedPermission(authorization, PERMISSIONS.NETWORKS_MANAGE)) return "/admin" as const;
  if (hasSerializedPermission(authorization, PERMISSIONS.INVENTORIES_VIEW)) {
    return "/inventories" as const;
  }
  if (hasSerializedPermission(authorization, PERMISSIONS.REPORTS_EDIT_ACCOUNTING)) {
    return "/reports" as const;
  }
  if (hasSerializedPermission(authorization, PERMISSIONS.STATISTICS_VIEW)) {
    return "/manager" as const;
  }
  if (hasSerializedPermission(authorization, PERMISSIONS.REPORTS_VIEW)) return "/reports" as const;
  if (hasSerializedPermission(authorization, PERMISSIONS.WRITE_OFFS_VIEW)) {
    return "/write-offs" as const;
  }
  if (hasSerializedPermission(authorization, PERMISSIONS.TRANSFERS_VIEW)) {
    return "/transfers" as const;
  }
  return "/messages" as const;
}

export function requirePermission(context: AuthorizationContext, permission: PermissionKey) {
  if (!hasPermission(context, permission)) throw new Error("Недостаточно прав");
}

export function canAccessNetwork(context: AuthorizationContext, networkId: string | null) {
  if (context.scope.network === "all") return true;
  return Boolean(networkId && context.networkId && networkId === context.networkId);
}

export function canAccessRestaurant(
  context: AuthorizationContext,
  restaurantId: string | null,
  restaurantNetworkId: string | null,
) {
  if (!canAccessNetwork(context, restaurantNetworkId)) return false;
  if (context.scope.network === "all") return true;
  if (context.scope.restaurant === "network") return true;
  if (context.scope.restaurant === "own") {
    return Boolean(restaurantId && context.restaurantId === restaurantId);
  }
  if (context.restaurantId) return context.restaurantId === restaurantId;
  return true;
}

export function canAccessArea(context: AuthorizationContext, area: string | null) {
  if (context.scope.area === "all") return true;
  return area === context.scope.area;
}

export function assertNetworkAccess(context: AuthorizationContext, networkId: string | null) {
  if (!canAccessNetwork(context, networkId)) {
    throw new Error("Доступ к другой сети запрещён");
  }
}

export function assertRestaurantAccess(
  context: AuthorizationContext,
  restaurantId: string | null,
  restaurantNetworkId: string | null,
) {
  if (!canAccessRestaurant(context, restaurantId, restaurantNetworkId)) {
    throw new Error("Доступ к другому ресторану запрещён");
  }
}

export function assertAreaAccess(context: AuthorizationContext, area: string | null) {
  if (!canAccessArea(context, area)) throw new Error("Доступ к другой зоне запрещён");
}

export function getEffectiveRestaurantId(context: AuthorizationContext) {
  if (context.scope.restaurant === "own") return context.restaurantId;
  if (context.scope.restaurant === "assigned_or_network") return context.restaurantId;
  return null;
}

export function getAllowedArea(context: AuthorizationContext): "bar" | "kitchen" | null {
  return context.scope.area === "all" ? null : context.scope.area;
}

export function serializeAuthorization(context: AuthorizationContext): SerializableAuthorization {
  return {
    permissions: Array.from(context.permissions),
    scope: context.scope,
  };
}

export function authorizationFromSession(session: SerializableAuthorization): AuthorizationContext {
  return {
    userId: "",
    roleKey: "",
    networkId: null,
    restaurantId: null,
    permissions: new Set(session.permissions),
    scope: session.scope,
  };
}
