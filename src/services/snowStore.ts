/**
 * Falling Snow effect store and event bus.
 * Default is ENABLED (true) so the user sees continuous falling snow across all pages.
 */

export const SNOW_EVENT = "dict_snow_toggle";
const STORAGE_KEY = "dict_falling_snow_enabled";

export function isSnowEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true; // Enabled by default
  return stored === "true";
}

export function setSnowEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new CustomEvent<boolean>(SNOW_EVENT, { detail: enabled }));
}

export function toggleSnow(): boolean {
  const next = !isSnowEnabled();
  setSnowEnabled(next);
  return next;
}
