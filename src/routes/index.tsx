import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  Network,
  RefreshCcw,
  ShieldCheck,
  SplitSquareHorizontal,
  UserCog,
  Utensils,
  Wine,
} from "lucide-react";

import { FeatureCard } from "@/components/landing/FeatureCard";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { ProductPreview } from "@/components/landing/ProductPreview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BarStock — цифровой переучёт и контроль остатков ресторана" },
      {
        name: "description",
        content:
          "Переучёты, списания, перемещения и контроль остатков бара и кухни в одной системе.",
      },
      { property: "og:title", content: "BarStock — остатки под контролем" },
      {
        property: "og:description",
        content: "Цифровой переучёт для ресторанных сетей без бумаги и двойного ввода.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PublicLandingPage,
});

const features = [
  {
    icon: ClipboardCheck,
    title: "Переучёт в реальном времени",
    text: "Сотрудники вводят фактические остатки сразу в систему. Данные сохраняются без повторного переноса с бумажных листов.",
  },
  {
    icon: Utensils,
    title: "Бар и кухня в одной системе",
    text: "Каталог, зоны и переучёты разделены так, чтобы бар не видел кухню, а бухгалтер видел общую картину.",
  },
  {
    icon: UserCog,
    title: "Роли и разграничение доступа",
    text: "Права разделяются по ролям, сетям, ресторанам и зонам. Каждый сотрудник видит только доступные действия.",
  },
  {
    icon: Boxes,
    title: "Списания",
    text: "Бар и кухня фиксируют списания с количеством и причиной, а бухгалтер видит их в едином журнале.",
  },
  {
    icon: SplitSquareHorizontal,
    title: "Перемещения между ресторанами",
    text: "Товары можно передавать между точками одной сети с понятным статусом и историей движения.",
  },
  {
    icon: FileSpreadsheet,
    title: "Импорт и экспорт Excel",
    text: "Категории и товары можно загрузить из подготовленного файла с предварительной проверкой ошибок и дублей.",
  },
];

const roles = [
  ["Бармен", "Переучёты бара, списания и доступ только к своей зоне."],
  ["Заведующий / менеджер зоны", "Работа с кухней или зоной без лишних разделов."],
  ["Бухгалтер", "Отчёты, расхождения, Excel и справочники."],
  ["Управляющий", "Статистика по ресторанам, зонам и проблемным позициям."],
  ["Администратор сети", "Настройка ресторанов, сотрудников, ролей и каталога."],
];

function PublicLandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingHeader />
      <main>
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <DecorativeGlow />
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="landing-fade-in relative z-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                <ShieldCheck className="size-4" aria-hidden="true" />
                Цифровой учёт для ресторанов
              </div>

              <h1 className="mt-7 max-w-4xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Остатки под контролем. Переучёт — без бумаги и двойного ввода.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                BarStock объединяет переучёты, списания и перемещения в одной системе. Бар, кухня,
                бухгалтерия и управляющие работают с актуальными данными без ручного переноса
                таблиц.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_16px_45px_rgba(248,177,55,0.22)] outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Войти для сотрудников
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/12 bg-white/[0.035] px-5 text-sm font-semibold text-foreground outline-none transition hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Посмотреть возможности
                </a>
              </div>

              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="size-4 text-primary" aria-hidden="true" />
                Вход только для сотрудников подключённых ресторанов
              </p>
            </div>

            <div className="relative z-10">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8" id="why">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Зачем BarStock"
              title="Меньше ручного переноса, больше управляемости"
              text="Система аккуратно заменяет бумажный процесс цифровым контуром без публичной регистрации и лишней сложности для сотрудников."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <ProcessPanel
                title="Старый процесс"
                tone="muted"
                items={[
                  "бумажные листы",
                  "двойной ввод",
                  "ошибки при переносе",
                  "задержка для бухгалтерии",
                  "ручная обработка результатов",
                ]}
              />
              <ProcessPanel
                title="BarStock"
                tone="primary"
                items={[
                  "данные вводятся сразу",
                  "единый каталог",
                  "актуальный статус переучёта",
                  "разделение бара и кухни",
                  "готовый экспорт для бухгалтерии",
                ]}
              />
            </div>
          </div>
        </section>

        <section className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8" id="features">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Возможности"
              title="Рабочие процессы ресторана в одном месте"
              text="Переучёты, справочники, списания, перемещения и отчёты собраны в понятный внутренний инструмент."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard key={feature.title} icon={feature.icon} title={feature.title}>
                  {feature.text}
                </FeatureCard>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8" id="workflow">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Как это работает"
              title="От настройки до Excel-отчёта"
              text="Процесс остаётся привычным для ресторана, но данные сразу попадают в систему."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-4">
              {[
                "Администратор настраивает сеть, рестораны, роли и каталог.",
                "Сотрудники бара и кухни вводят фактические остатки.",
                "Бухгалтер проверяет расхождения и комментарии.",
                "Результат сохраняется и экспортируется в Excel.",
              ].map((step, index) => (
                <article
                  key={step}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <p className="mt-5 text-sm leading-6 text-muted-foreground">{step}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8" id="roles">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Для разных ролей"
              title="Каждый видит свой участок работы"
              text="Доступ зависит от роли, ресторанной сети, ресторана и зоны. Сотруднику не нужно разбираться в лишних разделах."
            />
            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {roles.map(([role, text]) => (
                <article key={role} className="rounded-2xl border border-white/10 bg-black/12 p-5">
                  <Wine className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-base font-semibold text-foreground">{role}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8" id="security">
          <div className="mx-auto max-w-7xl">
            <SectionHeading
              eyebrow="Безопасность"
              title="Закрытый доступ для внутренних процессов"
              text="BarStock устроен как рабочая система для подключённых ресторанов, а не как публичная платформа с регистрацией."
            />
            <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
                <ul className="grid gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
                  {[
                    "вход доступен только созданным администратором сотрудникам",
                    "публичной регистрации нет",
                    "проверка учётных данных выполняется сервером",
                    "права разделены по ролям, сетям, ресторанам и зонам",
                    "действия входа фиксируются для контроля",
                    "операционные запросы проходят через серверную часть приложения",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <ShieldCheck className="mt-1 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <aside className="rounded-2xl border border-primary/25 bg-primary/10 p-6">
                <Lock className="size-7 text-primary" aria-hidden="true" />
                <p className="mt-4 text-base font-semibold text-foreground">
                  Не вводите учётные данные, если вы не получили их от администратора вашей
                  ресторанной сети.
                </p>
              </aside>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8" id="contacts">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-10">
            <Network className="mx-auto size-9 text-primary" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
              Работа с остатками может быть проще
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Для сотрудников подключённых ресторанов доступ уже предоставляется администратором
              сети.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Войти в BarStock
              </Link>
              <a
                href="mailto:ghosttime111@gmail.com"
                className="inline-flex min-h-12 max-w-full items-center justify-center break-all rounded-xl px-4 text-sm text-primary outline-none transition hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                ghosttime111@gmail.com
              </a>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

function DecorativeGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="landing-orb absolute left-[-8rem] top-20 size-72 rounded-full bg-primary/12 blur-3xl" />
      <div className="landing-orb landing-orb-delayed absolute right-[-10rem] top-32 size-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{text}</p>
    </div>
  );
}

function ProcessPanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "muted" | "primary";
}) {
  return (
    <article
      className={`rounded-2xl border p-6 ${
        tone === "primary" ? "border-primary/25 bg-primary/10" : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex items-center gap-3">
        {tone === "primary" ? (
          <RefreshCcw className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <Boxes className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="mt-5 grid gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span
              className={`mt-2 size-1.5 rounded-full ${tone === "primary" ? "bg-primary" : "bg-muted-foreground"}`}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
