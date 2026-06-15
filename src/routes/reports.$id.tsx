import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, RotateCcw, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  deleteInventoryFn,
  getInventoryReportFn,
  requestInventoryCorrectionFn,
} from "@/lib/barstock.functions";
import { exportInventoryToExcel } from "@/lib/exportInventoryToExcel";
import { formatMoney } from "@/lib/formatMoney";
import { formatQuantity } from "@/lib/formatQuantity";
import { useSession } from "@/lib/session";
import type { DiscrepancyStatus } from "@/lib/expectedStock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getReport = useServerFn(getInventoryReportFn);
  const deleteInventory = useServerFn(deleteInventoryFn);
  const requestCorrection = useServerFn(requestInventoryCorrectionFn);
  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => getReport({ data: { id, session_token: sessionToken! } }),
    enabled: !!sessionToken,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionComment, setCorrectionComment] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => deleteInventory({ data: { id, session_token: sessionToken! } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await navigate({ to: "/reports" });
    },
  });

  const correctionMutation = useMutation({
    mutationFn: () =>
      requestCorrection({
        data: {
          id,
          session_token: sessionToken!,
          correction_comment: correctionComment.trim(),
        },
      }),
    onSuccess: async () => {
      setCorrectionOpen(false);
      setCorrectionComment("");
      setCorrectionError(null);
      await queryClient.invalidateQueries({ queryKey: ["report", id] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

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
      money: rows.reduce((sum, row) => sum + Number(row.money_diff ?? 0), 0),
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
  const isCorrectionRequired = inventory.status === "correction_required";

  function confirmAndDelete() {
    const confirmed = window.confirm(
      "Вы уверены? Перед удалением скачайте Excel-отчёт. Удаление необратимо.",
    );
    if (!confirmed) return;
    deleteMutation.mutate();
  }

  function submitCorrection() {
    if (!correctionComment.trim()) {
      setCorrectionError("Комментарий обязателен");
      return;
    }
    setCorrectionError(null);
    correctionMutation.mutate();
  }

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
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={isCorrectionRequired ? "default" : "secondary"}>
            {inventoryStatusLabel(inventory.status)}
          </Badge>
          {isCorrectionRequired && (
            <span className="text-sm text-muted-foreground">Предварительный отчёт</span>
          )}
        </div>
        <Link
          to="/reports/expected/$id"
          params={{ id: inventory.id }}
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <FileSpreadsheet className="size-4" /> Учётные остатки (заполнить / импорт Excel)
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Всего позиций" value={totals.total} />
        <SummaryCard label="Совпадает" value={totals.match} />
        <SummaryCard label="Недостачи" value={totals.shortage} tone="shortage" />
        <SummaryCard label="Излишки" value={totals.surplus} tone="surplus" />
        <SummaryCard
          label="Итог BYN"
          value={`${formatMoney(totals.money)} BYN`}
          tone={totals.money < 0 ? "shortage" : totals.money > 0 ? "surplus" : "total"}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => exportInventoryToExcel(data)}>
          <Download className="size-4" /> Скачать Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={correctionMutation.isPending || isCorrectionRequired}
          onClick={() => setCorrectionOpen(true)}
        >
          <RotateCcw className="size-4" />
          Вернуть на доработку
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={confirmAndDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-4" />
          {deleteMutation.isPending ? "Удаление..." : "Удалить переучёт"}
        </Button>
      </div>
      {deleteMutation.error && (
        <p className="text-sm text-destructive">
          {deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : "Не удалось удалить переучёт"}
        </p>
      )}
      {correctionMutation.error && (
        <p className="text-sm text-destructive">
          {correctionMutation.error instanceof Error
            ? correctionMutation.error.message
            : "Не удалось вернуть переучёт на доработку"}
        </p>
      )}

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вернуть переучёт на доработку</DialogTitle>
            <DialogDescription>
              Бармен увидит комментарий и сможет исправить фактические остатки.
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Комментарий для бармена</span>
            <Textarea
              value={correctionComment}
              onChange={(event) => {
                setCorrectionComment(event.target.value);
                setCorrectionError(null);
              }}
              placeholder="Что нужно проверить или исправить"
              rows={5}
            />
          </label>
          {correctionError && <p className="text-sm text-destructive">{correctionError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCorrectionOpen(false)}
              disabled={correctionMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              type="button"
              onClick={submitCorrection}
              disabled={correctionMutation.isPending}
            >
              {correctionMutation.isPending ? "Возврат..." : "Вернуть"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <th className="px-4 py-2 text-right font-medium">Цена за ед., BYN</th>
                <th className="px-4 py-2 text-right font-medium">Сумма, BYN</th>
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
                  <td className="px-4 py-2 text-right tabular-nums">{formatQuantity(r.actual)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.expected_set === false || r.expected === null
                      ? ""
                      : formatQuantity(r.expected)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.diff > 0 ? `+${formatQuantity(r.diff)}` : formatQuantity(r.diff)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(Number(r.unit_price ?? 0))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(Number(r.money_diff ?? 0))}
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

function SummaryCard({
  label,
  value,
  tone = "total",
  className = "",
}: {
  label: string;
  value: number | string;
  tone?: "total" | "shortage" | "surplus";
  className?: string;
}) {
  const toneClass =
    tone === "shortage"
      ? "border-destructive/40 bg-destructive/10"
      : tone === "surplus"
        ? "border-emerald-500/40 bg-emerald-500/10"
        : "border-border bg-card";

  return (
    <div className={`rounded-lg border p-3 ${toneClass} ${className}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function inventoryStatusLabel(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "completed") return "Закрыт";
  if (status === "correction_required") return "На доработке";
  return status;
}
