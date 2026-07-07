import assert from "node:assert/strict";
import test from "node:test";

import type { PermissionKey } from "./authorization.ts";
import {
  getSession,
  resolveLoginSessionCheck,
  resolveSessionRecovery,
  type BarstockSession,
} from "./session.ts";

const STORAGE_KEY = "barstock.session.v1";

function createSession({ permissions = [] }: { permissions?: PermissionKey[] } = {}) {
  return {
    user: {
      id: "user-1",
      name: "Test User",
      login: "test",
      role: "bartender",
      restaurant_id: "restaurant-1",
      network_id: "network-1",
    },
    network: { id: "network-1", name: "Test Network" },
    restaurant: { id: "restaurant-1", name: "Test Restaurant" },
    permissions,
    scope: { network: "own", restaurant: "own", area: "bar" },
    session_token: "valid-token",
  } satisfies BarstockSession;
}

function createLegacySession() {
  const { permissions: _permissions, ...legacySession } = createSession();
  return legacySession as BarstockSession;
}

function recovery(overrides: Partial<Parameters<typeof resolveSessionRecovery>[0]> = {}) {
  return resolveSessionRecovery({
    ready: true,
    session: null,
    refreshedSession: undefined,
    refreshPending: false,
    refreshError: null,
    ...overrides,
  });
}

test("missing session resolves to login", () => {
  assert.deepEqual(recovery(), { status: "login" });
});

test("new session with permissions resolves to an accessible section", () => {
  const session = createSession({ permissions: ["inventories.view"] });
  assert.deepEqual(recovery({ session }), { status: "authenticated", session });
});

test("valid legacy session is replaced by the refreshed server session", () => {
  const refreshedSession = createSession({ permissions: ["inventories.view"] });
  assert.deepEqual(recovery({ session: createLegacySession(), refreshedSession }), {
    status: "authenticated",
    session: refreshedSession,
  });
});

test("invalid legacy session resolves to login after refresh failure", () => {
  assert.deepEqual(
    recovery({
      session: createLegacySession(),
      refreshError: new Error("invalid session"),
    }),
    { status: "login" },
  );
});

test("expired token resolves to login after server rejection", () => {
  assert.deepEqual(
    recovery({
      session: createLegacySession(),
      refreshError: new Error("expired token"),
    }),
    { status: "login" },
  );
});

test("corrupted localStorage JSON is removed and returns no session", () => {
  const values = new Map<string, string>([[STORAGE_KEY, "{broken-json"]]);
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });
  try {
    assert.equal(getSession(), null);
    assert.equal(values.has(STORAGE_KEY), false);
  } finally {
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  }
});

test("RBAC refresh error cannot remain in the loading state", () => {
  const result = recovery({
    session: createLegacySession(),
    refreshPending: false,
    refreshError: new Error("permissions unavailable"),
  });
  assert.equal(result.status, "login");
});

function loginCheck(overrides: Partial<Parameters<typeof resolveLoginSessionCheck>[0]> = {}) {
  return resolveLoginSessionCheck({
    ready: true,
    session: null,
    checkedSession: undefined,
    checkPending: false,
    checkError: null,
    ...overrides,
  });
}

test("login route shows the form when local session is missing", () => {
  assert.deepEqual(loginCheck(), { status: "form" });
});

test("login route checks and accepts a valid stored session", () => {
  const session = createSession({ permissions: ["inventories.view"] });
  const refreshed = createSession({ permissions: ["inventories.view", "write_offs.view"] });
  assert.deepEqual(loginCheck({ session, checkedSession: refreshed }), {
    status: "authenticated",
    session: refreshed,
  });
});

test("login route clears expired or invalid stored sessions", () => {
  assert.deepEqual(
    loginCheck({
      session: createSession({ permissions: ["inventories.view"] }),
      checkError: new Error("expired token"),
    }),
    { status: "clear" },
  );
});

test("login route refreshes a legacy session without redirecting to the public home page", () => {
  const refreshed = createSession({ permissions: ["inventories.view"] });
  assert.deepEqual(loginCheck({ session: createLegacySession(), checkedSession: refreshed }), {
    status: "authenticated",
    session: refreshed,
  });
});

test("login route clears a legacy session when server refresh fails", () => {
  assert.deepEqual(
    loginCheck({
      session: createLegacySession(),
      checkError: new Error("invalid legacy session"),
    }),
    { status: "clear" },
  );
});
