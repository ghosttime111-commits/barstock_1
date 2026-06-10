import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

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
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    const home = session.user.role === "accountant" ? "/reports" : "/inventories";
    navigate({ to: home, replace: true });
  }, [ready, session, navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <p>Загрузка…</p>
    </div>
  );
}
