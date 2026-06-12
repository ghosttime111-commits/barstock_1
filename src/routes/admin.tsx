import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, UserPlus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createBartenderFn,
  createRestaurantFn,
  listBartendersFn,
  listRestaurantsFn,
  updateBartenderRestaurantFn,
} from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Управление — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant"]}>
      <AdminPage />
    </AppShell>
  ),
});

type Restaurant = {
  id: string;
  name: string;
};

type Bartender = {
  id: string;
  name: string;
  login: string;
  restaurant_id: string | null;
};

function AdminPage() {
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const queryClient = useQueryClient();
  const listRestaurants = useServerFn(listRestaurantsFn);
  const createRestaurant = useServerFn(createRestaurantFn);
  const listBartenders = useServerFn(listBartendersFn);
  const createBartender = useServerFn(createBartenderFn);
  const updateBartenderRestaurant = useServerFn(updateBartenderRestaurantFn);

  const [restaurantName, setRestaurantName] = useState("");
  const [bartenderName, setBartenderName] = useState("");
  const [bartenderLogin, setBartenderLogin] = useState("");
  const [bartenderPassword, setBartenderPassword] = useState("");
  const [bartenderRestaurantId, setBartenderRestaurantId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const restaurantsQuery = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => listRestaurants({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const bartendersQuery = useQuery({
    queryKey: ["bartenders"],
    queryFn: () => listBartenders({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const restaurants = useMemo(
    () => (restaurantsQuery.data ?? []) as Restaurant[],
    [restaurantsQuery.data],
  );
  const bartenders = useMemo(
    () => (bartendersQuery.data ?? []) as Bartender[],
    [bartendersQuery.data],
  );
  const restaurantById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
    [restaurants],
  );

  const refreshAdminData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["restaurants"] }),
      queryClient.invalidateQueries({ queryKey: ["bartenders"] }),
    ]);
  };

  const createRestaurantMutation = useMutation({
    mutationFn: () =>
      createRestaurant({ data: { name: restaurantName.trim(), session_token: sessionToken! } }),
    onSuccess: async (restaurant) => {
      setRestaurantName("");
      if (!bartenderRestaurantId) setBartenderRestaurantId(restaurant.id);
      await refreshAdminData();
    },
  });

  const createBartenderMutation = useMutation({
    mutationFn: () =>
      createBartender({
        data: {
          name: bartenderName.trim(),
          login: bartenderLogin.trim(),
          password: bartenderPassword,
          restaurant_id: bartenderRestaurantId,
          session_token: sessionToken!,
        },
      }),
    onSuccess: async () => {
      setBartenderName("");
      setBartenderLogin("");
      setBartenderPassword("");
      await refreshAdminData();
    },
  });

  const updateBartenderMutation = useMutation({
    mutationFn: ({ id, restaurantId }: { id: string; restaurantId: string }) =>
      updateBartenderRestaurant({
        data: { id, restaurant_id: restaurantId, session_token: sessionToken! },
      }),
    onSuccess: refreshAdminData,
  });

  function submitRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurantName.trim()) return;
    createRestaurantMutation.mutate();
  }

  function submitBartender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !bartenderName.trim() ||
      !bartenderLogin.trim() ||
      !bartenderPassword ||
      !bartenderRestaurantId
    ) {
      return;
    }
    createBartenderMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Управление</h1>
        <p className="text-sm text-muted-foreground">
          Рестораны и бармены, доступные для переучётов.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Рестораны</h2>
        </div>

        <form onSubmit={submitRestaurant} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={restaurantName}
            onChange={(event) => setRestaurantName(event.target.value)}
            placeholder="Название ресторана"
            className="sm:max-w-sm"
          />
          <Button type="submit" disabled={createRestaurantMutation.isPending}>
            <Building2 className="size-4" />
            {createRestaurantMutation.isPending ? "Сохранение..." : "Создать ресторан"}
          </Button>
        </form>
        {createRestaurantMutation.error && (
          <p className="mb-3 text-sm text-destructive">
            {createRestaurantMutation.error instanceof Error
              ? createRestaurantMutation.error.message
              : "Не удалось создать ресторан"}
          </p>
        )}

        {restaurantsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : restaurants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ресторанов пока нет.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {restaurants.map((restaurant) => (
              <li key={restaurant.id} className="px-3 py-2 text-sm">
                {restaurant.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Бармены</h2>
        </div>

        <form onSubmit={submitBartender} className="mb-5 grid gap-2 md:grid-cols-5">
          <Input
            value={bartenderName}
            onChange={(event) => setBartenderName(event.target.value)}
            placeholder="Имя"
          />
          <Input
            value={bartenderLogin}
            onChange={(event) => setBartenderLogin(event.target.value)}
            placeholder="Логин"
          />
          <Input
            value={bartenderPassword}
            onChange={(event) => setBartenderPassword(event.target.value)}
            placeholder="Пароль"
            type="password"
          />
          <select
            value={bartenderRestaurantId}
            onChange={(event) => setBartenderRestaurantId(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Ресторан</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            disabled={createBartenderMutation.isPending || restaurants.length === 0}
          >
            <UserPlus className="size-4" />
            {createBartenderMutation.isPending ? "Создание..." : "Создать бармена"}
          </Button>
        </form>
        {createBartenderMutation.error && (
          <p className="mb-3 text-sm text-destructive">
            {createBartenderMutation.error instanceof Error
              ? createBartenderMutation.error.message
              : "Не удалось создать бармена"}
          </p>
        )}
        {updateBartenderMutation.error && (
          <p className="mb-3 text-sm text-destructive">
            {updateBartenderMutation.error instanceof Error
              ? updateBartenderMutation.error.message
              : "Не удалось изменить ресторан бармена"}
          </p>
        )}

        {bartendersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        ) : bartenders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Барменов пока нет.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Имя</th>
                  <th className="px-3 py-2 text-left font-medium">Логин</th>
                  <th className="px-3 py-2 text-left font-medium">Ресторан</th>
                  <th className="px-3 py-2 text-left font-medium">Назначение</th>
                </tr>
              </thead>
              <tbody>
                {bartenders.map((bartender) => {
                  const selectedRestaurantId =
                    assignments[bartender.id] ?? bartender.restaurant_id ?? "";

                  return (
                    <tr key={bartender.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 font-medium">{bartender.name}</td>
                      <td className="px-3 py-2">{bartender.login}</td>
                      <td className="px-3 py-2">
                        {bartender.restaurant_id
                          ? (restaurantById.get(bartender.restaurant_id) ?? "Не найден")
                          : "Не назначен"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-64 gap-2">
                          <select
                            value={selectedRestaurantId}
                            onChange={(event) =>
                              setAssignments((prev) => ({
                                ...prev,
                                [bartender.id]: event.target.value,
                              }))
                            }
                            className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Ресторан</option>
                            {restaurants.map((restaurant) => (
                              <option key={restaurant.id} value={restaurant.id}>
                                {restaurant.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              !selectedRestaurantId ||
                              selectedRestaurantId === bartender.restaurant_id ||
                              updateBartenderMutation.isPending
                            }
                            onClick={() =>
                              updateBartenderMutation.mutate({
                                id: bartender.id,
                                restaurantId: selectedRestaurantId,
                              })
                            }
                          >
                            <Save className="size-4" />
                            Сохранить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
