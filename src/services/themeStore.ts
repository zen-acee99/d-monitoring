import { getCurrentUser } from "./authStore";
import { apiFetch } from "./api";

export type AppTheme = "dark" | "light";

const THEME_STORAGE_KEY = "dict_app_theme_v1";
export const THEME_EVENT = "dict_theme_changed";

export function applyThemeToDom(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    document.documentElement.classList.add("light-theme");
    document.body?.classList.add("light-theme");
  } else {
    document.documentElement.classList.remove("light-theme");
    document.body?.classList.remove("light-theme");
  }
}

export function getTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // ignore
  }
  return "dark";
}

export async function setTheme(theme: AppTheme, saveToDb = true): Promise<boolean> {
  const normalized: AppTheme = theme === "light" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // ignore
  }
  applyThemeToDom(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: normalized }));
  }

  if (!saveToDb) return true;

  try {
    const user = getCurrentUser();
    const res = await apiFetch("/api/administration/theme", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(user?.id ? { "x-user-id": String(user.id) } : {}),
      },
      body: JSON.stringify({
        theme: normalized,
        userId: user?.id || undefined,
        email: user?.email || undefined,
      }),
    });
    const data = await res.json();
    return Boolean(data?.success);
  } catch (err) {
    console.warn("Could not save theme to DB, saved locally:", err);
    return false;
  }
}

export async function toggleTheme(): Promise<{ theme: AppTheme; savedToDb: boolean }> {
  const next: AppTheme = getTheme() === "dark" ? "light" : "dark";
  const savedToDb = await setTheme(next, true);
  return { theme: next, savedToDb };
}

export async function syncThemeFromDb(): Promise<AppTheme> {
  // Apply cached theme immediately to avoid flash
  const cached = getTheme();
  applyThemeToDom(cached);

  try {
    const user = getCurrentUser();
    const query = user?.id ? `?userId=${encodeURIComponent(String(user.id))}` : "";
    const res = await apiFetch(`/api/administration/theme${query}`, {
      headers: user?.id ? { "x-user-id": String(user.id) } : undefined,
    });
    if (!res.ok) return cached;
    const data = await res.json();
    if (data?.success && (data.theme === "light" || data.theme === "dark")) {
      const dbTheme: AppTheme = data.theme;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, dbTheme);
      } catch {
        // ignore
      }
      applyThemeToDom(dbTheme);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: dbTheme }));
      }
      return dbTheme;
    }
  } catch {
    // ignore network fallback
  }
  return cached;
}
