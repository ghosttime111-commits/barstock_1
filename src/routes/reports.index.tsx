import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { listClosedInventoriesFn, listRestaurantsFn } from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";
import { useState } from "react";

export const Route = createFileRoute("/reports/")({
  head: () => ({ meta: [{ title: "Отчёты — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant"]}>
      <ReportsListPage />
    </AppShell>
  ),
});

function ReportsListPage() {
  const { session } = useSession();
  const list = useServerFn(listClosedInventoriesFn);
  const listRestaurants = useServerFn(listRestaurantsFn);
  const [restaurantId, setRestaurantId] = useState<string>("all");
  const sessionToken = session?.session_token ?? null;

  const { data: restaurants = [] } = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => listRestaurants({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["reports", restaurantId],
    queryFn: () =>
      list({
        data: {
          restaurant_id: restaurantId === "all" ? null : restaurantId,
          session_token: sessionToken!,
        },
      }),
    enabled: !!sessionToken,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Отчёты по переучётам</h1>
          <p className="text-sm text-muted-foreground">Все закрытые переучёты ресторанов.</p>
        </div>
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
      </div>

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
                  {inv.restaurant_name ?? "Ресторан не указан"} · {inv.created_by_name ?? "—"} ·
                  позиций: {inv.items_count}
                </div>
              </div>
              <Badge variant="secondary">
                {inv.status === "completed" ? "Закрыт" : "Коррекция"}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
