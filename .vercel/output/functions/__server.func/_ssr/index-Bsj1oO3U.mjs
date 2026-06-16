import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate } from "../_libs/tanstack__react-router.mjs";
import { u as useSession } from "./session-CK4wviFn.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
function Index() {
  const navigate = useNavigate();
  const {
    session,
    ready
  } = useSession();
  reactExports.useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({
        to: "/login",
        replace: true
      });
      return;
    }
    const home = session.user.role === "accountant" ? "/reports" : "/inventories";
    navigate({
      to: home,
      replace: true
    });
  }, [ready, session, navigate]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Загрузка…" }) });
}
export {
  Index as component
};
