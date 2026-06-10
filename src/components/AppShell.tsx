import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Wine } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { setSession, useSession } from "@/lib/session";

export type AllowedRole = "bartender" | "accountant";

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

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (allow && !allow.includes(session.user.role as AllowedRole)) {
      const home = session.user.role === "accountant" ? "/reports" : "/inventories";
      navigate({ to: home, replace: true });
    }
  }, [ready, session, allow, navigate]);

  if (!ready || !session || (allow && !allow.includes(session.user.role as AllowedRole))) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  const isAccountant = session.user.role === "accountant";
  const homePath = isAccountant ? "/reports" : "/inventories";

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
            <span className="text-muted-foreground">
              {session.user.name} · {isAccountant ? "бухгалтер" : "бармен"}
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
