import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getCurrentUser } from "./authStore";

export interface OnlineUserRecord {
  id: string | number;
  name: string;
  email: string;
  role: string;
  region?: string;
  focalProvince?: string;
  avatar_url?: string;
  auth_provider?: string;
  status: "active" | "inactive";
  lastLogin: string;
  lastActiveAt: string | null;
  lastSeenText: string;
  isOnline: boolean;
  presenceStatus: "online" | "away" | "offline";
  currentPage: string;
  ipAddress?: string;
  clientDevice?: string;
}

export interface PresenceStats {
  totalUsers: number;
  onlineCount: number;
  awayCount: number;
  offlineCount: number;
}

export interface OnlineUsersResponse {
  success: boolean;
  stats: PresenceStats;
  users: OnlineUserRecord[];
  error?: string;
}

/**
 * Send a single presence heartbeat to the server for the current active session
 */
export async function sendHeartbeat(currentPage?: string): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user || !user.email) return false;

    const path = currentPage || (typeof window !== "undefined" ? window.location.pathname : "/overview");

    const res = await fetch("/api/administration/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        region: user.region,
        focalProvince: user.focalProvince,
        avatarUrl: (user as any).avatar_url,
        currentPage: path,
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Notify the server that the user explicitly logged out (sets presence immediately to offline)
 */
export async function notifyLogout(email?: string): Promise<boolean> {
  try {
    const targetEmail = email || getCurrentUser()?.email;
    if (!targetEmail) return false;

    await fetch("/api/administration/logout-heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: targetEmail }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch online users directory and presence stats (Super Admin only: ace.malto@dict.gov.ph)
 */
export async function fetchOnlineUsers(requesterEmail?: string): Promise<OnlineUsersResponse> {
  const email = (requesterEmail || getCurrentUser()?.email || "").toLowerCase().trim();

  try {
    const res = await fetch(`/api/administration/online-users?email=${encodeURIComponent(email)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": email,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        stats: { totalUsers: 0, onlineCount: 0, awayCount: 0, offlineCount: 0 },
        users: [],
        error: data.error || `Server responded with status ${res.status}`,
      };
    }

    return data as OnlineUsersResponse;
  } catch (error: any) {
    return {
      success: false,
      stats: { totalUsers: 0, onlineCount: 0, awayCount: 0, offlineCount: 0 },
      users: [],
      error: error.message || "Network error fetching online users",
    };
  }
}

/**
 * React hook to automatically transmit client presence heartbeat every 30 seconds
 * and whenever the user navigates between pages or refocuses the browser window.
 */
export function usePresenceHeartbeat() {
  const location = useLocation();

  useEffect(() => {
    // Send immediate heartbeat on route transition
    sendHeartbeat(location.pathname);

    // Periodic heartbeat every 30 seconds
    const interval = setInterval(() => {
      sendHeartbeat(window.location.pathname);
    }, 30_000);

    const onFocus = () => {
      sendHeartbeat(window.location.pathname);
    };

    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [location.pathname]);
}
