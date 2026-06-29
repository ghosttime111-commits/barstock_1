import { useEffect, useState } from "react";

import type { PermissionKey, SerializableAuthorization } from "./authorization";

export type BarstockRole =
  | "bartender"
  | "kitchen_manager"
  | "accountant"
  | "manager"
  | "bar_manager"
  | "kitchen_area_manager"
  | "super_admin";

export type BarstockSession = {
  user: {
    id: string;
    name: string;
    login: string;
    role: BarstockRole;
    restaurant_id: string | null;
    network_id: string | null;
  };
  network: { id: string; name: string; is_active?: boolean } | null;
  restaurant: { id: string; name: string } | null;
  permissions: PermissionKey[];
  scope: SerializableAuthorization["scope"];
  session_token: string;
};

const KEY = "barstock.session.v1";

function clearStoredSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getSession(): BarstockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.session_token !== "string" ||
      parsed.session_token.length === 0 ||
      !isRecord(parsed.user) ||
      typeof parsed.user.id !== "string" ||
      parsed.user.id.length === 0 ||
      typeof parsed.user.role !== "string" ||
      parsed.user.role.length === 0
    ) {
      clearStoredSession();
      return null;
    }
    return parsed as BarstockSession;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function setSession(s: BarstockSession | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("barstock:session"));
}

export function useSession() {
  const [s, setS] = useState<BarstockSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setS(getSession());
    setReady(true);
    const h = () => setS(getSession());
    window.addEventListener("barstock:session", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("barstock:session", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return { session: s, ready };
}

export type SessionRecoveryResult =
  | { status: "loading" }
  | { status: "refreshing" }
  | { status: "login" }
  | { status: "authenticated"; session: BarstockSession };

export function resolveSessionRecovery({
  ready,
  session,
  refreshedSession,
  refreshPending,
  refreshError,
}: {
  ready: boolean;
  session: BarstockSession | null;
  refreshedSession?: BarstockSession;
  refreshPending: boolean;
  refreshError: unknown;
}): SessionRecoveryResult {
  if (!ready) return { status: "loading" };
  if (!session) return { status: "login" };
  if (Array.isArray(session.permissions)) {
    return { status: "authenticated", session };
  }
  if (refreshedSession && Array.isArray(refreshedSession.permissions)) {
    return { status: "authenticated", session: refreshedSession };
  }
  if (refreshError) return { status: "login" };
  if (refreshPending) return { status: "refreshing" };
  return { status: "refreshing" };
}
