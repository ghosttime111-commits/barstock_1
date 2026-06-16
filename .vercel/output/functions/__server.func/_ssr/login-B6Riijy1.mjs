import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate } from "../_libs/tanstack__react-router.mjs";
import { u as useServerFn, B as Button, c as cn, l as loginFn } from "./barstock.functions-DEpRpfrC.mjs";
import { I as Input } from "./input-hnyhQ6XQ.mjs";
import { R as Root } from "../_libs/radix-ui__react-label.mjs";
import { c as cva } from "../_libs/class-variance-authority.mjs";
import { u as useSession, s as setSession } from "./session-CK4wviFn.mjs";
import "../_libs/seroval.mjs";
import { W as Wine } from "../_libs/lucide-react.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "./server-B-fI4YJN.mjs";
import "node:async_hooks";
import "../_libs/h3-v2.mjs";
import "../_libs/rou3.mjs";
import "../_libs/srvx.mjs";
import "../_libs/zod.mjs";
import "../_libs/radix-ui__react-primitive.mjs";
const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);
const Label = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(Root, { ref, className: cn(labelVariants(), className), ...props }));
Label.displayName = Root.displayName;
function LoginPage() {
  const navigate = useNavigate();
  const {
    session,
    ready
  } = useSession();
  const login = useServerFn(loginFn);
  const [loginValue, setLoginValue] = reactExports.useState("");
  const [password, setPassword] = reactExports.useState("");
  const [error, setError] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (ready && session) {
      const home = session.user.role === "accountant" ? "/reports" : "/inventories";
      navigate({
        to: home,
        replace: true
      });
    }
  }, [ready, session, navigate]);
  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({
        data: {
          login: loginValue.trim(),
          password
        }
      });
      setSession(res);
      const home = res.user.role === "accountant" ? "/reports" : "/inventories";
      navigate({
        to: home,
        replace: true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-2xl", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6 flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Wine, { className: "size-6 text-primary" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "BarStock" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-6 text-sm text-muted-foreground", children: "Войдите, чтобы начать переучёт." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { className: "space-y-4", onSubmit, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "login", children: "Логин" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "login", autoComplete: "username", value: loginValue, onChange: (e) => setLoginValue(e.target.value), required: true })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { htmlFor: "password", children: "Пароль" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { id: "password", type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), required: true })
      ] }),
      error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-destructive", role: "alert", children: error }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { type: "submit", className: "w-full", disabled: loading, children: loading ? "Вход…" : "Войти" })
    ] })
  ] }) });
}
export {
  LoginPage as component
};
