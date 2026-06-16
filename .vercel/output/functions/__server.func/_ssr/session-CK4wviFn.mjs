import { r as reactExports } from "../_libs/react.mjs";
const KEY = "barstock.session.v1";
function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.session_token ? parsed : null;
  } catch {
    return null;
  }
}
function setSession(s) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("barstock:session"));
}
function useSession() {
  const [s, setS] = reactExports.useState(null);
  const [ready, setReady] = reactExports.useState(false);
  reactExports.useEffect(() => {
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
export {
  setSession as s,
  useSession as u
};
