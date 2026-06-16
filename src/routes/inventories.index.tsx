import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createInventoryFn, listInventoriesFn } from "@/lib/barstock.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/inventories/")({
  head: () => ({
    meta: [{ title: "Переучёты — BarStock" }],
  }),
  component: () => (
    <AppShell allow={["bartender", "kitchen_manager"]}>
      <InventoriesPage />
    </AppShell>
  ),
});

function InventoriesPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listInventoriesFn);
  const create = useServerFn(createInventoryFn);
  const sessionToken = session?.session_token ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventories", sessionToken, session?.user.role],
    queryFn: () => list({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: { session_token: sessionToken! },
      }),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["inventories"] });
      navigate({ to: "/inventories/$id", params: { id: inv.id } });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Переучёты</h1>
          <p className="text-sm text-muted-foreground">Все сессии переучёта вашего бара.</p>
        </div>
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          {createMut.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Новый переучёт
        </Button>
      </div>

      {createMut.error && (
        <p className="text-sm text-destructive">
          Ошибка:{" "}
          {createMut.error instanceof Error ? createMut.error.message : String(createMut.error)}
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Ошибка загрузки"}
        </p>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 size-8 opacity-60" />
          Переучётов пока нет. Создайте первый.
        </div>
      )}

      <ul className="grid gap-3">
        {data?.map((inv) => (
          <li key={inv.id}>
            <Link
              to="/inventories/$id"
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
                  {inv.created_by_name ?? "-"} - {areaLabel(inv.area)} - позиций: {inv.items_count}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    inv.status === "draft" || inv.status === "correction_required"
                      ? "default"
                      : "secondary"
                  }
                >
                  {inventoryStatusLabel(inv.status)}
                </Badge>
                <span className="text-xs text-primary underline-offset-2 hover:underline">
                  Открыть →
                </span>
              </div>
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

function areaLabel(area?: string | null) {
  return area === "kitchen" ? "\u041a\u0443\u0445\u043d\u044f" : "\u0411\u0430\u0440";
}
