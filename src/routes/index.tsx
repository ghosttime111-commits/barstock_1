import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getDefaultPath } from "@/lib/authorization";
import { currentSessionFn } from "@/lib/barstock.functions";
import { setSession, useSession } from "@/lib/session";

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
  const { data: refreshedSession } = useQuery({
    queryKey: ["index-session-refresh", session?.session_token],
    queryFn: () => currentSession({ data: { session_token: session!.session_token } }),
    enabled: Boolean(session && !Array.isArray(session.permissions)),
  });
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (!Array.isArray(session.permissions)) {
      if (refreshedSession) setSession(refreshedSession);
      return;
    }
    navigate({ to: getDefaultPath(session), replace: true });
  }, [ready, session, refreshedSession, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <p>Загрузка…</p>
    </div>
  );
}
