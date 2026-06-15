import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Lock, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { closeInventoryFn, getInventoryFn, upsertItemFn } from "@/lib/barstock.functions";
import { formatQuantity } from "@/lib/formatQuantity";
import { parseQuantityExpression } from "@/lib/quantityExpression";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/inventories/$id")({
  head: () => ({ meta: [{ title: "Переучёт — BarStock" }] }),
  component: () => (
    <AppShell allow={["bartender"]}>
      <InventoryDetail />
    </AppShell>
  ),
});

function InventoryDetail() {
  const { id } = Route.useParams();
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const qc = useQueryClient();
  const getInv = useServerFn(getInventoryFn);
  const upsert = useServerFn(upsertItemFn);
  const close = useServerFn(closeInventoryFn);

  const { data, isLoading, error } = useQuery({
    queryKey: ["inventory", id],
    queryFn: () => getInv({ data: { id, session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const closeMut = useMutation({
    mutationFn: () => close({ data: { id, session_token: sessionToken! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", id] }),
  });

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const itemsMap = useMemo(() => {
    const m = new Map<string, number>();
    data?.items.forEach((it) => m.set(it.product_id, Number(it.quantity)));
    return m;
  }, [data]);

  const entriesMap = useMemo(() => {
    const map = new Map<string, Array<{ quantity: number; entry_type?: string | null }>>();
    data?.entries?.forEach((entry) => {
      const list = map.get(entry.product_id) ?? [];
      list.push({ quantity: Number(entry.quantity), entry_type: entry.entry_type });
      map.set(entry.product_id, list);
    });
    return map;
  }, [data]);

  const filtered = useMemo(() => {
    const prods = data?.products ?? [];
    const q = query.trim().toLowerCase();
    return prods.filter((p) => {
      if (categoryId !== "all" && p.category_id !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, query, categoryId]);

  const categoryGroups = useMemo(() => {
    const categoryById = new Map((data?.categories ?? []).map((c) => [c.id, c.name]));
    type Product = (typeof filtered)[number];
    type CategoryGroup = {
      id: string;
      name: string;
      products: Product[];
      filled: number;
    };
    const groups = new Map<string, CategoryGroup>();

    filtered.forEach((product) => {
      const id = product.category_id ?? "uncategorized";
      const group: CategoryGroup = groups.get(id) ?? {
        id,
        name: categoryById.get(id) ?? "Без категории",
        products: [],
        filled: 0,
      };
      group.products.push(product);
      if (itemsMap.has(product.id)) group.filled += 1;
      groups.set(id, group);
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [data, filtered, itemsMap]);

  const expandedKey = `barstock.inventory.${id}.expandedCategories`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(expandedKey);
      if (raw) setExpandedCategories(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      setExpandedCategories({});
    }
  }, [expandedKey]);

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      window.localStorage.setItem(expandedKey, JSON.stringify(next));
      return next;
    });
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Не удалось загрузить переучёт"}
      </p>
    );
  }

  const { inventory, categories, products } = data;
  const canEdit = inventory.status === "draft" || inventory.status === "correction_required";
  const counted = itemsMap.size;
  const missingCount = Math.max(products.length - counted, 0);

  function closeWithMissingCheck() {
    closeMut.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/inventories"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> К списку
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Переучёт от{" "}
            {new Date(inventory.created_at).toLocaleString("ru-RU", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </h1>
          <p className="text-sm text-muted-foreground">
            Посчитано: {counted} из {products.length} позиций
          </p>
          {canEdit && missingCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Незаполненные позиции при закрытии сохранятся как 0.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={canEdit ? "default" : "secondary"}>
            {inventoryStatusLabel(inventory.status)}
          </Badge>
          {canEdit && (
            <Button onClick={closeWithMissingCheck} disabled={closeMut.isPending}>
              <Lock className="size-4" /> Закрыть
            </Button>
          )}
        </div>
      </div>
      {closeMut.error && (
        <p className="text-sm text-destructive">
          {closeMut.error instanceof Error ? closeMut.error.message : "Не удалось закрыть переучёт"}
        </p>
      )}

      {inventory.status === "correction_required" && inventory.correction_comment && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-medium">Комментарий бухгалтера</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {inventory.correction_comment}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск товара…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CategoryPill active={categoryId === "all"} onClick={() => setCategoryId("all")}>
            Все
          </CategoryPill>
          {categories.map((c) => (
            <CategoryPill
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </CategoryPill>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          В базе нет товаров. Добавьте их в таблицу <code>products</code>.
        </div>
      ) : (
        <div className="space-y-3">
          {categoryGroups.map((group) => (
            <section
              key={group.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <button
                type="button"
                onClick={() => toggleCategory(group.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {(expandedCategories[group.id] ?? true) ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{group.name}</span>
                </span>
                <Badge
                  variant={group.filled === group.products.length ? "secondary" : "outline"}
                  className="shrink-0"
                >
                  {group.filled}/{group.products.length}
                </Badge>
              </button>
              {(expandedCategories[group.id] ?? true) && (
                <ul className="divide-y divide-border">
                  {group.products.map((p) => (
                    <ItemRow
                      key={p.id}
                      product={p}
                      initial={itemsMap.get(p.id)}
                      entries={entriesMap.get(p.id) ?? []}
                      disabled={!canEdit}
                      onSave={async (qty, entryType) => {
                        const result = await upsert({
                          data: {
                            inventory_id: id,
                            product_id: p.id,
                            quantity: qty,
                            entry_type: entryType,
                            session_token: sessionToken!,
                          },
                        });
                        qc.invalidateQueries({ queryKey: ["inventory", id] });
                        return Number(result.quantity);
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function inventoryStatusLabel(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs transition " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function EntryHistory({
  entries,
}: {
  entries: Array<{ quantity: number; entry_type?: string | null }>;
}) {
  if (entries.length === 0) return null;
  const visible = entries.slice(0, 5);
  const rest = entries.length - visible.length;

  return (
    <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
      {visible.map((entry, index) => (
        <span key={index} className="rounded border border-border px-1.5 py-0.5">
          {entry.entry_type === "set" ? "=" : "+"}
          {formatQuantity(entry.quantity)}
        </span>
      ))}
      {rest > 0 && <span className="px-1.5 py-0.5">+ ещё {rest}</span>}
    </div>
  );
}

function ItemRow({
  product,
  initial,
  entries,
  disabled,
  onSave,
}: {
  product: { id: string; name: string; unit: string | null; category_id: string | null };
  initial: number | undefined;
  entries: Array<{ quantity: number; entry_type?: string | null }>;
  disabled: boolean;
  onSave: (qty: number, entryType: "add" | "set") => Promise<number>;
}) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"fact" | "add">("add");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(initial !== undefined);
  const [displayQuantity, setDisplayQuantity] = useState(initial ?? 0);
  const currentQuantity = displayQuantity;

  useEffect(() => {
    setDisplayQuantity(initial ?? 0);
    setValue(mode === "fact" && initial !== undefined ? String(initial) : "");
    setSaved(initial !== undefined);
    setError(null);
  }, [initial, mode]);

  const preview = useMemo(() => {
    if (!value.trim()) return null;
    try {
      const parsed = parseQuantityExpression(value);
      if (mode === "add") return currentQuantity + parsed;
      return value.includes("+") ? parsed : null;
    } catch {
      return null;
    }
  }, [currentQuantity, mode, value]);

  function changeMode(nextMode: "fact" | "add") {
    setMode(nextMode);
    setError(null);
    setSaved(initial !== undefined);
    setValue(nextMode === "fact" && initial !== undefined ? String(initial) : "");
  }

  async function commit() {
    if (disabled || saving) return;
    if (!value.trim()) {
      setError(null);
      setSaved(initial !== undefined);
      return;
    }

    let entered: number;
    try {
      entered = parseQuantityExpression(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Некорректное выражение");
      return;
    }

    const nextQuantity = mode === "add" ? currentQuantity + entered : entered;
    const normalizedQuantity = Math.round(nextQuantity * 1_000_000_000_000) / 1_000_000_000_000;

    if (initial !== undefined && normalizedQuantity === initial) {
      setValue(mode === "add" ? "" : String(normalizedQuantity));
      setError(null);
      setSaved(true);
      return;
    }
    setSaving(true);
    try {
      const savedQuantity = await onSave(entered, mode === "add" ? "add" : "set");
      setDisplayQuantity(savedQuantity);
      setValue(mode === "add" ? "" : String(savedQuantity));
      setError(null);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="truncate font-medium">{product.name}</div>
        <div className="text-xs text-muted-foreground">{product.unit ?? "шт"}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Итог:{" "}
          <span className="font-medium text-foreground">{formatQuantity(currentQuantity)}</span>
        </div>
        <EntryHistory entries={entries} />
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => changeMode("add")}
            className={
              "min-h-10 rounded-md px-3 text-sm font-medium transition " +
              (mode === "add"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground")
            }
          >
            + Добавить
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => changeMode("fact")}
            className={
              "min-h-10 rounded-md px-3 text-sm font-medium transition " +
              (mode === "fact"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-background hover:text-foreground")
            }
          >
            Факт
          </button>
        </div>
        <div className="flex items-start gap-2">
          <div className="min-h-[3rem] text-right">
            {preview !== null && !error && (
              <div className="mb-1 text-xs text-muted-foreground">
                Итого: {formatQuantity(preview)}
              </div>
            )}
            {error && <div className="mb-1 max-w-32 text-xs text-destructive">{error}</div>}
          </div>
          {saved && !saving && !error && <CheckCircle2 className="mt-3 size-4 text-primary" />}
          <Input
            inputMode="decimal"
            className="h-11 w-full min-w-32 text-right text-base sm:w-32"
            value={value}
            disabled={disabled}
            placeholder={mode === "add" ? "0.5" : "0"}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setSaved(false);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      </div>
    </li>
  );
}
