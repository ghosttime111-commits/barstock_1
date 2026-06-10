import { useEffect, useState } from "react";

export type BarstockSession = {
  user: { id: string; name: string; login: string; role: string; restaurant_id: string | null };
  restaurant: { id: string; name: string } | null;
  session_token: string;
};

const KEY = "barstock.session.v1";

export function getSession(): BarstockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BarstockSession;
    return parsed.session_token ? parsed : null;
  } catch {
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
