import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, ShieldCheck, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentSessionFn, loginFn } from "@/lib/barstock.functions";
import { getDefaultPath } from "@/lib/authorization";
import { resolveLoginSessionCheck, setSession, useSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Вход — BarStock" },
      { name: "description", content: "Вход в BarStock для сотрудников подключённых ресторанов." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const login = useServerFn(loginFn);
  const currentSession = useServerFn(currentSessionFn);
  const navigationStarted = useRef(false);
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    data: checkedSession,
    isError: isSessionCheckError,
    error: sessionCheckError,
    isPending: isSessionCheckPending,
  } = useQuery({
    queryKey: ["login-session-check", session?.session_token],
    queryFn: () => currentSession({ data: { session_token: session!.session_token } }),
    enabled: ready && Boolean(session) && !navigationStarted.current,
    retry: false,
  });
  const sessionCheck = resolveLoginSessionCheck({
    ready,
    session,
    checkedSession,
    checkPending: isSessionCheckPending,
    checkError: isSessionCheckError ? sessionCheckError : null,
  });

  useEffect(() => {
    if (navigationStarted.current) return;
    const nextSessionCheck = resolveLoginSessionCheck({
      ready,
      session,
      checkedSession,
      checkPending: isSessionCheckPending,
      checkError: isSessionCheckError ? sessionCheckError : null,
    });
    if (nextSessionCheck.status === "authenticated") {
      navigationStarted.current = true;
      setSession(nextSessionCheck.session);
      void navigate({ to: getDefaultPath(nextSessionCheck.session), replace: true });
      return;
    }
    if (nextSessionCheck.status === "clear") {
      setSession(null);
    }
  }, [
    checkedSession,
    isSessionCheckError,
    isSessionCheckPending,
    navigate,
    ready,
    session,
    sessionCheckError,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ data: { login: loginValue.trim(), password } });
      navigationStarted.current = true;
      setSession(res);
      navigate({ to: getDefaultPath(res), replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  const showSessionCheck = sessionCheck.status === "loading" || sessionCheck.status === "checking";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute -left-24 top-16 size-72 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-10 size-80 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl text-sm text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Что такое BarStock
        </Link>

        <div className="rounded-[2rem] border border-white/10 bg-card/92 p-7 shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-8">
          <Link
            to="/"
            className="mb-6 inline-flex min-h-11 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Wine className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-2xl font-semibold tracking-tight text-foreground">
                BarStock
              </span>
              <span className="block text-xs uppercase tracking-[0.22em] text-muted-foreground">
                restaurant inventory
              </span>
            </span>
          </Link>

          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <p className="flex items-start gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Вход только для сотрудников подключённых ресторанов
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Учётную запись создаёт администратор вашей ресторанной сети.
            </p>
          </div>

          {showSessionCheck ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-muted-foreground">
              Проверяем сессию…
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="login">Логин</Label>
                <Input
                  id="login"
                  autoComplete="username"
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="min-h-11 w-full" disabled={loading}>
                <Lock className="size-4" aria-hidden="true" />
                {loading ? "Вход…" : "Войти"}
              </Button>
            </form>
          )}

          <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 text-sm text-muted-foreground">
            <Link
              to="/privacy"
              className="min-h-10 rounded-lg py-2 outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Политика конфиденциальности
            </Link>
            <a
              href="mailto:ghosttime111@gmail.com"
              className="min-h-10 break-all rounded-lg py-2 text-primary outline-none transition hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              ghosttime111@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
