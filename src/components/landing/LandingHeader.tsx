import { Link } from "@tanstack/react-router";
import { Menu, Wine, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "#features", label: "Возможности" },
  { href: "#workflow", label: "Как это работает" },
  { href: "#security", label: "Безопасность" },
  { href: "#contacts", label: "Контакты" },
];

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="BarStock, на главную"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_30px_rgba(248,177,55,0.12)]">
        <Wine className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span>
          <span className="block text-base font-semibold leading-none text-foreground">
            BarStock
          </span>
          <span className="mt-1 block text-xs uppercase tracking-[0.22em] text-muted-foreground">
            restaurant inventory
          </span>
        </span>
      )}
    </Link>
  );
}

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <BrandMark />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Основная навигация">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {item.label}
            </a>
          ))}
          <Link
            to="/login"
            className="ml-2 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_35px_rgba(248,177,55,0.2)] transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Войти для сотрудников
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-foreground outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 bg-background/95 px-4 pb-4 lg:hidden">
          <nav className="mx-auto grid max-w-7xl gap-2 pt-3" aria-label="Мобильная навигация">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="min-h-11 rounded-xl px-3 py-3 text-sm text-muted-foreground outline-none transition hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={closeMenu}
              className="mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Войти для сотрудников
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
