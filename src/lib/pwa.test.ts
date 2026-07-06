import assert from "node:assert/strict";
import test from "node:test";

import {
  canShowInstallAction,
  getNetworkNotice,
  isIosDevice,
  isStandaloneMode,
  requestUpdateReload,
} from "./pwa.ts";

test("standalone mode accepts display-mode and iOS navigator flags", () => {
  assert.equal(isStandaloneMode(true, false), true);
  assert.equal(isStandaloneMode(false, true), true);
  assert.equal(isStandaloneMode(false, false), false);
});

test("iOS detection supports iPhone and iPad desktop mode", () => {
  assert.equal(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"), true);
  assert.equal(isIosDevice("Mozilla/5.0", "MacIntel", 5), true);
  assert.equal(isIosDevice("Mozilla/5.0 (Linux; Android 15)", "Linux armv8l", 5), false);
});

test("install action appears only when installation is possible", () => {
  assert.equal(
    canShowInstallAction({ isStandalone: false, hasInstallPrompt: true, isIos: false }),
    true,
  );
  assert.equal(
    canShowInstallAction({ isStandalone: false, hasInstallPrompt: false, isIos: true }),
    true,
  );
  assert.equal(
    canShowInstallAction({ isStandalone: false, hasInstallPrompt: false, isIos: false }),
    false,
  );
  assert.equal(
    canShowInstallAction({ isStandalone: true, hasInstallPrompt: true, isIos: false }),
    false,
  );
});

test("network notice distinguishes offline and restored transitions", () => {
  assert.equal(getNetworkNotice(null, true), null);
  assert.equal(getNetworkNotice(null, false), "offline");
  assert.equal(getNetworkNotice(true, false), "offline");
  assert.equal(getNetworkNotice(false, true), "restored");
  assert.equal(getNetworkNotice(true, true), null);
});

test("update reload can only be requested once", () => {
  const first = requestUpdateReload("idle");
  assert.equal(first.shouldReload, true);
  const second = requestUpdateReload(first.state);
  assert.equal(second.shouldReload, false);
});
