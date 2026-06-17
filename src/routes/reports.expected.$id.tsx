import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Save, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { bulkSetExpectedFn, listExpectedFn, upsertExpectedFn } from "@/lib/barstock.functions";
import { formatQuantity } from "@/lib/formatQuantity";
import { parseQuantityExpression } from "@/lib/quantityExpression";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/reports/expected/$id")({
  head: () => ({ meta: [{ title: "Учётные остатки — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant", "super_admin"]}>
      <ExpectedPage />
    </AppShell>
  ),
});

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

type ImportPreview = {
  matched: { product_id: string; name: string; quantity: number }[];
  unmatched: { name: string; quantity: number }[];
  duplicates: { name: string; quantities: number[] }[];
};

function ExpectedPage() {
  const { id } = Route.useParams();
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const qc = useQueryClient();
  const listExp = useServerFn(listExpectedFn);
  const upsert = useServerFn(upsertExpectedFn);
  const bulk = useServerFn(bulkSetExpectedFn);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["expected", id],
    queryFn: () => listExp({ data: { id, session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });

  const expectedMap = useMemo(() => {
    const m = new Map<string, number>();
    data?.expected.forEach((e) => m.set(e.product_id, Number(e.quantity)));
    return m;
  }, [data]);

  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const bulkMut = useMutation({
    mutationFn: (items: { product_id: string; quantity: number }[]) =>
      bulk({
        data: { inventory_id: id, items, replace: true, session_token: sessionToken! },
      }),
    onSuccess: () => {
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["expected", id] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Ошибка загрузки"}
      </p>
    );
  }

  const { inventory, products } = data;
  const filtered = products.filter((p) =>
    query.trim() ? p.name.toLowerCase().includes(query.trim().toLowerCase()) : true,
  );

  async function handleFile(file: File) {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      // Ищем колонки "название/наименование/товар" и "остаток/количество/qty"
      const nameKeys = ["название", "наименование", "товар", "name", "product"];
      const qtyKeys = ["остаток", "количество", "кол-во", "qty", "quantity", "учёт"];

      const grouped = new Map<string, number[]>();
      for (const row of rows) {
        const keys = Object.keys(row);
        const nameKey = keys.find((k) => nameKeys.some((n) => k.toLowerCase().includes(n)));
        const qtyKey = keys.find((k) => qtyKeys.some((n) => k.toLowerCase().includes(n)));
        if (!nameKey || !qtyKey) continue;
        const name = String(row[nameKey] ?? "").trim();
        const rawQty = String(row[qtyKey] ?? "").replace(",", ".");
        const qty = Number(rawQty);
        if (!name || !Number.isFinite(qty)) continue;
        const key = normalize(name);
        const arr = grouped.get(key) ?? [];
        arr.push(qty);
        grouped.set(key, arr);
      }

      const productIndex = new Map<string, { id: string; name: string }>();
      products.forEach((p) => productIndex.set(normalize(p.name), { id: p.id, name: p.name }));

      const matched: ImportPreview["matched"] = [];
      const unmatched: ImportPreview["unmatched"] = [];
      const duplicates: ImportPreview["duplicates"] = [];

      for (const [key, qtys] of grouped) {
        const product = productIndex.get(key);
        const displayName = product?.name ?? key;
        if (qtys.length > 1) {
          duplicates.push({ name: displayName, quantities: qtys });
        }
        const qty = qtys[qtys.length - 1]; // последнее значение
        if (product) {
          matched.push({ product_id: product.id, name: product.name, quantity: qty });
        } else {
          unmatched.push({ name: displayName, quantity: qty });
        }
      }

      setPreview({ matched, unmatched, duplicates });
    } catch (err) {
      alert("Ошибка чтения файла: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/reports/$id"
          params={{ id }}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> К отчёту
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Учётные остатки · переучёт от{" "}
          {new Date(inventory.created_at).toLocaleString("ru-RU", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          Заполните вручную или импортируйте Excel. После сохранения отчёт автоматически посчитает
          расхождения = факт − учёт.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Импорт из Excel</div>
            <div className="text-xs text-muted-foreground">
              Столбцы: <code>Название</code> и <code>Остаток</code> (первая строка — заголовки).
            </div>
          </div>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="size-4" /> {importing ? "Чтение…" : "Выбрать .xlsx"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>

        {preview && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Найдено: {preview.matched.length}</Badge>
              <Badge className="bg-destructive text-destructive-foreground">
                Не найдено: {preview.unmatched.length}
              </Badge>
              <Badge className="bg-amber-500 text-black">
                Дубликаты: {preview.duplicates.length}
              </Badge>
            </div>
            <PreviewList
              title="Найденные товары"
              items={preview.matched.map((m) => `${m.name} → ${formatQuantity(m.quantity)}`)}
            />
            <PreviewList
              title="Не найдено в каталоге"
              items={preview.unmatched.map((m) => `${m.name} → ${formatQuantity(m.quantity)}`)}
            />
            <PreviewList
              title="Дубликаты (взято последнее значение)"
              items={preview.duplicates.map(
                (d) => `${d.name}: ${d.quantities.map(formatQuantity).join(", ")}`,
              )}
            />
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  bulkMut.mutate(
                    preview.matched.map((m) => ({
                      product_id: m.product_id,
                      quantity: m.quantity,
                    })),
                  )
                }
                disabled={bulkMut.isPending || preview.matched.length === 0}
              >
                <Save className="size-4" /> Сохранить {preview.matched.length} позиций
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Input
          placeholder="Поиск товара…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {filtered.map((p) => (
            <ExpectedRow
              key={p.id}
              product={p}
              initial={expectedMap.get(p.id)}
              onSave={async (qty) => {
                await upsert({
                  data: {
                    inventory_id: id,
                    product_id: p.id,
                    quantity: qty,
                    session_token: sessionToken!,
                  },
                });
                qc.invalidateQueries({ queryKey: ["expected", id] });
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <details className="rounded-md border border-border bg-background/40 p-2">
      <summary className="cursor-pointer text-sm font-medium">
        {title} ({items.length})
      </summary>
      <ul className="mt-2 max-h-48 overflow-auto text-xs text-muted-foreground space-y-0.5">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </details>
  );
}

function ExpectedRow({
  product,
  initial,
  onSave,
}: {
  product: { id: string; name: string; unit: string | null };
  initial: number | undefined;
  onSave: (qty: number) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(initial !== undefined ? String(initial) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initial !== undefined);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    let num: number;
    try {
      num = parseQuantityExpression(value);
    } catch {
      setError("Введите число от 0");
      return;
    }
    if (initial !== undefined && num === initial) {
      setSaved(true);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(num);
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate font-medium">{product.name}</div>
        <div className="text-xs text-muted-foreground">{product.unit ?? "шт"}</div>
      </div>
      <Input
        inputMode="decimal"
        className="w-24 text-right"
        value={value}
        disabled={saving}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <div className="w-28 text-xs">
        {saving && <span className="text-muted-foreground">Сохранение...</span>}
        {!saving && saved && (
          <span className="inline-flex items-center gap-1 text-primary">
            <CheckCircle2 className="size-3" /> сохранено
          </span>
        )}
        {!saving && error && <span className="text-destructive">{error}</span>}
      </div>
    </li>
  );
}
