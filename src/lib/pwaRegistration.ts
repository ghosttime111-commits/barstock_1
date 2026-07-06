type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

type PwaRegistrationState = {
  needRefresh: boolean;
  registrationError: boolean;
};

const listeners = new Set<(state: PwaRegistrationState) => void>();
let state: PwaRegistrationState = {
  needRefresh: false,
  registrationError: false,
};
let registrationStarted = false;
let updateServiceWorker: UpdateServiceWorker | null = null;

function publish(patch: Partial<PwaRegistrationState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
}

export function subscribePwaRegistration(listener: (state: PwaRegistrationState) => void) {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export async function startPwaRegistration() {
  if (registrationStarted || typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  registrationStarted = true;

  try {
    const { registerSW } = await import("virtual:pwa-register");
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => publish({ needRefresh: true }),
      onRegisterError: (error) => {
        console.error("BarStock service worker registration failed", error);
        publish({ registrationError: true });
      },
    });
  } catch (error) {
    console.error("BarStock PWA initialization failed", error);
    publish({ registrationError: true });
  }
}

export function dismissPwaUpdate() {
  publish({ needRefresh: false });
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) {
    throw new Error("PWA update is not ready");
  }
  await updateServiceWorker(true);
}
