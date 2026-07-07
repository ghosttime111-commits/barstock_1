import { Link } from "@tanstack/react-router";

import { BrandMark } from "./LandingHeader";

const footerLinks = [
  { href: "/#features", label: "Возможности" },
  { href: "/#workflow", label: "Как это работает" },
  { href: "/#security", label: "Безопасность" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/12">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <BrandMark />
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Веб-система для внутреннего учёта ресторанных остатков.
          </p>
          <a
            href="mailto:ghosttime111@gmail.com"
            className="mt-4 inline-flex min-h-11 items-center rounded-lg text-sm text-primary outline-none transition hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            ghosttime111@gmail.com
          </a>
        </div>

        <nav className="grid gap-2 text-sm" aria-label="Ссылки в подвале">
          {footerLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="min-h-10 rounded-lg py-2 text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/privacy"
            className="min-h-10 rounded-lg py-2 text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Политика конфиденциальности
          </Link>
          <Link
            to="/login"
            className="min-h-10 rounded-lg py-2 text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Вход для сотрудников
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-muted-foreground">
        © 2026 BarStock
      </div>
    </footer>
  );
}
