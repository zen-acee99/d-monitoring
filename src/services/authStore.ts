import { UserRecord, getStoredUsers } from "@/data/userStore";
import { administrationApi, modulesApi, SystemModule } from "@/services/api";

const CURRENT_USER_KEY = "dict_current_user";
const SYSTEM_MODULES_CACHE_KEY = "dict_system_modules";

// Event dispatched when active user session changes
export const AUTH_EVENT = "dict_auth_changed";

export function getCachedSystemModules(): SystemModule[] {
  try {
    const raw = localStorage.getItem(SYSTEM_MODULES_CACHE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {
    console.error("Error reading cached modules:", e);
  }
  return [];
}

export function setCachedSystemModules(modules: SystemModule[]): void {
  try {
    localStorage.setItem(SYSTEM_MODULES_CACHE_KEY, JSON.stringify(modules));
    window.dispatchEvent(new CustomEvent("dict_modules_updated", { detail: modules }));
  } catch (e) {
    console.error("Error writing cached modules:", e);
  }
}

export async function refreshSystemModules(): Promise<SystemModule[]> {
  try {
    const list = await modulesApi.getModules();
    if (Array.isArray(list) && list.length > 0) {
      setCachedSystemModules(list);
      return list;
    }
  } catch (e) {
    console.warn("Failed to refresh system modules:", e);
  }
  return getCachedSystemModules();
}

export function getCurrentUser(): UserRecord | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (raw) {
      const user = JSON.parse(raw);
      if (user && user.id) return user;
    }
  } catch (e) {
    console.error("Error reading current user session:", e);
  }

  return null;
}

export function setCurrentUser(user: UserRecord | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: user }));
  } catch (e) {
    console.error("Error saving current user session:", e);
  }
}

export const ALL_SYSTEM_MODULES = [
  { code: "MOD_OVERVIEW", id: "overview" },
  { code: "MOD_DTR", id: "dtr" },
  { code: "MOD_CALENDAR", id: "calendar" },
  { code: "MOD_GECS", id: "gecs" },
  { code: "MOD_FREEWIFI", id: "freewifi" },
  { code: "MOD_EGOVPH", id: "egovph" },
  { code: "MOD_ELGU", id: "elgu" },
  { code: "MOD_NBP", id: "nbp" },
  { code: "MOD_GOVNET", id: "govnet" },
  { code: "MOD_PNPKI", id: "pnpki" },
  { code: "MOD_ILCDB", id: "ilcdb" },
  { code: "MOD_CYBERSECURITY", id: "cybersecurity" },
  { code: "MOD_MISS", id: "miss" },
  { code: "MOD_IIDB", id: "iidb" },
  { code: "MOD_PROJECT_DATA", id: "project_data" },
  { code: "MOD_ADMIN", id: "admin" },
];

export function createFullAccessMatrix(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  ALL_SYSTEM_MODULES.forEach((m) => {
    map[m.code] = true;
    map[m.id] = true;
    map[`MOD_${m.id.toUpperCase()}`] = true;
    map[m.code.replace(/^MOD_/, "").toLowerCase()] = true;
  });
  return map;
}

export function createEmptyAccessMatrix(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  ALL_SYSTEM_MODULES.forEach((m) => {
    map[m.code] = false;
    map[m.id] = false;
    map[`MOD_${m.id.toUpperCase()}`] = false;
    map[m.code.replace(/^MOD_/, "").toLowerCase()] = false;
  });
  return map;
}

export function syncCurrentUserIfUpdated(updatedUser: UserRecord): void {
  const current = getCurrentUser();
  if (
    current &&
    (String(current.id) === String(updatedUser.id) ||
      (current.email && updatedUser.email && current.email.toLowerCase() === updatedUser.email.toLowerCase()))
  ) {
    if (updatedUser.status === "inactive") {
      // Terminate active session immediately if this user was deactivated
      setCurrentUser(null);
    } else {
      const merged = { ...current, ...updatedUser };
      setCurrentUser(merged);
    }
  }
  // Instantly broadcast to all open components (Sidebar, Project Data Management, Guards) without reload!
  window.dispatchEvent(new CustomEvent("dict_users_updated", { detail: updatedUser }));
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: getCurrentUser() }));
}

export const updateUserSession = syncCurrentUserIfUpdated;

/**
 * Check if the user has access to a specific module code or project ID.
 * Supports both module codes (e.g. MOD_FREEWIFI, MOD_DTR) and project IDs (e.g. freewifi, dtr).
 */
export function hasModuleAccess(user: UserRecord | null, moduleCodeOrId: string): boolean {
  if (!user) return false;
  if (user.status === "inactive") return false;

  // Global Module Status Check: If module is deactivated globally in Turso (Table: module), block access
  const systemModules = getCachedSystemModules();
  if (systemModules && systemModules.length > 0) {
    const clean = moduleCodeOrId.trim();
    const upper = clean.toUpperCase();
    const modPrefixed = upper.startsWith("MOD_") ? upper : `MOD_${upper}`;
    const unPrefixed = upper.replace(/^MOD_/, "").toLowerCase();

    const matchedModule = systemModules.find(
      (m) =>
        m.code.toUpperCase() === modPrefixed ||
        m.code.toUpperCase() === upper ||
        m.id.toLowerCase() === unPrefixed ||
        (m.route_path && m.route_path.toLowerCase() === clean.toLowerCase())
    );

    if (matchedModule && matchedModule.is_active === false) {
      // Allow Super Admin and Regional Director to still access Administration & System Settings, but block normal deactivated project tools
      if (modPrefixed !== "MOD_ADMIN" && modPrefixed !== "MOD_PROJECT_DATA") {
        return false;
      }
    }
  }

  const access = user.access || {};

  // Build variations of the key
  const clean = moduleCodeOrId.trim();
  const upper = clean.toUpperCase();
  const lower = clean.toLowerCase();
  const modPrefixed = upper.startsWith("MOD_") ? upper : `MOD_${upper}`;
  const unPrefixed = upper.replace(/^MOD_/, "").toLowerCase().replace(/-/g, "_");
  const unPrefixedHyphen = upper.replace(/^MOD_/, "").toLowerCase().replace(/_/g, "-");
  const dashed = clean.replace(/^mod-/, "").toLowerCase();

  const candidateKeys = [clean, upper, lower, modPrefixed, unPrefixed, unPrefixedHyphen, dashed];

  // 1. If any candidate key is explicitly true, grant access immediately
  for (const key of candidateKeys) {
    if (access[key] === true || access[key] === 1 as any) {
      return true;
    }
  }

  // 2. If any candidate key is explicitly false, deny access
  for (const key of candidateKeys) {
    if (access[key] === false || access[key] === 0 as any) {
      return false;
    }
  }

  // 3. Super Admin, Admin & Regional Director fallback:
  // If user is Super Admin, Admin, or Regional Director and this module was NOT explicitly set to false, allow access!
  if (
    user.role === "Super Admin" ||
    user.role === "Admin" ||
    user.role === "Regional Director" ||
    user.role === "Asst. Regional Director" ||
    user.role === "Assistant Regional Director"
  ) {
    return true;
  }

  return false;
}

/**
 * Fetch all available users from Turso or local storage
 */
export async function getAllUsers(): Promise<UserRecord[]> {
  try {
    const dbUsers = await administrationApi.getAdministrators();
    if (Array.isArray(dbUsers) && dbUsers.length > 0) {
      return dbUsers as UserRecord[];
    }
  } catch (err) {
    console.warn("Failed to fetch users from backend:", err);
  }
  return getStoredUsers();
}

/**
 * Refreshes current active user from database or storage to get latest permissions
 */
export async function refreshCurrentUser(): Promise<UserRecord | null> {
  const current = getCurrentUser();
  if (!current) return null;
  try {
    const all = await getAllUsers();
    const fresh = all.find(
      (u) =>
        String(u.id) === String(current.id) ||
        (u.email && current.email && u.email.toLowerCase() === current.email.toLowerCase())
    );
    if (fresh) {
      if (fresh.status === "inactive") {
        setCurrentUser(null);
        return null;
      }
      setCurrentUser(fresh);
      return fresh;
    }
  } catch (e) {
    console.warn("Failed to refresh current user session:", e);
  }
  return current;
}
