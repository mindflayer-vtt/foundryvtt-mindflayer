import { VTT_MODULE_NAME } from "../settings/constants";

export function isBeamerUser(): boolean {
  // The active ID exists before the User collection is initialized at the init hook.
  const id = game.userId ?? game.user?.id;
  return Boolean(id) && id === game.settings.get(VTT_MODULE_NAME, "beamerUserId");
}

// Keep explicit client choices, including off; only specialize the default.
export function beamerCameraMode(
  mode: "default" | "focusPlayers" | "off",
): "default" | "focusPlayers" | "off" {
  return isBeamerUser() && mode === "default" ? "focusPlayers" : mode;
}
