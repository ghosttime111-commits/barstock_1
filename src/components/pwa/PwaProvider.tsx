import { Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  canShowInstallAction,
  getNetworkNotice,
  isIosDevice,
  isStandaloneMode,
  requestUpdateReload,
  type NetworkNotice,
  type UpdateReloadState,
} from "@/lib/pwa";
import {
  applyPwaUpdate,
  dismissPwaUpdate,
  startPwaRegistration,
  subscribePwaRegistration,
} from "@/lib/pwaRegistration";
import { hasUnsavedChanges } from "@/lib/unsavedChanges";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallContextValue = {
  canInstall: boolean;
  isIos: boolean;
  install: () => Promise<void>;
};

const InstallContext = createContext<InstallContextValue>({
  canInstall: false,
  isIos: false,
  install: async () => undefined,
});

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [networkNotice, setNetworkNotice] = useState<NetworkNotice>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updating, setUpdating] = useState(false);
  const previousOnline = useRef<boolean | null>(null);
  const restoredTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadState = useRef<UpdateReloadState>("idle");

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const navigatorStandalone = Boolean(
      (navigator as Navigator & { standalone?: boolean }).standalone,
    );
    const updateStandalone = () =>
      setStandalone(isStandaloneMode(displayMode.matches, navigatorStandalone));

    updateStandalone();
    setIos(isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints));

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setStandalone(true);
    };

    displayMode.addEventListener("change", updateStandalone);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      displayMode.removeEventListener("change", updateStandalone);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const updateConnection = () => {
      const currentOnline = navigator.onLine;
      const notice = getNetworkNotice(previousOnline.current, currentOnline);
      previousOnline.current = currentOnline;
      setNetworkNotice(notice);

      if (restoredTimer.current) clearTimeout(restoredTimer.current);
      if (notice === "restored") {
        restoredTimer.current = setTimeout(() => setNetworkNotice(null), 3500);
      }
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      if (restoredTimer.current) clearTimeout(restoredTimer.current);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePwaRegistration((registrationState) => {
      setNeedRefresh(registrationState.needRefresh);
    });
    if (import.meta.env.PROD) void startPwaRegistration();
    return unsubscribe;
  }, []);

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  async function updateApplication() {
    if (
      hasUnsavedChanges() &&
      !window.confirm("Есть несохранённые данные. Обновление перезагрузит приложение.")
    ) {
      return;
    }

    const reloadRequest = requestUpdateReload(reloadState.current);
    reloadState.current = reloadRequest.state;
    if (!reloadRequest.shouldReload) return;

    setUpdating(true);
    try {
      await applyPwaUpdate();
    } catch (error) {
      console.error("BarStock update failed", error);
      reloadState.current = "idle";
      setUpdating(false);
    }
  }

  const canInstall = canShowInstallAction({
    isStandalone: standalone,
    hasInstallPrompt: installPrompt !== null,
    isIos: ios,
  });

  return (
    <InstallContext.Provider value={{ canInstall, isIos: ios, install }}>
      {children}

      {networkNotice === "offline" && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[100] flex min-h-11 items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground"
        >
          <WifiOff className="size-4 shrink-0" />
          Нет подключения. Изменения сейчас не будут отправлены.
        </div>
      )}

      {networkNotice === "restored" && (
        <div
          role="status"
          className="fixed left-1/2 top-3 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-950 px-4 py-2 text-sm text-emerald-100 shadow-lg"
        >
          <Wifi className="size-4" />
          Подключение восстановлено
        </div>
      )}

      {needRefresh && (
        <section
          aria-label="Обновление BarStock"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-md rounded-lg border border-primary/40 bg-card p-4 shadow-2xl"
        >
          <p className="font-medium">Доступна новая версия BarStock</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={updateApplication} disabled={updating}>
              <RefreshCw className={`size-4 ${updating ? "animate-spin" : ""}`} />
              {updating ? "Обновление…" : "Обновить"}
            </Button>
            <Button type="button" variant="outline" onClick={dismissPwaUpdate}>
              Позже
            </Button>
          </div>
        </section>
      )}
    </InstallContext.Provider>
  );
}

export function InstallBarStockButton() {
  const { canInstall, isIos, install } = useContext(InstallContext);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  if (!canInstall) return null;

  return (
    <div className="px-2 pb-3">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        onClick={() => {
          if (isIos) setShowIosInstructions((value) => !value);
          else void install();
        }}
      >
        <Download className="size-4" />
        Установить BarStock
      </Button>
      {isIos && showIosInstructions && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Откройте меню «Поделиться» и выберите «На экран Домой».
        </p>
      )}
    </div>
  );
}
