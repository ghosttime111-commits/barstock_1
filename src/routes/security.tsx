import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldCheck } from "lucide-react";
import { useDeferredValue, useState, type ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listLoginEventsFn } from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Журнал входов — BarStock" }] }),
  component: () => (
    <AppShell allow={["super_admin"]}>
      <LoginEventsPage />
    </AppShell>
  ),
});

type PeriodFilter = "today" | "7days" | "month";
type StatusFilter = "all" | "success" | "failure";
type StaffRole =
  | "bartender"
  | "kitchen_manager"
  | "accountant"
  | "manager"
  | "bar_manager"
  | "super_admin";
type LoginEvent = {
  id: string;
  login: string;
  user_name: string | null;
  role: string | null;
  success: boolean;
  failure_reason: string | null;
  created_at: string;
  restaurants: { name: string } | Array<{ name: string }> | null;
};

const roles: Array<{ value: StaffRole; label: string }> = [
  { value: "bartender", label: "Бармен" },
  { value: "kitchen_manager", label: "Заведующий производством" },
  { value: "accountant", label: "Бухгалтер" },
  { value: "manager", label: "Управляющий" },
  { value: "bar_manager", label: "Бар-менеджер" },
  { value: "super_admin", label: "Администратор системы" },
];

function roleLabel(role: string | null) {
  return roles.find((item) => item.value === role)?.label ?? role ?? "—";
}

function failureReasonLabel(reason: string | null) {
  if (reason === "user_not_found") return "Пользователь не найден";
  if (reason === "invalid_password") return "Неверный пароль";
  if (reason === "inactive_user") return "Пользователь отключён";
  if (reason === "database_error") return "Ошибка базы данных";
  return reason ?? "—";
}

function restaurantName(event: LoginEvent) {
  if (Array.isArray(event.restaurants)) return event.restaurants[0]?.name ?? "—";
  return event.restaurants?.name ?? "—";
}

function LoginEventsPage() {
  const { session } = useSession();
  const listLoginEvents = useServerFn(listLoginEventsFn);
  const [period, setPeriod] = useState<PeriodFilter>("7days");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<"all" | StaffRole>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

  const { data, isLoading, error } = useQuery({
    queryKey: ["login-events", period, status, role, deferredSearch],
    queryFn: () =>
      listLoginEvents({
        data: {
          session_token: session!.session_token,
          period,
          status,
          role: role === "all" ? null : role,
          search: deferredSearch,
        },
      }),
    enabled: !!session?.session_token,
  });

  const events = (data ?? []) as LoginEvent[];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Журнал входов</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Последние попытки входа пользователей в систему.
        </p>
      </div>

      <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-2 xl:grid-cols-4">
        <Filter label="Период">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="today">Сегодня</option>
            <option value="7days">7 дней</option>
            <option value="month">Текущий месяц</option>
          </select>
        </Filter>
        <Filter label="Статус">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все</option>
            <option value="success">Успешные</option>
            <option value="failure">Ошибки</option>
          </select>
        </Filter>
        <Filter label="Роль">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "all" | StaffRole)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все роли</option>
            {roles.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Поиск">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Логин или имя"
              className="pl-9"
            />
          </div>
        </Filter>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка журнала...</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить журнал входов"}
        </p>
      )}

      {!isLoading && !error && events.length === 0 && (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          За выбранный период событий входа нет.
        </p>
      )}

      {events.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-3 text-left font-medium">Дата и время</th>
                <th className="px-3 py-3 text-left font-medium">Имя</th>
                <th className="px-3 py-3 text-left font-medium">Логин</th>
                <th className="px-3 py-3 text-left font-medium">Роль</th>
                <th className="px-3 py-3 text-left font-medium">Ресторан</th>
                <th className="px-3 py-3 text-left font-medium">Статус</th>
                <th className="px-3 py-3 text-left font-medium">Причина</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className={`border-b border-border last:border-b-0 ${
                    event.success ? "" : "bg-destructive/5"
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-3">
                    {new Intl.DateTimeFormat("ru-RU", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    }).format(new Date(event.created_at))}
                  </td>
                  <td className="px-3 py-3 font-medium">{event.user_name ?? "—"}</td>
                  <td className="px-3 py-3">{event.login}</td>
                  <td className="px-3 py-3">{roleLabel(event.role)}</td>
                  <td className="px-3 py-3">{restaurantName(event)}</td>
                  <td className="px-3 py-3">
                    <Badge variant={event.success ? "secondary" : "destructive"}>
                      {event.success ? "Успешно" : "Ошибка"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {event.success ? "—" : failureReasonLabel(event.failure_reason)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Показываются последние 100 записей.</p>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
