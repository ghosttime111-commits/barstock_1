import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { currentSessionFn } from "@/lib/barstock.functions";
import { setSession, useSession } from "@/lib/session";

export type AllowedRole =
  | "bartender"
  | "accountant"
  | "kitchen_manager"
  | "manager"
  | "super_admin";

type NavigationPath = "/inventories" | "/reports" | "/write-offs" | "/admin" | "/manager";
type NavigationItem = { label: string; to: NavigationPath; icon: LucideIcon };

const inventoriesItem: NavigationItem = {
  label: "Переучёты",
  to: "/inventories",
  icon: ClipboardCheck,
};
const reportsItem: NavigationItem = { label: "Отчёты", to: "/reports", icon: ClipboardList };
const writeOffsItem: NavigationItem = {
  label: "Списания",
  to: "/write-offs",
  icon: ReceiptText,
};
const adminItem: NavigationItem = { label: "Управление", to: "/admin", icon: Settings };
const managerItem: NavigationItem = { label: "Статистика", to: "/manager", icon: BarChart3 };

const navigationByRole: Record<AllowedRole, NavigationItem[]> = {
  bartender: [inventoriesItem, writeOffsItem],
  kitchen_manager: [inventoriesItem, writeOffsItem],
  accountant: [reportsItem, writeOffsItem, adminItem, managerItem],
  manager: [managerItem],
  super_admin: [adminItem, reportsItem, writeOffsItem, managerItem],
};

function homePathForRole(role: string) {
  if (role === "super_admin") return "/admin" as const;
  if (role === "accountant") return "/reports" as const;
  if (role === "manager") return "/manager" as const;
  return "/inventories" as const;
}

function roleLabel(role: string) {
  if (role === "super_admin") return "Администратор системы";
  if (role === "accountant") return "Бухгалтер";
  if (role === "manager") return "Управляющий";
  if (role === "kitchen_manager") return "Заведующий производством";
  return "Бармен";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session, ready } = useSession();
  const currentSession = useServerFn(currentSessionFn);
  const sessionToken = session?.session_token ?? null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const role = session.user.role as AllowedRole;
  const navigation = navigationByRole[role] ?? [];
  const homePath = homePathForRole(role);

  function logout() {
    setMobileMenuOpen(false);
    setSession(null);
    navigate({ to: "/login", replace: true });
  }

  const sidebarContent = (
    <SidebarContent
      homePath={homePath}
      navigation={navigation}
      pathname={pathname}
      userName={session.user.name}
      role={roleLabel(role)}
      restaurantName={session.restaurant?.name ?? null}
      onNavigate={() => setMobileMenuOpen(false)}
      onLogout={logout}
    />
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        {sidebarContent}
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/70 bg-background/95 px-4 backdrop-blur md:hidden">
        <Link to={homePath} className="flex min-w-0 items-center gap-2 font-semibold">
          <Wine className="size-5 shrink-0 text-primary" />
          <span>BarStock</span>
          {session.restaurant && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {session.restaurant.name}
            </span>
          )}
        </Link>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Открыть меню">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[82vw] max-w-[18rem] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Навигация BarStock</SheetTitle>
              <SheetDescription>Доступные разделы приложения</SheetDescription>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </header>

      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  homePath,
  navigation,
  pathname,
  userName,
  role,
  restaurantName,
  onNavigate,
  onLogout,
}: {
  homePath: NavigationPath;
  navigation: NavigationItem[];
  pathname: string;
  userName: string;
  role: string;
  restaurantName: string | null;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pb-5 pt-5">
        <Link
          to={homePath}
          onClick={onNavigate}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Wine className="size-5" />
          </span>
          <span>BarStock</span>
        </Link>
        {restaurantName && (
          <p className="mt-2 truncate pl-11 text-xs text-muted-foreground">{restaurantName}</p>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Основная навигация">
        {navigation.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Icon className="size-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border/70 p-3">
        <div className="min-w-0 px-2 pb-3 pt-1">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{role}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
          <LogOut className="size-4" />
          Выйти
        </Button>
      </div>
    </div>
  );
}
