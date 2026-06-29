import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  LogOut,
  Menu,
  MessageSquareText,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { currentSessionFn, listAnnouncementsFn } from "@/lib/barstock.functions";
import {
  PERMISSIONS,
  getDefaultPath,
  hasSerializedPermission,
  type PermissionKey,
} from "@/lib/authorization";
import { setSession, useSession } from "@/lib/session";

export type AllowedRole =
  | "bartender"
  | "accountant"
  | "kitchen_manager"
  | "manager"
  | "bar_manager"
  | "kitchen_area_manager"
  | "super_admin";

type NavigationPath =
  | "/inventories"
  | "/reports"
  | "/write-offs"
  | "/transfers"
  | "/messages"
  | "/staff"
  | "/admin"
  | "/manager"
  | "/security";
type NavigationItem = {
  label: string;
  to: NavigationPath;
  icon: LucideIcon;
  permission: PermissionKey;
};

const inventoriesItem: NavigationItem = {
  label: "Переучёты",
  to: "/inventories",
  icon: ClipboardCheck,
  permission: PERMISSIONS.INVENTORIES_VIEW,
};
const reportsItem: NavigationItem = {
  label: "Отчёты",
  to: "/reports",
  icon: ClipboardList,
  permission: PERMISSIONS.REPORTS_LIST,
};
const writeOffsItem: NavigationItem = {
  label: "Списания",
  to: "/write-offs",
  icon: ReceiptText,
  permission: PERMISSIONS.WRITE_OFFS_VIEW,
};
const transfersItem: NavigationItem = {
  label: "Перемещения",
  to: "/transfers",
  icon: ArrowRightLeft,
  permission: PERMISSIONS.TRANSFERS_VIEW,
};
const messagesItem: NavigationItem = {
  label: "Сообщения персоналу",
  to: "/messages",
  icon: MessageSquareText,
  permission: PERMISSIONS.ANNOUNCEMENTS_VIEW,
};
const staffItem: NavigationItem = {
  label: "Сотрудники",
  to: "/staff",
  icon: Users,
  permission: PERMISSIONS.STAFF_DIRECTORY,
};
const adminItem: NavigationItem = {
  label: "Управление",
  to: "/admin",
  icon: Settings,
  permission: PERMISSIONS.ADMIN_ACCESS,
};
const managerItem: NavigationItem = {
  label: "Статистика",
  to: "/manager",
  icon: BarChart3,
  permission: PERMISSIONS.STATISTICS_VIEW,
};
const securityItem: NavigationItem = {
  label: "Журнал входов",
  to: "/security",
  icon: ShieldCheck,
  permission: PERMISSIONS.LOGIN_HISTORY_VIEW,
};

const navigationItems = [
  inventoriesItem,
  reportsItem,
  writeOffsItem,
  transfersItem,
  adminItem,
  managerItem,
  staffItem,
  messagesItem,
  securityItem,
];

function homePathForSession(session: { permissions?: PermissionKey[] }): NavigationPath {
  return getDefaultPath(session);
}

function roleLabel(role: string) {
  if (role === "super_admin") return "Администратор системы";
  if (role === "accountant") return "Бухгалтер";
  if (role === "manager") return "Управляющий";
  if (role === "bar_manager") return "Бар-менеджер";
  if (role === "kitchen_area_manager") return "Менеджер по кухне";
  if (role === "kitchen_manager") return "Заведующий производством";
  return "Бармен";
}

export function AppShell({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: PermissionKey;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session, ready } = useSession();
  const currentSession = useServerFn(currentSessionFn);
  const listAnnouncements = useServerFn(listAnnouncementsFn);
  const sessionToken = session?.session_token ?? null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const invalidatedToken = useRef<string | null>(null);

  const {
    data: freshSession,
    isError: isSessionError,
    error: sessionError,
  } = useQuery({
    queryKey: ["current-session", sessionToken],
    queryFn: () => currentSession({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
    staleTime: 30_000,
    retry: false,
  });
  const { data: announcementsData } = useQuery({
    queryKey: ["announcements-shell", sessionToken],
    queryFn: () =>
      listAnnouncements({
        data: { session_token: sessionToken!, limit: 20, include_inactive: false },
      }),
    enabled: !!sessionToken,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    const invalidResponse = freshSession && !Array.isArray(freshSession.permissions);
    if (
      sessionToken &&
      (isSessionError || sessionError || invalidResponse) &&
      invalidatedToken.current !== sessionToken
    ) {
      invalidatedToken.current = sessionToken;
      setSession(null);
      void navigate({ to: "/login", replace: true });
    }
  }, [ready, session, sessionToken, freshSession, isSessionError, sessionError, navigate]);

  useEffect(() => {
    if (!session || !freshSession) return;
    const changed =
      session.user.restaurant_id !== freshSession.user.restaurant_id ||
      session.user.network_id !== freshSession.user.network_id ||
      session.network?.id !== freshSession.network?.id ||
      session.network?.name !== freshSession.network?.name ||
      session.restaurant?.id !== freshSession.restaurant?.id ||
      session.restaurant?.name !== freshSession.restaurant?.name ||
      session.user.name !== freshSession.user.name ||
      session.user.role !== freshSession.user.role ||
      JSON.stringify(session.permissions ?? []) !== JSON.stringify(freshSession.permissions) ||
      JSON.stringify(session.scope ?? null) !== JSON.stringify(freshSession.scope);
    if (changed) setSession(freshSession);
  }, [freshSession, session]);

  if (!ready || !session || !Array.isArray(session.permissions)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }
  if (permission && !hasSerializedPermission(session, permission)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Недостаточно прав</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Этот раздел недоступен для вашей текущей роли.
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: homePathForSession(session) })}>
            Вернуться
          </Button>
        </div>
      </div>
    );
  }

  const role = session.user.role as AllowedRole;
  const navigation = navigationItems.filter((item) => {
    if (!hasSerializedPermission(session, item.permission)) return false;
    if (item.to === "/inventories" && session.scope.restaurant !== "own") return false;
    if (item.to === "/staff" && hasSerializedPermission(session, PERMISSIONS.ADMIN_ACCESS)) {
      return false;
    }
    return true;
  });
  const homePath = homePathForSession(session);

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
      networkName={session.network?.name ?? null}
      unreadCount={announcementsData?.unread_count ?? 0}
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
        <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6">
          {pathname !== "/messages" && announcementsData && (
            <UnreadAnnouncements announcements={announcementsData.announcements} />
          )}
          {children}
        </main>
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
  networkName,
  unreadCount,
  onNavigate,
  onLogout,
}: {
  homePath: NavigationPath;
  navigation: NavigationItem[];
  pathname: string;
  userName: string;
  role: string;
  restaurantName: string | null;
  networkName: string | null;
  unreadCount: number;
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
        {(networkName || restaurantName) && (
          <div className="mt-2 space-y-0.5 pl-11 text-xs text-muted-foreground">
            {networkName && <p className="truncate">{networkName}</p>}
            {restaurantName && <p className="truncate">{restaurantName}</p>}
          </div>
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
              {item.to === "/messages" && unreadCount > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
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

function UnreadAnnouncements({
  announcements,
}: {
  announcements: Array<{
    id: string;
    title: string;
    priority: string;
    is_read: boolean;
    is_active: boolean;
  }>;
}) {
  const unread = announcements
    .filter((announcement) => announcement.is_active && !announcement.is_read)
    .slice(0, 3);
  if (unread.length === 0) return null;
  return (
    <section className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Новые сообщения</h2>
        <Link to="/messages" className="text-sm text-primary hover:underline">
          Посмотреть все
        </Link>
      </div>
      <div className="mt-3 grid gap-2">
        {unread.map((announcement) => (
          <Link
            key={announcement.id}
            to="/messages"
            className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-primary/50"
          >
            <MessageSquareText className="size-4 shrink-0 text-primary" />
            <span className="truncate">{announcement.title}</span>
            {announcement.priority === "urgent" && (
              <span className="ml-auto text-xs font-medium text-destructive">Срочное</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
