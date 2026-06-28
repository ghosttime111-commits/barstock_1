import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { listAreaStaffFn, listRestaurantsFn } from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/staff")({
  head: () => ({ meta: [{ title: "Сотрудники — BarStock" }] }),
  component: () => (
    <AppShell allow={["bar_manager", "kitchen_area_manager"]}>
      <StaffPage />
    </AppShell>
  ),
});

function StaffPage() {
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const isKitchen = session?.user.role === "kitchen_area_manager";
  const [restaurantId, setRestaurantId] = useState("all");
  const listStaff = useServerFn(listAreaStaffFn);
  const listRestaurants = useServerFn(listRestaurantsFn);

  const { data: restaurants = [] } = useQuery({
    queryKey: ["area-staff-restaurants", session?.user.network_id],
    queryFn: () =>
      listRestaurants({
        data: { session_token: sessionToken!, network_id: null },
      }),
    enabled: !!sessionToken,
  });
  const {
    data: staff = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["area-staff", session?.user.id, restaurantId],
    queryFn: () =>
      listStaff({
        data: {
          session_token: sessionToken!,
          restaurant_id: restaurantId === "all" ? null : restaurantId,
        },
      }),
    enabled: !!sessionToken,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Users className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">
              {isKitchen ? "Сотрудники кухни" : "Сотрудники бара"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Активные и отключённые сотрудники вашей сети. Только просмотр.
            </p>
          </div>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Ресторан</span>
          <select
            value={restaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
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
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка сотрудников…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить сотрудников"}
        </p>
      )}

      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              {["Имя", "Логин", "Роль", "Ресторан", "Статус"].map((header) => (
                <th key={header} className="px-3 py-2 text-left font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2 font-medium">{user.name}</td>
                <td className="px-3 py-2">{user.login}</td>
                <td className="px-3 py-2">{roleLabel(user.role)}</td>
                <td className="px-3 py-2">{user.restaurant_name}</td>
                <td className="px-3 py-2">
                  <Badge variant={user.is_active === false ? "secondary" : "outline"}>
                    {user.is_active === false ? "Отключён" : "Активен"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && staff.length === 0 && (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground">
            Сотрудников не найдено.
          </p>
        )}
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "kitchen_area_manager") return "Менеджер по кухне";
  if (role === "kitchen_manager") return "Заведующий производством";
  if (role === "bar_manager") return "Бар-менеджер";
  return "Бармен";
}
