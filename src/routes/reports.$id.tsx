import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInventoryReportFn } from "@/lib/barstock.functions";
import { exportInventoryToExcel } from "@/lib/exportInventoryToExcel";
import { useSession } from "@/lib/session";
import type { DiscrepancyStatus } from "@/lib/expectedStock";

export const Route = createFileRoute("/reports/$id")({
  head: () => ({ meta: [{ title: "Отчёт по переучёту — BarStock" }] }),
  component: () => (
    <AppShell allow={["accountant"]}>
      <ReportPage />
    </AppShell>
  ),
});

type Filter = "all" | "diff" | "shortage" | "surplus";

function ReportPage() {
  const { id } = Route.useParams();
  const { session } = useSession();
  const sessionToken = session?.session_token ?? null;
  const getReport = useServerFn(getInventoryReportFn);
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport({ data: { id, session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "diff") return r.status !== "match";
      if (filter === "shortage") return r.status === "shortage";
      if (filter === "surplus") return r.status === "surplus";
      return true;
    });
  }, [data, filter]);

  const totals = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      total: rows.length,
      match: rows.filter((r) => r.status === "match").length,
      shortage: rows.filter((r) => r.status === "shortage").length,
      surplus: rows.filter((r) => r.status === "surplus").length,
    };
  }, [data]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Загрузка…</p>;
  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Не удалось загрузить отчёт"}
      </p>
    );
  }

  const { inventory } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/reports"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> К отчётам
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Отчёт по переучёту от{" "}
          {new Date(inventory.created_at).toLocaleString("ru-RU", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          Всего: {totals.total} · совпадает: {totals.match} · недостача: {totals.shortage} ·
          излишек: {totals.surplus}
        </p>
        <Link
          to="/reports/expected/$id"
          params={{ id: inventory.id }}
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <FileSpreadsheet className="size-4" /> Учётные остатки (заполнить / импорт Excel)
        </Link>
      </div>

      <Button type="button" variant="secondary" onClick={() => exportInventoryToExcel(data)}>
        <Download className="size-4" /> Экспорт в Excel
      </Button>

      <div className="flex flex-wrap gap-1.5">
        <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
          Все
        </FilterPill>
        <FilterPill active={filter === "diff"} onClick={() => setFilter("diff")}>
          Только расхождения
        </FilterPill>
        <FilterPill active={filter === "shortage"} onClick={() => setFilter("shortage")}>
          Недостачи
        </FilterPill>
        <FilterPill active={filter === "surplus"} onClick={() => setFilter("surplus")}>
          Излишки
        </FilterPill>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Нет позиций по выбранному фильтру.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Товар</th>
                <th className="px-4 py-2 text-right font-medium">Факт</th>
                <th className="px-4 py-2 text-right font-medium">Учёт</th>
                <th className="px-4 py-2 text-right font-medium">Разница</th>
                <th className="px-4 py-2 text-left font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.product_id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.unit ?? "шт"}</div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.actual}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.expected_set === false || r.expected === null ? "" : r.expected}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.diff > 0 ? `+${r.diff}` : r.diff}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterPill({
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

function StatusBadge({ status }: { status: DiscrepancyStatus }) {
  if (status === "match") return <Badge variant="secondary">совпадает</Badge>;
  if (status === "shortage")
    return <Badge className="bg-destructive text-destructive-foreground">недостача</Badge>;
  return <Badge className="bg-amber-500 text-black">излишек</Badge>;
}
