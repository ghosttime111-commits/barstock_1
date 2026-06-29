import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Check, X } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PERMISSIONS, hasSerializedPermission } from "@/lib/authorization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelStockTransferFn,
  createStockTransferFn,
  listStockTransfersFn,
  markStockTransferDeliveredFn,
} from "@/lib/barstock.functions";
import { formatQuantity } from "@/lib/formatQuantity";
import { parseQuantityExpression } from "@/lib/quantityExpression";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/transfers")({
  head: () => ({ meta: [{ title: "Перемещения — BarStock" }] }),
  component: () => (
    <AppShell permission={PERMISSIONS.TRANSFERS_VIEW}>
      <TransfersPage />
    </AppShell>
  ),
});

type TransferStatus = "sent" | "delivered" | "cancelled";
type TransferArea = "bar" | "kitchen";
type TransferRow = {
  id: string;
  network_id: string;
  from_restaurant_id: string;
  to_restaurant_id: string;
  area: string;
  product_id: string;
  quantity: number;
  status: TransferStatus;
  sent_by: string;
  delivered_by: string | null;
  sent_at: string;
  delivered_at: string | null;
  comment: string | null;
  delivery_comment: string | null;
  product_name: string;
  unit: string;
  from_restaurant_name: string;
  to_restaurant_name: string;
  sent_by_name: string;
  delivered_by_name: string | null;
  network_name: string;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function TransfersPage() {
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const isOperational = hasSerializedPermission(session, PERMISSIONS.TRANSFERS_CREATE);
  const managedArea = session?.scope.area === "all" ? null : session?.scope.area;
  const isSuperAdmin = session?.scope.network === "all";
  const [month, setMonth] = useState(currentMonth());
  const [networkId, setNetworkId] = useState("all");
  const [restaurantId, setRestaurantId] = useState("all");
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const listTransfers = useServerFn(listStockTransfersFn);

  const { data, isLoading, error } = useQuery({
    queryKey: ["stock-transfers", session?.user.id, month, networkId, restaurantId, area, status],
    queryFn: () =>
      listTransfers({
        data: {
          session_token: sessionToken!,
          month: isOperational ? null : month,
          network_id: isSuperAdmin && networkId !== "all" ? networkId : null,
          restaurant_id: !isOperational && restaurantId !== "all" ? restaurantId : null,
          area: managedArea
            ? managedArea
            : !isOperational && area !== "all"
              ? (area as TransferArea)
              : null,
          status: !isOperational && status !== "all" ? (status as TransferStatus) : null,
        },
      }),
    enabled: !!sessionToken,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <ArrowRightLeft className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Перемещения</h1>
          <p className="text-sm text-muted-foreground">
            Передача товаров между ресторанами одной сети.
          </p>
        </div>
      </header>

      {isOperational ? (
        <OperationalView
          data={data}
          sessionToken={sessionToken}
          currentUserId={session?.user.id ?? ""}
          currentRestaurantId={session?.user.restaurant_id ?? ""}
        />
      ) : (
        <>
          <TransferFilters
            month={month}
            setMonth={setMonth}
            networkId={networkId}
            setNetworkId={(value) => {
              setNetworkId(value);
              setRestaurantId("all");
            }}
            restaurantId={restaurantId}
            setRestaurantId={setRestaurantId}
            area={managedArea ?? area}
            setArea={setArea}
            areaDisabled={managedArea != null}
            status={status}
            setStatus={setStatus}
            isSuperAdmin={isSuperAdmin}
            fixedRestaurantId={data?.scope_restaurant_id ?? null}
            networks={data?.networks ?? []}
            restaurants={data?.restaurants ?? []}
          />
          {data && (
            <TransfersTable
              rows={data.transfers as TransferRow[]}
              sessionToken={sessionToken}
              currentUserId={session?.user.id ?? ""}
              currentRestaurantId={session?.user.restaurant_id ?? ""}
              showNetwork={isSuperAdmin}
              canReceive={false}
              canCancel={hasSerializedPermission(session, PERMISSIONS.TRANSFERS_CANCEL)}
            />
          )}
        </>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить перемещения"}
        </p>
      )}
    </div>
  );
}

function OperationalView({
  data,
  sessionToken,
  currentUserId,
  currentRestaurantId,
}: {
  data:
    | {
        transfers: TransferRow[];
        products: Array<{ id: string; name: string; unit: string | null }>;
        restaurants: Array<{ id: string; name: string }>;
      }
    | undefined;
  sessionToken: string | null;
  currentUserId: string;
  currentRestaurantId: string;
}) {
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const rows = useMemo(() => {
    const transfers = data?.transfers ?? [];
    return transfers.filter((row) =>
      direction === "incoming"
        ? row.to_restaurant_id === currentRestaurantId
        : row.from_restaurant_id === currentRestaurantId,
    );
  }, [currentRestaurantId, data?.transfers, direction]);

  return (
    <>
      <CreateTransferForm
        products={data?.products ?? []}
        restaurants={data?.restaurants ?? []}
        sessionToken={sessionToken}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant={direction === "incoming" ? "default" : "outline"}
          onClick={() => setDirection("incoming")}
        >
          <ArrowDownLeft className="size-4" />
          Входящие
        </Button>
        <Button
          type="button"
          variant={direction === "outgoing" ? "default" : "outline"}
          onClick={() => setDirection("outgoing")}
        >
          <ArrowUpRight className="size-4" />
          Исходящие
        </Button>
      </div>

      <TransfersTable
        rows={rows}
        sessionToken={sessionToken}
        currentUserId={currentUserId}
        currentRestaurantId={currentRestaurantId}
        showNetwork={false}
        canReceive={direction === "incoming"}
        canCancel={direction === "outgoing"}
      />
    </>
  );
}

function CreateTransferForm({
  products,
  restaurants,
  sessionToken,
}: {
  products: Array<{ id: string; name: string; unit: string | null }>;
  restaurants: Array<{ id: string; name: string }>;
  sessionToken: string | null;
}) {
  const createTransfer = useServerFn(createStockTransferFn);
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [comment, setComment] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (parsedQuantity: number) =>
      createTransfer({
        data: {
          session_token: sessionToken!,
          product_id: productId,
          quantity: parsedQuantity,
          to_restaurant_id: restaurantId,
          comment: comment.trim() || null,
        },
      }),
    onSuccess: async () => {
      setProductId("");
      setQuantity("");
      setRestaurantId("");
      setComment("");
      setSuccess("Перемещение создано");
      await queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    },
  });

  function submit() {
    setSuccess(null);
    try {
      if (!productId) throw new Error("Выберите товар");
      if (!restaurantId) throw new Error("Выберите ресторан-получатель");
      const parsedQuantity = parseQuantityExpression(quantity);
      if (parsedQuantity <= 0) throw new Error("Количество должно быть больше нуля");
      setValidationError(null);
      mutation.mutate(parsedQuantity);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Проверьте данные");
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Создать перемещение</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Товар">
          <select
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Выберите товар</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.unit}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Количество">
          <Input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
            placeholder="0,375"
            className="h-11"
          />
        </Field>
        <Field label="Ресторан-получатель">
          <select
            value={restaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Выберите ресторан</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Комментарий">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Необязательно"
            rows={2}
          />
        </Field>
      </div>
      <Button
        type="button"
        className="mt-4 h-11 w-full sm:w-auto"
        disabled={mutation.isPending}
        onClick={submit}
      >
        <ArrowUpRight className="size-4" />
        {mutation.isPending ? "Отправка…" : "Отправить"}
      </Button>
      {(validationError || mutation.error) && (
        <p className="mt-3 text-sm text-destructive">
          {validationError ??
            (mutation.error instanceof Error
              ? mutation.error.message
              : "Не удалось создать перемещение")}
        </p>
      )}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
    </section>
  );
}

function TransferFilters({
  month,
  setMonth,
  networkId,
  setNetworkId,
  restaurantId,
  setRestaurantId,
  area,
  setArea,
  areaDisabled = false,
  status,
  setStatus,
  isSuperAdmin,
  fixedRestaurantId,
  networks,
  restaurants,
}: {
  month: string;
  setMonth: (value: string) => void;
  networkId: string;
  setNetworkId: (value: string) => void;
  restaurantId: string;
  setRestaurantId: (value: string) => void;
  area: string;
  setArea: (value: string) => void;
  areaDisabled?: boolean;
  status: string;
  setStatus: (value: string) => void;
  isSuperAdmin: boolean;
  fixedRestaurantId: string | null;
  networks: Array<{ id: string; name: string }>;
  restaurants: Array<{ id: string; name: string }>;
}) {
  return (
    <section className="flex flex-col gap-3 border-y border-border py-4 md:flex-row md:flex-wrap md:items-end">
      <Field label="Месяц">
        <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </Field>
      {isSuperAdmin && (
        <Field label="Сеть">
          <select
            value={networkId}
            onChange={(event) => setNetworkId(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">Все сети</option>
            {networks.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Ресторан">
        <select
          value={fixedRestaurantId ?? restaurantId}
          disabled={Boolean(fixedRestaurantId)}
          onChange={(event) => setRestaurantId(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-70"
        >
          {!fixedRestaurantId && <option value="all">Все рестораны</option>}
          {restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Зона">
        <select
          value={area}
          disabled={areaDisabled}
          onChange={(event) => setArea(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Все</option>
          <option value="bar">Бар</option>
          <option value="kitchen">Кухня</option>
        </select>
      </Field>
      <Field label="Статус">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Все</option>
          <option value="sent">Отправлено</option>
          <option value="delivered">Доставлено</option>
          <option value="cancelled">Отменено</option>
        </select>
      </Field>
    </section>
  );
}

function TransfersTable({
  rows,
  sessionToken,
  currentUserId,
  currentRestaurantId,
  showNetwork,
  canReceive,
  canCancel,
}: {
  rows: TransferRow[];
  sessionToken: string | null;
  currentUserId: string;
  currentRestaurantId: string;
  showNetwork: boolean;
  canReceive: boolean;
  canCancel: boolean;
}) {
  const deliverTransfer = useServerFn(markStockTransferDeliveredFn);
  const cancelTransfer = useServerFn(cancelStockTransferFn);
  const queryClient = useQueryClient();

  const deliverMutation = useMutation({
    mutationFn: ({ id, deliveryComment }: { id: string; deliveryComment: string | null }) =>
      deliverTransfer({
        data: {
          session_token: sessionToken!,
          transfer_id: id,
          delivery_comment: deliveryComment,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      cancelTransfer({ data: { session_token: sessionToken!, transfer_id: id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock-transfers"] }),
  });

  function deliver(row: TransferRow) {
    const comment = window.prompt("Комментарий при получении (необязательно):", "");
    if (comment === null) return;
    deliverMutation.mutate({ id: row.id, deliveryComment: comment.trim() || null });
  }

  function cancel(row: TransferRow) {
    if (!window.confirm("Отменить это перемещение?")) return;
    cancelMutation.mutate(row.id);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Перемещений по выбранным условиям нет.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <TransferCard
            key={row.id}
            row={row}
            showNetwork={showNetwork}
            canDeliver={
              canReceive && row.status === "sent" && row.to_restaurant_id === currentRestaurantId
            }
            canCancel={
              canCancel &&
              row.status === "sent" &&
              (!currentRestaurantId ||
                (row.from_restaurant_id === currentRestaurantId && row.sent_by === currentUserId))
            }
            pending={deliverMutation.isPending || cancelMutation.isPending}
            onDeliver={() => deliver(row)}
            onCancel={() => cancel(row)}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left">Отправлено</th>
              {showNetwork && <th className="px-3 py-2 text-left">Сеть</th>}
              <th className="px-3 py-2 text-left">Откуда</th>
              <th className="px-3 py-2 text-left">Куда</th>
              <th className="px-3 py-2 text-left">Зона</th>
              <th className="px-3 py-2 text-left">Товар</th>
              <th className="px-3 py-2 text-left">Количество</th>
              <th className="px-3 py-2 text-left">Статус</th>
              <th className="px-3 py-2 text-left">Отправитель</th>
              <th className="px-3 py-2 text-left">Получение</th>
              <th className="px-3 py-2 text-left">Комментарии</th>
              <th className="px-3 py-2 text-left">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const canDeliver =
                canReceive && row.status === "sent" && row.to_restaurant_id === currentRestaurantId;
              const canCancelRow =
                canCancel &&
                row.status === "sent" &&
                (!currentRestaurantId ||
                  (row.from_restaurant_id === currentRestaurantId &&
                    row.sent_by === currentUserId));
              return (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(row.sent_at)}</td>
                  {showNetwork && <td className="px-3 py-2">{row.network_name}</td>}
                  <td className="px-3 py-2">{row.from_restaurant_name}</td>
                  <td className="px-3 py-2">{row.to_restaurant_name}</td>
                  <td className="px-3 py-2">{areaLabel(row.area)}</td>
                  <td className="px-3 py-2 font-medium">{row.product_name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatQuantity(row.quantity)} {row.unit}
                  </td>
                  <td className="px-3 py-2">
                    <TransferStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-2">{row.sent_by_name}</td>
                  <td className="px-3 py-2">
                    {row.delivered_at
                      ? `${formatDate(row.delivered_at)} · ${row.delivered_by_name ?? "—"}`
                      : "—"}
                  </td>
                  <td className="max-w-72 whitespace-normal px-3 py-2">
                    {[row.comment, row.delivery_comment].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <TransferActions
                      canDeliver={canDeliver}
                      canCancel={canCancelRow}
                      pending={deliverMutation.isPending || cancelMutation.isPending}
                      onDeliver={() => deliver(row)}
                      onCancel={() => cancel(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(deliverMutation.error || cancelMutation.error) && (
        <p className="text-sm text-destructive">
          {(deliverMutation.error instanceof Error && deliverMutation.error.message) ||
            (cancelMutation.error instanceof Error && cancelMutation.error.message) ||
            "Не удалось изменить перемещение"}
        </p>
      )}
    </>
  );
}

function TransferCard({
  row,
  showNetwork,
  canDeliver,
  canCancel,
  pending,
  onDeliver,
  onCancel,
}: {
  row: TransferRow;
  showNetwork: boolean;
  canDeliver: boolean;
  canCancel: boolean;
  pending: boolean;
  onDeliver: () => void;
  onCancel: () => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{row.product_name}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {formatQuantity(row.quantity)} {row.unit}
          </p>
        </div>
        <TransferStatusBadge status={row.status} />
      </div>
      <div className="mt-3 grid gap-1 text-sm">
        {showNetwork && <p className="text-muted-foreground">Сеть: {row.network_name}</p>}
        <p>
          {row.from_restaurant_name} → {row.to_restaurant_name}
        </p>
        <p className="text-muted-foreground">
          {areaLabel(row.area)} · {formatDate(row.sent_at)} · {row.sent_by_name}
        </p>
        {row.comment && <p className="mt-1">Комментарий: {row.comment}</p>}
        {row.delivered_at && (
          <p className="mt-1 text-muted-foreground">
            Получено {formatDate(row.delivered_at)} · {row.delivered_by_name ?? "—"}
          </p>
        )}
        {row.delivery_comment && <p>При получении: {row.delivery_comment}</p>}
      </div>
      <div className="mt-4">
        <TransferActions
          canDeliver={canDeliver}
          canCancel={canCancel}
          pending={pending}
          onDeliver={onDeliver}
          onCancel={onCancel}
        />
      </div>
    </article>
  );
}

function TransferActions({
  canDeliver,
  canCancel,
  pending,
  onDeliver,
  onCancel,
}: {
  canDeliver: boolean;
  canCancel: boolean;
  pending: boolean;
  onDeliver: () => void;
  onCancel: () => void;
}) {
  if (!canDeliver && !canCancel) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {canDeliver && (
        <Button type="button" size="sm" disabled={pending} onClick={onDeliver}>
          <Check className="size-4" />
          Доставлено
        </Button>
      )}
      {canCancel && (
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCancel}>
          <X className="size-4" />
          Отменить
        </Button>
      )}
    </div>
  );
}

function TransferStatusBadge({ status }: { status: TransferStatus }) {
  if (status === "delivered") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Доставлено</Badge>;
  }
  if (status === "cancelled") return <Badge variant="secondary">Отменено</Badge>;
  return <Badge variant="outline">Отправлено</Badge>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function areaLabel(area: string) {
  return area === "kitchen" ? "Кухня" : "Бар";
}
