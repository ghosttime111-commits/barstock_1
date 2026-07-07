import { CheckCircle2, CircleDot, Layers3, Save, ShieldCheck } from "lucide-react";

const products = [
  { name: "Сироп Маракуйя", category: "Сиропы", quantity: "2.375 л", state: "Сохранено" },
  { name: "Corona Extra 0.33", category: "Пиво", quantity: "18 бут", state: "В работе" },
  { name: "Лайм", category: "Бар", quantity: "0.750 кг", state: "Сохранено" },
];

export function ProductPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#1d1712]/90 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.38)] sm:p-5"
      aria-hidden="true"
    >
      <div className="absolute -right-20 -top-24 size-52 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-24 left-10 size-48 rounded-full bg-accent/12 blur-3xl" />

      <div className="relative rounded-[1.5rem] border border-white/10 bg-black/18 p-4">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Layers3 className="size-4" />
              <span>Ваша сеть — Ваш ресторан</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Переучёт бара
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Зона: Бар</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
            <CircleDot className="size-3.5" />
            Переучёт в процессе
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Прогресс</span>
            <span className="font-medium text-foreground">64 / 72 позиции</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="landing-progress h-full rounded-full bg-primary" />
          </div>
        </div>

        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.name}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{product.category}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{product.quantity}</p>
                <p className="mt-1 text-xs text-muted-foreground">{product.state}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Категории</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Пиво", "Сиропы", "Бар", "Крепкий алкоголь"].map((category) => (
                <span
                  key={category}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-foreground"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Расхождения</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Недостачи</span>
                <span className="font-medium text-red-300">2 позиции</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Излишки</span>
                <span className="font-medium text-emerald-300">1 позиция</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/8 p-3 text-sm">
          <span className="inline-flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="size-4" />
            Сохранено
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Save className="size-4" />
            Автосохранение
          </span>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-4" />
            Роли и зоны
          </span>
        </div>
      </div>
    </div>
  );
}
