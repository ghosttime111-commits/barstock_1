import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { getDefaultPath } from "@/lib/authorization";
import { currentSessionFn } from "@/lib/barstock.functions";
import { resolveSessionRecovery, setSession, useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BarStock — Переучёт бара" },
      { name: "description", content: "BarStock: быстрый переучёт остатков в баре." },
      { property: "og:title", content: "BarStock" },
      { property: "og:description", content: "Переучёт бара без боли." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const currentSession = useServerFn(currentSessionFn);
  const navigationStarted = useRef(false);
  const {
    data: refreshedSession,
    isError,
    error,
    isPending,
  } = useQuery({
    queryKey: ["index-session-refresh", session?.session_token],
    queryFn: () => currentSession({ data: { session_token: session!.session_token } }),
    enabled: Boolean(session && !Array.isArray(session.permissions)),
    retry: false,
  });
  useEffect(() => {
    if (navigationStarted.current) return;
    const recovery = resolveSessionRecovery({
      ready,
      session,
      refreshedSession,
      refreshPending: isPending,
      refreshError: isError ? error : null,
    });
    if (recovery.status === "login") {
      navigationStarted.current = true;
      setSession(null);
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (recovery.status === "authenticated") {
      navigationStarted.current = true;
      if (recovery.session !== session) setSession(recovery.session);
      void navigate({ to: getDefaultPath(recovery.session), replace: true });
    }
  }, [ready, session, refreshedSession, isError, error, isPending, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <p>Загрузка…</p>
    </div>
  );
}
