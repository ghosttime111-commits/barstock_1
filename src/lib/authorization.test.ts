import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSIONS,
  assertAreaAccess,
  assertNetworkAccess,
  assertRestaurantAccess,
  canAccessArea,
  canAccessNetwork,
  canAccessRestaurant,
  hasPermission,
  requirePermission,
  type AreaScope,
  type AuthorizationContext,
  type PermissionKey,
  type RestaurantScope,
} from "./authorization.ts";

function context(input: {
  permissions?: PermissionKey[];
  network?: "own" | "all";
  restaurant?: RestaurantScope;
  area?: AreaScope;
  networkId?: string | null;
  restaurantId?: string | null;
}): AuthorizationContext {
  return {
    userId: "user-1",
    roleKey: "test",
    networkId: input.networkId === undefined ? "network-a" : input.networkId,
    restaurantId: input.restaurantId === undefined ? "restaurant-a" : input.restaurantId,
    permissions: new Set(input.permissions ?? []),
    scope: {
      network: input.network ?? "own",
      restaurant: input.restaurant ?? "own",
      area: input.area ?? "bar",
    },
  };
}

test("bartender permission does not bypass network, restaurant, or area scope", () => {
  const auth = context({
    permissions: [
      PERMISSIONS.INVENTORIES_VIEW,
      PERMISSIONS.INVENTORIES_CREATE,
      PERMISSIONS.INVENTORIES_EDIT,
    ],
  });
  assert.equal(hasPermission(auth, PERMISSIONS.INVENTORIES_CREATE), true);
  assert.equal(hasPermission(auth, PERMISSIONS.REPORTS_EDIT_ACCOUNTING), false);
  assert.equal(canAccessNetwork(auth, "network-b"), false);
  assert.equal(canAccessRestaurant(auth, "restaurant-b", "network-a"), false);
  assert.equal(canAccessArea(auth, "kitchen"), false);
});

test("kitchen operational scope accepts only own kitchen data", () => {
  const auth = context({
    permissions: [PERMISSIONS.INVENTORIES_CREATE, PERMISSIONS.TRANSFERS_CREATE],
    area: "kitchen",
  });
  assert.equal(canAccessArea(auth, "kitchen"), true);
  assert.equal(canAccessArea(auth, "bar"), false);
  assert.equal(canAccessRestaurant(auth, "restaurant-a", "network-a"), true);
  assert.equal(canAccessRestaurant(auth, "restaurant-b", "network-a"), false);
});

test("accountant sees own network and both areas but not another network", () => {
  const auth = context({
    permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EDIT_ACCOUNTING],
    restaurant: "network",
    area: "all",
    restaurantId: null,
  });
  assert.equal(canAccessRestaurant(auth, "restaurant-b", "network-a"), true);
  assert.equal(canAccessArea(auth, "bar"), true);
  assert.equal(canAccessArea(auth, "kitchen"), true);
  assert.equal(canAccessNetwork(auth, "network-b"), false);
});

test("assigned_or_network manager is restricted only when assigned", () => {
  const assigned = context({
    permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.REPORTS_VIEW],
    restaurant: "assigned_or_network",
    area: "all",
  });
  const networkWide = context({
    permissions: [PERMISSIONS.STATISTICS_VIEW, PERMISSIONS.REPORTS_VIEW],
    restaurant: "assigned_or_network",
    area: "all",
    restaurantId: null,
  });
  assert.equal(canAccessRestaurant(assigned, "restaurant-b", "network-a"), false);
  assert.equal(canAccessRestaurant(networkWide, "restaurant-b", "network-a"), true);
  assert.equal(hasPermission(assigned, PERMISSIONS.REPORTS_EDIT_ACCOUNTING), false);
});

test("area managers remain read-only and area-limited", () => {
  const bar = context({
    permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.ANNOUNCEMENTS_CREATE],
    restaurant: "network",
    area: "bar",
    restaurantId: null,
  });
  const kitchen = context({
    permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.ANNOUNCEMENTS_CREATE],
    restaurant: "network",
    area: "kitchen",
    restaurantId: null,
  });
  assert.equal(canAccessArea(bar, "kitchen"), false);
  assert.equal(canAccessArea(kitchen, "bar"), false);
  assert.equal(hasPermission(bar, PERMISSIONS.TRANSFERS_CREATE), false);
  assert.equal(hasPermission(kitchen, PERMISSIONS.REPORTS_EDIT_ACCOUNTING), false);
});

test("super admin has all-network scope", () => {
  const auth = context({
    permissions: Object.values(PERMISSIONS),
    network: "all",
    restaurant: "network",
    area: "all",
    networkId: null,
    restaurantId: null,
  });
  assert.equal(canAccessNetwork(auth, "network-b"), true);
  assert.equal(canAccessRestaurant(auth, "restaurant-z", "network-b"), true);
  requirePermission(auth, PERMISSIONS.ROLES_ASSIGN);
});

test("assertions reject mismatched scope even when permission exists", () => {
  const auth = context({
    permissions: [PERMISSIONS.REPORTS_VIEW],
  });
  requirePermission(auth, PERMISSIONS.REPORTS_VIEW);
  assert.throws(() => assertNetworkAccess(auth, "network-b"), /другой сети/i);
  assert.throws(
    () => assertRestaurantAccess(auth, "restaurant-b", "network-a"),
    /другому ресторану/i,
  );
  assert.throws(() => assertAreaAccess(auth, "kitchen"), /другой зоне/i);
});
