import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginFn } from "@/lib/barstock.functions";
import { setSession, useSession } from "@/lib/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Вход — BarStock" }, { name: "description", content: "Вход в BarStock." }],
  }),
  component: LoginPage,
});

function homeForRole(role: string) {
  if (role === "super_admin") return "/admin" as const;
  if (role === "accountant") return "/reports" as const;
  if (role === "manager" || role === "bar_manager") return "/manager" as const;
  return "/inventories" as const;
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const login = useServerFn(loginFn);
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && session) {
      navigate({ to: homeForRole(session.user.role), replace: true });
    }
  }, [ready, session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ data: { login: loginValue.trim(), password } });
      setSession(res);
      navigate({ to: homeForRole(res.user.role), replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <Wine className="size-6 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">BarStock</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">Войдите, чтобы начать переучёт.</p>
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Вход…" : "Войти"}
          </Button>
        </form>
      </div>
    </div>
  );
}
