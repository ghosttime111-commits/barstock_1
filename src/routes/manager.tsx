import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/formatMoney";
import { getManagerStatsFn } from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/manager")({
  head: () => ({ meta: [{ title: "Статистика — BarStock" }] }),
  component: () => (
    <AppShell allow={["manager", "accountant"]}>
      <ManagerPage />
    </AppShell>
  ),
});

type PeriodPreset = "current" | "previous" | "custom";

function monthValue(offset = 0) {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1 + offset).padStart(2, "0")}`;
}

function previousMonthValue() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function ManagerPage() {
  const { session } = useSession();
  const getStats = useServerFn(getManagerStatsFn);
  const sessionToken = session?.session_token ?? null;
  const [period, setPeriod] = useState<PeriodPreset>("current");
  const [month, setMonth] = useState(monthValue());
  const [restaurantId, setRestaurantId] = useState("all");
  const [area, setArea] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-stats", month, restaurantId, area, session?.user.restaurant_id],
    queryFn: () =>
      getStats({
        data: {
          month,
          restaurant_id: restaurantId === "all" ? null : restaurantId,
          area: area === "all" ? null : (area as "bar" | "kitchen"),
          session_token: sessionToken!,
        },
      }),
    enabled: !!sessionToken,
  });

  function changePeriod(next: PeriodPreset) {
    setPeriod(next);
    if (next === "current") setMonth(monthValue());
    if (next === "previous") setMonth(previousMonthValue());
  }

  const fixedRestaurantId = data?.scope_restaurant_id ?? null;
  const selectedRestaurantId = fixedRestaurantId ?? restaurantId;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Статистика</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Закрытые переучёты, денежные расхождения и проблемные позиции.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-y border-border py-4 md:flex-row md:items-end">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Период</span>
          <select
            value={period}
            onChange={(event) => changePeriod(event.target.value as PeriodPreset)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="current">Текущий месяц</option>
            <option value="previous">Прошлый месяц</option>
            <option value="custom">Выбрать месяц</option>
          </select>
        </label>
        {period === "custom" && (
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Месяц</span>
            <Input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="md:w-44"
            />
          </label>
        )}
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Ресторан</span>
          <select
            value={selectedRestaurantId}
            disabled={!!fixedRestaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
          >
            {!fixedRestaurantId && <option value="all">Все рестораны</option>}
            {data?.restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Зона</span>
          <select
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все зоны</option>
            <option value="bar">Бар</option>
            <option value="kitchen">Кухня</option>
          </select>
        </label>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка статистики...</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить статистику"}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <MetricCard
              icon={<ClipboardCheck className="size-4" />}
              label="Всего переучётов"
              value={String(data.summary.inventories)}
            />
            <MetricCard
              icon={<TrendingDown className="size-4" />}
              label="Недостачи"
              value={`${formatMoney(data.summary.shortage)} BYN`}
              tone="shortage"
            />
            <MetricCard
              icon={<TrendingUp className="size-4" />}
              label="Излишки"
              value={`${formatMoney(data.summary.surplus)} BYN`}
              tone="surplus"
            />
            <MetricCard
              icon={<Building2 className="size-4" />}
              label="Чистый итог"
              value={`${formatMoney(data.summary.net)} BYN`}
              tone={data.summary.net < 0 ? "shortage" : data.summary.net > 0 ? "surplus" : "normal"}
            />
            <MetricCard
              icon={<AlertTriangle className="size-4" />}
              label="Проблемных позиций"
              value={String(data.summary.problem_positions)}
              tone="warning"
              className="col-span-2 lg:col-span-1"
            />
          </div>

          <StatsSection title="Топ проблемных товаров">
            <DataTable
              headers={[
                "Товар",
                "Ресторан",
                "Зона",
                "Недостач",
                "Недостачи, BYN",
                "Излишков",
                "Излишки, BYN",
              ]}
              empty="Проблемных товаров за период нет."
              rows={data.top_products.map((row) => [
                row.product_name,
                row.restaurant_name,
                areaLabel(row.area),
                row.shortage_count,
                formatMoney(row.shortage),
                row.surplus_count,
                formatMoney(row.surplus),
              ])}
            />
          </StatsSection>

          <StatsSection title="Статистика по ресторанам">
            <DataTable
              headers={["Ресторан", "Переучётов", "Недостачи, BYN", "Излишки, BYN", "Итог, BYN"]}
              empty="Нет закрытых переучётов за выбранный период."
              rows={data.restaurant_stats.map((row) => [
                row.restaurant_name,
                row.inventories,
                formatMoney(row.shortage),
                formatMoney(row.surplus),
                formatMoney(row.net),
              ])}
            />
          </StatsSection>

          <StatsSection title="Последние переучёты">
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    {[
                      "Дата",
                      "Ресторан",
                      "Зона",
                      "Проводил",
                      "Недостачи",
                      "Излишки",
                      "Итог BYN",
                      "Отчёт",
                    ].map((header) => (
                      <th key={header} className="px-3 py-2 text-left font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.latest_inventories.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <td className="whitespace-nowrap px-3 py-2">
                        {new Date(row.created_at).toLocaleString("ru-RU", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-3 py-2">{row.restaurant_name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{areaLabel(row.area)}</Badge>
                      </td>
                      <td className="px-3 py-2">{row.created_by_name}</td>
                      <td className="px-3 py-2 tabular-nums">{formatMoney(row.shortage)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatMoney(row.surplus)}</td>
                      <td className="px-3 py-2 font-medium tabular-nums">{formatMoney(row.net)}</td>
                      <td className="px-3 py-2">
                        <Link
                          to="/reports/$id"
                          params={{ id: row.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          Открыть
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.latest_inventories.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Нет закрытых переучётов за выбранный период.
                </p>
              )}
            </div>
          </StatsSection>
        </>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone = "normal",
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "normal" | "shortage" | "surplus" | "warning";
  className?: string;
}) {
  const toneClass =
    tone === "shortage"
      ? "border-destructive/40 bg-destructive/10"
      : tone === "surplus"
        ? "border-emerald-500/40 bg-emerald-500/10"
        : tone === "warning"
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${toneClass} ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
  empty: string;
}) {
  return (
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 text-left font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function areaLabel(area: string) {
  return area === "kitchen" ? "Кухня" : "Бар";
}
