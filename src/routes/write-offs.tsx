import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { PERMISSIONS, hasSerializedPermission } from "@/lib/authorization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  createWriteOffFn,
  listRestaurantNetworksFn,
  listWriteOffsFn,
} from "@/lib/barstock.functions";
import { exportWriteOffsToExcel } from "@/lib/exportWriteOffsToExcel";
import { formatMoney } from "@/lib/formatMoney";
import { formatQuantity } from "@/lib/formatQuantity";
import { parseQuantityExpression } from "@/lib/quantityExpression";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/write-offs")({
  head: () => ({ meta: [{ title: "Списания — BarStock" }] }),
  component: () => (
    <AppShell permission={PERMISSIONS.WRITE_OFFS_VIEW}>
      <WriteOffsPage />
    </AppShell>
  ),
});

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function WriteOffsPage() {
  const { session } = useSession();
  const listWriteOffs = useServerFn(listWriteOffsFn);
  const listNetworks = useServerFn(listRestaurantNetworksFn);
  const sessionToken = session?.session_token ?? null;
  const managedArea = session?.scope.area === "all" ? null : session?.scope.area;
  const hasNetworkView = session?.scope.restaurant !== "own";
  const canCreate = hasSerializedPermission(session, PERMISSIONS.WRITE_OFFS_CREATE);
  const canExport = hasSerializedPermission(session, PERMISSIONS.WRITE_OFFS_EXPORT);
  const [month, setMonth] = useState(currentMonth());
  const [restaurantId, setRestaurantId] = useState("all");
  const [area, setArea] = useState("all");
  const [networkId, setNetworkId] = useState("all");
  const isSuperAdmin = session?.scope.network === "all";

  const { data: networks = [] } = useQuery({
    queryKey: ["restaurant-networks"],
    queryFn: () => listNetworks({ data: { session_token: sessionToken! } }),
    enabled: !!sessionToken && isSuperAdmin,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["write-offs", session?.user.id, month, networkId, restaurantId, area],
    queryFn: () =>
      listWriteOffs({
        data: {
          session_token: sessionToken!,
          month: hasNetworkView ? month : null,
          network_id: isSuperAdmin && networkId !== "all" ? networkId : null,
          restaurant_id: hasNetworkView && restaurantId !== "all" ? restaurantId : null,
          area: managedArea
            ? managedArea
            : hasNetworkView && area !== "all"
              ? (area as "bar" | "kitchen")
              : null,
        },
      }),
    enabled: !!sessionToken,
  });

  const totalAmount = useMemo(
    () => data?.write_offs.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) ?? 0,
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ReceiptText className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Списания</h1>
          <p className="text-sm text-muted-foreground">
            {hasNetworkView ? "Списания по ресторанам и зонам." : "Списание товаров вашей зоны."}
          </p>
        </div>
      </div>

      {hasNetworkView ? (
        <div className="space-y-3">
          {isSuperAdmin && (
            <label className="grid max-w-xs gap-1 text-sm">
              <span className="text-xs text-muted-foreground">Сеть</span>
              <select
                value={networkId}
                onChange={(event) => {
                  setNetworkId(event.target.value);
                  setRestaurantId("all");
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
          <AccountantFilters
            month={month}
            setMonth={setMonth}
            restaurantId={restaurantId}
            setRestaurantId={setRestaurantId}
            area={managedArea ?? area}
            setArea={setArea}
            areaDisabled={managedArea != null}
            restaurants={data?.restaurants ?? []}
            onExport={() => exportWriteOffsToExcel(data?.write_offs ?? [], month)}
            canExport={canExport && Boolean(data?.write_offs.length)}
          />
        </div>
      ) : canCreate ? (
        <CreateWriteOffForm products={data?.products ?? []} sessionToken={sessionToken} />
      ) : null}

      {canExport && data && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
          <Metric label="Всего списаний" value={String(data.write_offs.length)} />
          <Metric label="Списания, BYN" value={formatMoney(totalAmount)} accent />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Не удалось загрузить списания"}
        </p>
      )}
      {data && <WriteOffsTable rows={data.write_offs} showFinance={canExport} />}
    </div>
  );
}

function CreateWriteOffForm({
  products,
  sessionToken,
}: {
  products: Array<{ id: string; name: string; unit: string | null }>;
  sessionToken: string | null;
}) {
  const createWriteOff = useServerFn(createWriteOffFn);
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useUnsavedChanges("write-off-create", Boolean(productId || quantity.trim() || reason.trim()));

  const mutation = useMutation({
    mutationFn: (parsedQuantity: number) =>
      createWriteOff({
        data: {
          session_token: sessionToken!,
          product_id: productId,
          quantity: parsedQuantity,
          reason: reason.trim(),
        },
      }),
    onSuccess: async () => {
      setQuantity("");
      setReason("");
      setSuccess("Товар списан");
      await queryClient.invalidateQueries({ queryKey: ["write-offs"] });
    },
  });

  function submit() {
    setSuccess(null);
    try {
      if (!productId) throw new Error("Выберите товар");
      const parsed = parseQuantityExpression(quantity);
      if (parsed <= 0) throw new Error("Количество должно быть больше нуля");
      if (reason.trim().length < 3) throw new Error("Укажите причину не короче 3 символов");
      setValidationError(null);
      mutation.mutate(parsed);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Проверьте данные");
    }
  }

  return (
    <section className="border-y border-border py-5">
      <h2 className="text-lg font-semibold">Новое списание</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_1fr]">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Товар</span>
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
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Количество</span>
          <Input
            type="text"
            inputMode="decimal"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0,375"
            className="h-11"
          />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          <span className="text-xs text-muted-foreground">Причина / комментарий</span>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Например: бой, истёк срок, брак"
            rows={3}
          />
        </label>
      </div>
      <Button className="mt-4 h-11 w-full sm:w-auto" onClick={submit} disabled={mutation.isPending}>
        {mutation.isPending ? "Сохранение…" : "Списать"}
      </Button>
      {(validationError || mutation.error) && (
        <p className="mt-3 text-sm text-destructive">
          {validationError ??
            (mutation.error instanceof Error ? mutation.error.message : "Не удалось списать товар")}
        </p>
      )}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
    </section>
  );
}

function AccountantFilters(props: {
  month: string;
  setMonth: (value: string) => void;
  restaurantId: string;
  setRestaurantId: (value: string) => void;
  area: string;
  setArea: (value: string) => void;
  areaDisabled?: boolean;
  restaurants: Array<{ id: string; name: string }>;
  onExport: () => void;
  canExport: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-y border-border py-4 md:flex-row md:items-end">
      <FilterLabel title="Месяц">
        <Input type="month" value={props.month} onChange={(e) => props.setMonth(e.target.value)} />
      </FilterLabel>
      <FilterLabel title="Ресторан">
        <select
          value={props.restaurantId}
          onChange={(e) => props.setRestaurantId(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Все рестораны</option>
          {props.restaurants.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>
      </FilterLabel>
      <FilterLabel title="Зона">
        <select
          value={props.area}
          disabled={props.areaDisabled}
          onChange={(e) => props.setArea(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Все</option>
          <option value="bar">Бар</option>
          <option value="kitchen">Кухня</option>
        </select>
      </FilterLabel>
      <Button onClick={props.onExport} disabled={!props.canExport}>
        <Download className="size-4" /> Скачать списания Excel
      </Button>
    </div>
  );
}

function FilterLabel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs text-muted-foreground">{title}</span>
      {children}
    </label>
  );
}

type WriteOffRow = {
  id: string;
  created_at: string;
  restaurant_name: string;
  area: string;
  product_name: string;
  unit: string;
  quantity: number;
  amount: number | null;
  user_name: string;
  reason: string;
};

function WriteOffsTable({ rows, showFinance }: { rows: WriteOffRow[]; showFinance: boolean }) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Списаний пока нет.</p>;
  }
  return (
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full min-w-[820px] text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            {[
              "Дата",
              ...(showFinance ? ["Ресторан", "Зона"] : []),
              "Товар",
              "Количество",
              "Кто списал",
              "Причина",
              ...(showFinance ? ["Сумма, BYN"] : []),
            ].map((header) => (
              <th key={header} className="px-3 py-2 text-left font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2">
                {new Date(row.created_at).toLocaleString("ru-RU", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </td>
              {showFinance && <td className="px-3 py-2">{row.restaurant_name}</td>}
              {showFinance && (
                <td className="px-3 py-2">
                  <Badge variant="outline">{row.area === "kitchen" ? "Кухня" : "Бар"}</Badge>
                </td>
              )}
              <td className="px-3 py-2 font-medium">{row.product_name}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatQuantity(row.quantity)} {row.unit}
              </td>
              <td className="px-3 py-2">{row.user_name}</td>
              <td className="max-w-80 whitespace-normal px-3 py-2">{row.reason}</td>
              {showFinance && (
                <td className="px-3 py-2 font-medium tabular-nums">
                  {formatMoney(Number(row.amount ?? 0))}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-card"}`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
