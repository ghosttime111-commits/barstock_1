export type NetworkNotice = "offline" | "restored" | null;
export type UpdateReloadState = "idle" | "requested";

export function isStandaloneMode(displayModeStandalone: boolean, navigatorStandalone: boolean) {
  return displayModeStandalone || navigatorStandalone;
}

export function isIosDevice(userAgent: string, platform = "", maxTouchPoints = 0) {
  const classicIos = /iPad|iPhone|iPod/i.test(userAgent);
  const ipadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  return classicIos || ipadDesktopMode;
}

export function canShowInstallAction(input: {
  isStandalone: boolean;
  hasInstallPrompt: boolean;
  isIos: boolean;
}) {
  return !input.isStandalone && (input.hasInstallPrompt || input.isIos);
}

export function getNetworkNotice(
  previousOnline: boolean | null,
  currentOnline: boolean,
): NetworkNotice {
  if (!currentOnline) return "offline";
  if (previousOnline === false && currentOnline) return "restored";
  return null;
}

export function requestUpdateReload(state: UpdateReloadState) {
  if (state === "requested") {
    return { state, shouldReload: false } as const;
  }
  return { state: "requested" as const, shouldReload: true } as const;
}
