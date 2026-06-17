import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, LogOut, Wine } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { currentSessionFn } from "@/lib/barstock.functions";
import { setSession, useSession } from "@/lib/session";

export type AllowedRole = "bartender" | "accountant" | "kitchen_manager" | "manager";

function homePathForRole(role: string) {
  if (role === "accountant") return "/reports" as const;
  if (role === "manager") return "/manager" as const;
  return "/inventories" as const;
}

export function AppShell({
  children,
  allow,
}: {
  children: ReactNode;
  /** Если задано — пускаем только указанные роли, иначе редирект на дефолтную страницу роли. */
  allow?: AllowedRole[];
}) {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const currentSession = useServerFn(currentSessionFn);
  const sessionToken = session?.session_token ?? null;

  const { data: freshSession } = useQuery({
    queryKey: ["current-session", sessionToken],
    queryFn: () => currentSession({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (allow && !allow.includes(session.user.role as AllowedRole)) {
      navigate({ to: homePathForRole(session.user.role), replace: true });
    }
  }, [ready, session, allow, navigate]);

  useEffect(() => {
    if (!session || !freshSession) return;
    const changed =
      session.user.restaurant_id !== freshSession.user.restaurant_id ||
      session.restaurant?.id !== freshSession.restaurant?.id ||
      session.restaurant?.name !== freshSession.restaurant?.name ||
      session.user.name !== freshSession.user.name ||
      session.user.role !== freshSession.user.role;
    if (changed) setSession(freshSession);
  }, [freshSession, session]);

  if (!ready || !session || (allow && !allow.includes(session.user.role as AllowedRole))) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  const isAccountant = session.user.role === "accountant";
  const canViewStats = isAccountant || session.user.role === "manager";
  const homePath = homePathForRole(session.user.role);
  const roleLabel =
    session.user.role === "accountant"
      ? "Бухгалтер"
      : session.user.role === "manager"
        ? "Управляющий"
        : session.user.role === "kitchen_manager"
          ? "Заведующий производством"
          : "Бармен";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to={homePath} className="flex items-center gap-2 font-semibold tracking-tight">
            <Wine className="size-5 text-primary" />
            <span>BarStock</span>
            {session.restaurant && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {session.restaurant.name}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {canViewStats && (
              <Link
                to="/manager"
                className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-foreground"
              >
                <BarChart3 className="size-4" /> Статистика
              </Link>
            )}
            {isAccountant && (
              <Link
                to="/admin"
                className="font-medium text-muted-foreground transition hover:text-foreground"
              >
                Управление
              </Link>
            )}
            <span className="text-muted-foreground">
              {session.user.name} - {roleLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSession(null);
                navigate({ to: "/login", replace: true });
              }}
            >
              <LogOut className="size-4" /> Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
