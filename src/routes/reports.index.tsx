import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import {
  getMonthlyArchiveFn,
  listClosedInventoriesFn,
  listRestaurantNetworksFn,
  listRestaurantsFn,
} from "@/lib/barstock.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportMonthlyArchiveToExcel } from "@/lib/exportMonthlyArchiveToExcel";
import { useSession } from "@/lib/session";
import { useState } from "react";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "Отчёты — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant", "bar_manager", "super_admin"]}>
      <ReportsListPage />
    </AppShell>
  ),
});

function ReportsListPage() {
  const { session } = useSession();
  const list = useServerFn(listClosedInventoriesFn);
  const listRestaurants = useServerFn(listRestaurantsFn);
  const listNetworks = useServerFn(listRestaurantNetworksFn);
  const getMonthlyArchive = useServerFn(getMonthlyArchiveFn);
  const [restaurantId, setRestaurantId] = useState<string>("all");
  const [area, setArea] = useState<string>("all");
  const [archiveMonth, setArchiveMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [archiveRestaurantId, setArchiveRestaurantId] = useState<string>("all");
  const [archiveArea, setArchiveArea] = useState<string>("all");
  const sessionToken = session?.session_token ?? null;
  const isSuperAdmin = session?.user.role === "super_admin";
  const isBarManager = session?.user.role === "bar_manager";
  const [networkId, setNetworkId] = useState<string>("all");

  const { data: networks = [] } = useQuery({
    queryKey: ["restaurant-networks"],
    queryFn: () => listNetworks({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken && isSuperAdmin,
  });

  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants", networkId],
    queryFn: () =>
      listRestaurants({
        data: {
          session_token: sessionToken!,
          network_id: isSuperAdmin && networkId !== "all" ? networkId : null,
        },
      }),
    enabled: !!sessionToken,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", networkId, restaurantId, area],
    queryFn: () =>
      list({
        data: {
          restaurant_id: restaurantId === "all" ? null : restaurantId,
          network_id: isSuperAdmin && networkId !== "all" ? networkId : null,
          area: isBarManager ? "bar" : area === "all" ? null : area,
          session_token: sessionToken!,
        },
      }),
    enabled: !!sessionToken,
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      getMonthlyArchive({
        data: {
          month: archiveMonth,
          restaurant_id: archiveRestaurantId === "all" ? null : archiveRestaurantId,
          network_id: isSuperAdmin && networkId !== "all" ? networkId : null,
          area: archiveArea === "all" ? null : archiveArea,
          session_token: sessionToken!,
        },
      }),
    onSuccess: (archive) => exportMonthlyArchiveToExcel(archive),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Отчёты по переучётам</h1>
          <p className="text-sm text-muted-foreground">Все закрытые переучёты ресторанов.</p>
        </div>
        {isSuperAdmin && (
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Сеть</span>
            <select
              value={networkId}
              onChange={(event) => {
                setNetworkId(event.target.value);
                setRestaurantId("all");
                setArchiveRestaurantId("all");
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Все сети</option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Ресторан</span>
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все рестораны</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <AreaFilter
          value={isBarManager ? "bar" : area}
          onChange={setArea}
          disabled={isBarManager}
        />
      </div>

      {!isBarManager && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">Экспорт архива</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Скачайте все закрытые переучёты за выбранный месяц.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Месяц</span>
              <Input
                type="month"
                value={archiveMonth}
                onChange={(event) => setArchiveMonth(event.target.value)}
                className="w-full sm:w-44"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Ресторан</span>
              <select
                value={archiveRestaurantId}
                onChange={(event) => setArchiveRestaurantId(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Все рестораны</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </label>
            <AreaFilter value={archiveArea} onChange={setArchiveArea} />
            <Button
              type="button"
              disabled={!archiveMonth || archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              <Download className="size-4" />
              {archiveMutation.isPending ? "Подготовка..." : "Скачать архив Excel"}
            </Button>
          </div>
          {archiveMutation.error && (
            <p className="mt-3 text-sm text-destructive">
              {archiveMutation.error instanceof Error
                ? archiveMutation.error.message
                : "Не удалось скачать архив"}
            </p>
          )}
        </section>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Ошибка загрузки"}
        </p>
      )}
      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <ClipboardCheck className="mx-auto mb-3 size-8 opacity-60" />
          Закрытых переучётов пока нет.
        </div>
      )}

      <ul className="grid gap-3">
        {data?.map((inv) => (
          <li key={inv.id}>
            <Link
              to="/reports/$id"
              params={{ id: inv.id }}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/60 hover:bg-card/80"
            >
              <div>
                <div className="font-medium">
                  {new Date(inv.created_at).toLocaleString("ru-RU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isSuperAdmin && inv.network_name ? `${inv.network_name} · ` : ""}
                  {inv.restaurant_name ?? "Ресторан не указан"} - {areaLabel(inv.area)} -{" "}
                  {inv.created_by_name ?? "—"} · позиций: {inv.items_count}
                </div>
              </div>
              <Badge variant={inv.status === "correction_required" ? "default" : "secondary"}>
                {inventoryStatusLabel(inv.status)}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function inventoryStatusLabel(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}

function AreaFilter({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{"\u0417\u043e\u043d\u0430"}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="all">{"\u0412\u0441\u0435"}</option>
        <option value="bar">{"\u0411\u0430\u0440"}</option>
        <option value="kitchen">{"\u041a\u0443\u0445\u043d\u044f"}</option>
      </select>
    </label>
  );
}

function areaLabel(area?: string | null) {
  return area === "kitchen" ? "\u041a\u0443\u0445\u043d\u044f" : "\u0411\u0430\u0440";
}
