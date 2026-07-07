import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { LandingFooter } from "@/components/landing/LandingFooter";
import { BrandMark } from "@/components/landing/LandingHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности BarStock" },
      {
        name: "description",
        content: "Политика конфиденциальности закрытой веб-системы BarStock.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    title: "1. Назначение сервиса",
    content: [
      "BarStock — закрытая веб-система для сотрудников подключённых ресторанов. Публичной регистрации пользователей нет.",
    ],
  },
  {
    title: "2. Какие данные могут обрабатываться",
    content: [
      "В системе могут обрабатываться имя сотрудника, логин, роль, привязка к ресторанной сети и ресторану, история входов, действия внутри системы, данные переучётов, списаний и перемещений, а также технические сведения браузера, необходимые для безопасности и диагностики.",
    ],
  },
  {
    title: "3. Цели обработки",
    content: [
      "Данные используются для аутентификации, разграничения доступа, проведения переучётов, учёта списаний и перемещений, формирования отчётов, безопасности, диагностики и технической поддержки.",
    ],
  },
  {
    title: "4. Хранение сессии",
    content: [
      "Информация активной сессии хранится в локальном хранилище браузера пользователя и используется для поддержания входа в систему.",
    ],
  },
  {
    title: "5. Инфраструктура",
    content: [
      "Для работы системы используются облачные инфраструктурные провайдеры, включая Vercel и Supabase.",
    ],
  },
  {
    title: "6. Передача данных",
    content: [
      "Доступ к данным предоставляется только в объёме, необходимом для работы системы, её администрирования, размещения и технической поддержки.",
      "Данные не используются для показа сторонней рекламы.",
    ],
  },
  {
    title: "7. Срок хранения",
    content: [
      "Данные хранятся в течение срока использования системы ресторанной сетью, а также в течение периода, необходимого для обеспечения целостности учёта, безопасности и выполнения применимых обязательств.",
    ],
  },
  {
    title: "8. Права пользователя",
    content: [
      "Сотрудник может обратиться по поводу уточнения данных, исправления данных, ограничения доступа или удаления учётной записи, когда это допускается требованиями учёта и договорённостями с ресторанной сетью.",
    ],
  },
  {
    title: "9. Контакт",
    content: ["По вопросам конфиденциальности можно написать на ghosttime111@gmail.com."],
  },
];

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <BrandMark />
          <Link
            to="/"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm text-foreground outline-none transition hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            На главную
          </Link>
        </div>
      </header>

      <main className="px-4 py-12 sm:px-6">
        <article className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Закрытая система для ресторанов
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Политика конфиденциальности BarStock
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">Обновлено: 8 июля 2026 года</p>

            <div className="mt-8 space-y-8">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
                    {section.content.map((paragraph) => (
                      <p key={paragraph}>
                        {paragraph.includes("ghosttime111@gmail.com") ? (
                          <>
                            По вопросам конфиденциальности можно написать на{" "}
                            <a
                              href="mailto:ghosttime111@gmail.com"
                              className="break-all text-primary outline-none transition hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              ghosttime111@gmail.com
                            </a>
                            .
                          </>
                        ) : (
                          paragraph
                        )}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
