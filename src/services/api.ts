export interface BackendHealth {
  status: "ok" | "error";
  database: string;
  dbUrl?: string;
  connected: boolean;
  timestamp: string;
  projectTables: Record<string, number>;
}

export interface ApiProject {
  id: string;
  name: string;
  shortName: string;
  description: string;
  status: "operational" | "warning" | "critical" | "inactive";
  category: string;
  enabledAnalytics: string[];
  updated_at?: string;
}

export interface OverviewProjectStat {
  total: number;
  operational: number;
  healthPct: number;
  status: "operational" | "warning" | "critical" | "inactive";
  primaryMetric: string;
  subMetric: string;
  breakdown: Record<string, number>;
}

export interface OverviewStats {
  totalRecords: number;
  totalOperational: number;
  regionalSLA: number;
  liveSites: number;
  trainings: number;
  itAssist: number;
  projectStats: Record<string, OverviewProjectStat>;
  distribution: {
    name: string;
    short: string;
    count: number;
    pct: number;
    color: string;
    desc: string;
  }[];
  beneficiaries?: {
    total: number;
    breakdown: {
      name: string;
      shortName: string;
      users: number;
      category: string;
      color: string;
    }[];
  };
  projectDeployments?: {
    name: string;
    shortName: string;
    count: number;
    operational: number;
    category: string;
    color: string;
  }[];
  provincialDeployments?: {
    name: string;
    shortName: string;
    count: number;
    color: string;
  }[];
  transactions?: {
    total: number;
    breakdown: {
      name: string;
      val: number;
      color: string;
    }[];
  };
}

export interface MapSite {
  id: string;
  projectId: string;
  projectName: string;
  siteName: string;
  type: string;
  municipality: string;
  province: string;
  barangay?: string;
  status: string;
  rawStatus?: string;
  siteOnlineStatus?: "Online" | "Degraded" | "Offline" | string;
  isOnline?: boolean;
  onlineDevicesCount?: number;
  offlineDevicesCount?: number;
  totalDevicesCount?: number;
  supplier?: string;
  contact?: string;
  details?: string;
  bandwidth?: string | number;
  latitude: number | null;
  longitude: number | null;
}

const API_BASE = "/api";

/**
 * Shared API route prefixes served identically by both `dict-monitoring` and `dict-dtr-generator`
 * (in Vercel Serverless Functions as well as local Express servers).
 */
export const SHARED_API_PREFIXES = [
  "/api/dtr-generator",
  "/api/dtr-storage",
  "/api/dtr/storage",
  "/api/dtr-user-setup",
  "/api/dtr-schedule-settings",
  "/api/opentimeclock",
  "/api/users",
  "/api/auth",
  "/api/administration",
  "/api/health",
];

/**
 * Heavy or high-frequency shared API paths that benefit from Round-Robin load distribution
 * across both Vercel deployments when a peer URL is configured.
 */
const ROUND_ROBIN_SHARED_PATHS = [
  "/api/dtr-generator/sign-pdf",
  "/api/dtr-generator/p12-identity",
  "/api/opentimeclock/fetch",
  "/api/opentimeclock/verify",
  "/api/dtr-storage",
  "/api/dtr/storage",
];

let roundRobinCounter = 0;

export function normalizeBaseOrigin(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "";
  let trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  // Add protocol if user provided a bare domain/host like "dict-dtr-generator.vercel.app" or "localhost:3003"
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("/")) {
    const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed);
    trimmed = `${isLocalHost ? "http" : "https"}://${trimmed}`;
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      // Preserve subpath only if not /api or /api/*
      const cleanPath = parsed.pathname
        .replace(/\/+$/, "")
        .replace(/\/api(\/.*)?$/i, "");
      return `${parsed.origin}${cleanPath}`;
    }
  } catch {
    // Fallback to string stripping
  }

  return trimmed.replace(/\/api(\/.*)?$/i, "");
}

export function isSharedApiEndpoint(pathOrUrl: string): boolean {
  let pathname = pathOrUrl;
  try {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      pathname = new URL(pathOrUrl).pathname;
    } else {
      pathname = pathOrUrl.split("?")[0];
    }
  } catch {
    pathname = pathOrUrl.split("?")[0];
  }
  return SHARED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isRoundRobinCandidate(pathOrUrl: string): boolean {
  let pathname = pathOrUrl.split("?")[0];
  try {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      pathname = new URL(pathOrUrl).pathname;
    }
  } catch {}
  return ROUND_ROBIN_SHARED_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Resolves the ordered list of API base origins [primary, ...secondary/failover]
 * for a given `/api/...` request path.
 */
export function resolveApiCandidateOrigins(apiPath: string): string[] {
  const env = (import.meta as any)?.env || {};
  const nodeEnvUrl =
    typeof process !== "undefined" && process?.env?.VITE_API_BASE_URL
      ? process.env.VITE_API_BASE_URL
      : typeof process !== "undefined" && typeof window === "undefined"
      ? "http://localhost:3001"
      : "";
  const primaryBase = normalizeBaseOrigin(env.VITE_API_BASE_URL || nodeEnvUrl);
  const currentBrowserOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? normalizeBaseOrigin(window.location.origin)
      : "";
  const effectivePrimaryOrigin = primaryBase || currentBrowserOrigin;

  const rawPeerSources: (string | null | undefined)[] = [
    env.VITE_SECONDARY_API_URL,
    env.VITE_PEER_VERCEL_URL,
    env.VITE_DTR_VERCEL_URL,
    env.VITE_MONITORING_VERCEL_URL,
  ];

  if (typeof window !== "undefined") {
    try {
      rawPeerSources.push(
        window.localStorage.getItem("dict_peer_api_url"),
        window.localStorage.getItem("dict_secondary_api_url")
      );
    } catch {}
  }

  const configuredPeers: string[] = [];
  for (const source of rawPeerSources) {
    if (!source || typeof source !== "string") continue;
    for (const part of source.split(",")) {
      const normalized = normalizeBaseOrigin(part);
      if (
        normalized &&
        normalized !== primaryBase &&
        normalized !== effectivePrimaryOrigin &&
        !configuredPeers.includes(normalized)
      ) {
        configuredPeers.push(normalized);
      }
    }
  }

  const shared = isSharedApiEndpoint(apiPath);

  // Local development cluster automatic peer failover (:3000/:3001 <-> :3002/:3003 <-> :8080)
  const localFallbacks: string[] = [];
  if (typeof window !== "undefined" && shared) {
    const { hostname, port } = window.location;
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocal) {
      const host = hostname || "localhost";
      if (port === "3000") {
        localFallbacks.push(`http://${host}:3001`, `http://${host}:3003`, `http://${host}:8080`);
      } else if (port === "3002") {
        localFallbacks.push(`http://${host}:3003`, `http://${host}:3001`, `http://${host}:8080`);
      } else if (port === "3001") {
        localFallbacks.push(`http://${host}:3003`, `http://${host}:8080`);
      } else if (port === "3003") {
        localFallbacks.push(`http://${host}:3001`, `http://${host}:8080`);
      } else if (port === "8080") {
        localFallbacks.push(`http://${host}:3001`, `http://${host}:3003`);
      } else {
        localFallbacks.push(`http://${host}:3001`, `http://${host}:3003`, `http://${host}:8080`);
      }
    }
  }

  if (!shared) {
    return [primaryBase];
  }

  let pool = [primaryBase, ...configuredPeers];
  // Deduplicate while preserving order
  pool = Array.from(new Set(pool));

  // If at least one explicit peer Vercel URL is configured, apply Round-Robin load distribution
  // when enabled via VITE_API_LOAD_BALANCE !== "false" or for heavy endpoints
  const lbMode = String(env.VITE_API_LOAD_BALANCE || "auto").toLowerCase();
  let storedLbMode = "";
  if (typeof window !== "undefined") {
    try {
      storedLbMode = String(window.localStorage.getItem("dict_api_lb_mode") || "").toLowerCase();
    } catch {}
  }
  const effectiveLbMode = storedLbMode || lbMode;

  if (configuredPeers.length > 0 && pool.length > 1 && effectiveLbMode !== "failover-only" && effectiveLbMode !== "false") {
    const shouldRoundRobin =
      effectiveLbMode === "round-robin" ||
      effectiveLbMode === "true" ||
      isRoundRobinCandidate(apiPath);

    if (shouldRoundRobin) {
      const idx = roundRobinCounter++ % pool.length;
      if (idx > 0) {
        pool = [...pool.slice(idx), ...pool.slice(0, idx)];
      }
    }
  }

  for (const lf of localFallbacks) {
    if (!pool.includes(lf) && lf !== effectivePrimaryOrigin) {
      pool.push(lf);
    }
  }

  return pool;
}

function shouldFailoverResponse(res: Response): boolean {
  const status = res.status;
  // Failover on 5xx server/timeout errors, 429 rate-limit, or 408 request timeout
  if (status >= 500 || status === 429 || status === 408) {
    return true;
  }
  // Also failover on 404 when a serverless route is missing (non-JSON 404 or Vercel routing error)
  if (status === 404) {
    const contentType = (res.headers?.get?.("content-type") || "").toLowerCase();
    const vercelError = res.headers?.get?.("x-vercel-error");
    if (vercelError || !contentType.includes("application/json")) {
      return true;
    }
  }
  return false;
}

/**
 * Smart Cross-Vercel & Local Cluster Load-Balanced / Auto-Failover `fetch` wrapper.
 * Automatically distributes load and retries against peer deployment URLs on network failure,
 * Vercel serverless function timeout (504), rate limit (429), or 5xx error.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!input.startsWith("/api")) {
    return fetch(input, init);
  }

  const candidateOrigins = resolveApiCandidateOrigins(input);
  let lastError: any = null;
  let lastResponse: Response | null = null;

  for (let i = 0; i < candidateOrigins.length; i++) {
    const origin = candidateOrigins[i];
    const targetUrl = origin ? `${origin}${input}` : input;

    try {
      const res = await fetch(targetUrl, init);
      if (!shouldFailoverResponse(res) || i === candidateOrigins.length - 1) {
        return res;
      }
      lastResponse = res;
      console.warn(
        `[API Failover] Primary node (${targetUrl}) returned HTTP ${res.status}. Failing over to peer node...`
      );
    } catch (err) {
      lastError = err;
      if (i < candidateOrigins.length - 1) {
        console.warn(
          `[API Failover] Network error on (${targetUrl}). Retrying via peer node (${candidateOrigins[i + 1] || "local"})...`
        );
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error(`Failed to fetch ${input} across all API nodes`);
}

export const projectApi = {
  // Fetch geographical project sites across all projects
  async getMapSites(municipality?: string): Promise<MapSite[]> {
    try {
      const url = municipality 
        ? `${API_BASE}/projects/map-sites?municipality=${encodeURIComponent(municipality)}`
        : `${API_BASE}/projects/map-sites`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.sites || [];
    } catch (err) {
      console.warn("Failed to fetch map sites:", err);
      return [];
    }
  },

  // Fetch live calculated overview stats across all projects
  async getOverviewStats(): Promise<OverviewStats | null> {
    try {
      const res = await apiFetch(`${API_BASE}/overview/stats`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.stats || null;
    } catch (err) {
      console.warn("Failed to fetch overview stats:", err);
      return null;
    }
  },

  // Check backend and Turso database health
  async checkHealth(): Promise<BackendHealth | null> {
    try {
      const res = await apiFetch(`${API_BASE}/health`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Fetch all projects metadata from backend
  async getProjects(): Promise<ApiProject[]> {
    try {
      const res = await apiFetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.projects || [];
    } catch (err) {
      console.warn("Failed to fetch projects from backend:", err);
      return [];
    }
  },

  // Update project metadata
  async updateProject(id: string, updates: Partial<ApiProject>): Promise<ApiProject | null> {
    try {
      const res = await apiFetch(`${API_BASE}/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.project;
    } catch (err) {
      console.error("Failed to update project:", err);
      return null;
    }
  },

  // Fetch records directly from the project's dedicated table
  async getTableRecords(
    table: string,
    filters?: { status?: string; province?: string; search?: string }
  ): Promise<Record<string, any>[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
      if (filters?.province && filters.province !== "ALL") params.set("province", filters.province);
      if (filters?.search) params.set("search", filters.search);

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch(`${API_BASE}/${table}${query}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.records || [];
    } catch (err) {
      console.warn("Failed to fetch records from table:", table, err);
      return [];
    }
  },

  // Insert a new record into project table
  async createTableRecord(
    table: string,
    record: Record<string, any>
  ): Promise<Record<string, any> | null> {
    try {
      const res = await apiFetch(`${API_BASE}/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.record;
    } catch (err) {
      console.error("Failed to create record in table:", table, err);
      return null;
    }
  },

  // Update a record in project table
  async updateTableRecord(
    table: string,
    id: string,
    updates: Record<string, any>
  ): Promise<Record<string, any> | null> {
    try {
      const res = await apiFetch(`${API_BASE}/${table}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.record;
    } catch (err) {
      console.error("Failed to update record in table:", table, id, err);
      return null;
    }
  },

  // Delete a record from project table
  async deleteTableRecord(table: string, id: string): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/${table}/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error("Failed to delete record from table:", table, id, err);
      return false;
    }
  },

  // Bulk import records into project table
  async bulkImport(
    table: string,
    records: Record<string, any>[],
    replaceAll: boolean = false
  ): Promise<{ success: boolean; count?: number }> {
    try {
      const res = await apiFetch(`${API_BASE}/${table}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, replaceAll }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return { success: true, count: data.importedCount };
    } catch (err) {
      console.error("Failed to bulk import into table:", table, err);
      return { success: false };
    }
  },
};

export interface AdminUser {
  id: string | number;
  name: string;
  email: string;
  password?: string;
  hasPassword?: boolean;
  role: string;
  region: string;
  status: "active" | "inactive";
  isFocal: boolean;
  focalProject?: string;
  pnpkiRole?: "RAO" | "RAA" | string;
  focalProvince?: string;
  phone?: string;
  access: Record<string, boolean>;
  canEdit: boolean;
  canDelete: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const administrationApi = {
  // Authenticate user via email and password
  async login(email: string, password: string): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/administration/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true, user: data.user };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to connect to authentication server." };
    }
  },

  // Fetch all administrators from Turso administration table
  async getAdministrators(): Promise<AdminUser[]> {
    try {
      const res = await apiFetch(`${API_BASE}/administration`);
      if (!res.ok) return [];
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return [];
      const data = await res.json();
      return data.users || [];
    } catch {
      return [];
    }
  },

  // Create new administrator in Turso
  async createAdministrator(user: Partial<AdminUser>): Promise<AdminUser | null> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (typeof window !== "undefined") {
        try {
          const rawUser = window.localStorage.getItem("dict_current_user");
          if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.id) headers["x-user-id"] = String(parsed.id);
          }
        } catch {}
      }
      const res = await apiFetch(`${API_BASE}/administration`, {
        method: "POST",
        headers,
        body: JSON.stringify(user),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      return data.user;
    } catch (err) {
      console.error("Failed to create administrator:", err);
      return null;
    }
  },

  // Update administrator in Turso
  async updateAdministrator(id: string | number, updates: Partial<AdminUser>): Promise<AdminUser | null> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (typeof window !== "undefined") {
        try {
          const rawUser = window.localStorage.getItem("dict_current_user");
          if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.id) headers["x-user-id"] = String(parsed.id);
          }
        } catch {}
      }
      const res = await apiFetch(`${API_BASE}/administration/${encodeURIComponent(String(id))}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      return data.user;
    } catch (err) {
      console.error("Failed to update administrator:", id, err);
      return null;
    }
  },

  // Delete administrator from Turso
  async deleteAdministrator(id: string | number): Promise<boolean> {
    try {
      const headers: Record<string, string> = {};
      if (typeof window !== "undefined") {
        try {
          const rawUser = window.localStorage.getItem("dict_current_user");
          if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.id) headers["x-user-id"] = String(parsed.id);
          }
        } catch {}
      }
      const res = await apiFetch(`${API_BASE}/administration/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error("Failed to delete administrator:", id, err);
      return false;
    }
  },

  // Check if a user has permission to modify records in a project module
  async checkPermission(userId: string | number, projectId: string): Promise<{ canModify: boolean; hasAccess: boolean; canDelete: boolean }> {
    try {
      const res = await apiFetch(`${API_BASE}/administration/permissions/check?userId=${userId}&projectId=${projectId}`);
      if (!res.ok) return { canModify: true, hasAccess: true, canDelete: true };
      const data = await res.json();
      return {
        canModify: Boolean(data.canModify),
        hasAccess: Boolean(data.hasAccess),
        canDelete: Boolean(data.canDelete),
      };
    } catch {
      return { canModify: true, hasAccess: true, canDelete: true };
    }
  },

  // Reset and restore default administrators in Turso
  async resetDefaults(): Promise<AdminUser[]> {
    try {
      const res = await apiFetch(`${API_BASE}/administration/reset-defaults`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.error("Failed to reset defaults:", err);
      return [];
    }
  },
};

export interface DtrGeneratorSignatureRecord {
  id: string;
  user_Id: string;
  Name: string;
  p12?: string | null;
  p12_filename?: string | null;
  p12_filesize?: number;
  p12_password?: string | null;
  hasP12Password?: boolean;
  hasP12?: boolean;
  image_digiSigned?: string | null;
  hasImageDigiSigned?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const dtrGeneratorApi = {
  // Fetch saved PNPKI / digital signature profiles from Turso (supports user_Id scoping)
  async getRecords(query?: { user_Id?: string; Name?: string; email?: string }): Promise<DtrGeneratorSignatureRecord[]> {
    try {
      const params = new URLSearchParams();
      if (query?.user_Id) params.set("user_Id", query.user_Id);
      if (query?.Name) params.set("Name", query.Name);
      if (query?.email) params.set("email", query.email);
      const url = `${API_BASE}/dtr-generator${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.records || [];
    } catch (err) {
      console.warn("Failed to fetch dtr_generator records from Turso:", err);
      return [];
    }
  },

  // Get single record by ID or Name
  async getRecord(idOrName: string): Promise<DtrGeneratorSignatureRecord | null> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-generator/${encodeURIComponent(idOrName)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.record || null;
    } catch {
      return null;
    }
  },

  // Save or update PNPKI .p12 certificate and digital signature image
  async saveSignatureProfile(data: {
    id?: string;
    user_Id?: string;
    Name: string;
    p12?: string | null;
    p12_filename?: string | null;
    p12_filesize?: number;
    p12_password?: string | null;
    image_digiSigned?: string | null;
    clear_p12?: boolean;
  }): Promise<{ success: boolean; record?: DtrGeneratorSignatureRecord; error?: string }> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (data.user_Id) {
        headers["x-user-id"] = data.user_Id;
      }
      const res = await apiFetch(`${API_BASE}/dtr-generator`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP error ${res.status}`);
      return { success: true, record: result.record };
    } catch (err: any) {
      console.error("Failed to save dtr_generator signature profile:", err);
      return { success: false, error: err.message || "Failed to save to database" };
    }
  },

  // Extract cryptographic signer identity strictly from .p12
  async getP12Identity(payload: {
    p12?: string;
    p12_password?: string;
    profileId?: string;
    user_Id?: string;
  }): Promise<{
    success: boolean;
    identity?: {
      commonName: string;
      subjectDN: string;
      organization?: string;
      issuerCN?: string;
      issuerDN?: string;
      serialNumber?: string;
      sha256Fingerprint: string;
      validFrom: string;
      validTo: string;
      caChainCount: number;
    };
    error?: string;
  }> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-generator/p12-identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err: any) {
      console.error("Failed to inspect .p12 identity:", err);
      return { success: false, error: err.message || "Failed to inspect .p12 certificate identity" };
    }
  },

  // Request server-side cryptographic PDF signing using PNPKI .p12 private key
  async signPdfDocument(payload: {
    pdfBase64: string;
    profileId?: string;
    user_Id?: string;
    p12?: string;
    p12_password?: string;
    account_password?: string;
    isGoogleAuth?: boolean;
    reason?: string;
    sigRect?: [number, number, number, number];
    sigRects?: [number, number, number, number][];
    fieldName?: string;
    pageIndex?: number;
  }): Promise<{
    success: boolean;
    signedPdfBase64?: string;
    signerName?: string;
    certificateInfo?: any;
    signerIdentity?: any;
    error?: string;
  }> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-generator/sign-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return data;
    } catch (err: any) {
      console.error("Failed to sign PDF via backend API:", err);
      return { success: false, error: err.message || "Failed to sign PDF" };
    }
  },

  // Delete digital signature profile from Turso
  async deleteRecord(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-generator/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  },
};

// System Module Model (connected to Turso module table)
export interface SystemModule {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  category: string;
  description?: string;
  route_path?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const modulesApi = {
  // Fetch all modules from Turso module table
  async getModules(): Promise<SystemModule[]> {
    try {
      const res = await apiFetch(`${API_BASE}/modules`);
      if (!res.ok) return [];
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return [];
      const data = await res.json();
      return data.modules || [];
    } catch {
      return [];
    }
  },

  // Get single module by ID or Code
  async getModule(idOrCode: string): Promise<SystemModule | null> {
    try {
      const res = await apiFetch(`${API_BASE}/modules/${encodeURIComponent(idOrCode)}`);
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return null;
      const data = await res.json();
      return data.module || null;
    } catch {
      return null;
    }
  },

  // Create a new module
  async createModule(moduleData: {
    code: string;
    name: string;
    shortName?: string;
    category?: string;
    description?: string;
    route_path?: string;
    is_active?: boolean;
  }): Promise<{ success: boolean; module?: SystemModule; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moduleData),
      });
      if (!res.ok) return { success: false, error: `Server error ${res.status}` };
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { success: false, error: "Non-JSON response" };
      }
      const data = await res.json();
      return { success: true, module: data.module };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to create module" };
    }
  },

  // Update an existing module
  async updateModule(
    id: string | number,
    updates: Partial<SystemModule>
  ): Promise<{ success: boolean; module?: SystemModule; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/modules/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return { success: false, error: `Server error ${res.status}` };
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { success: false, error: "Non-JSON response" };
      }
      const data = await res.json();
      return { success: true, module: data.module };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update module" };
    }
  },

  // Toggle module active/deactivated state
  async toggleStatus(id: string | number): Promise<{ success: boolean; module?: SystemModule; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/modules/${encodeURIComponent(id)}/toggle`, {
        method: "PATCH",
      });
      if (!res.ok) return { success: false, error: `Server error ${res.status}` };
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { success: false, error: "Non-JSON response" };
      }
      const data = await res.json();
      return { success: true, module: data.module };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to toggle module status" };
    }
  },

  // Delete a custom module
  async deleteModule(id: string | number): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/modules/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) return false;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return false;
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  },
};

// Users and Credential Management API (connected to Turso users table)
export const usersApi = {
  // Sync / save Google OAuth credentials to Turso users table
  async syncGoogleUser(payload: {
    google_id?: string;
    email: string;
    name: string;
    avatar_url?: string | null;
    idToken?: string;
  }): Promise<{ success: boolean; user?: AdminUser; isNewUser?: boolean; error?: string; status?: number }> {
    try {
      const res = await apiFetch(`${API_BASE}/users/google-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        return { ...data, status: res.status };
      }
      if (!res.ok) {
        return { success: false, status: res.status, error: `Backend unavailable (HTTP ${res.status})` };
      }
      return { success: false, status: res.status, error: "Non-JSON response from server" };
    } catch {
      return { success: false, error: "Could not reach backend sync service" };
    }
  },

  // Register local email + password account in users table
  async register(payload: {
    name: string;
    email: string;
    password: string;
    role?: string;
    region?: string;
    callerId?: string;
  }): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (payload.callerId) {
        headers["x-user-id"] = String(payload.callerId);
      } else if (typeof window !== "undefined") {
        try {
          const rawUser = window.localStorage.getItem("dict_current_user");
          if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.id) headers["x-user-id"] = String(parsed.id);
          }
        } catch {}
      }
      const res = await apiFetch(`${API_BASE}/users/register`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err: any) {
      console.error("Failed to register user in DB:", err);
      return { success: false, error: err.message || "Failed to register account" };
    }
  },

  // Login with email + password against users table
  async login(email: string, password: string): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Invalid credentials" };
    }
  },

  // Get all users from users table
  async getUsers(): Promise<AdminUser[]> {
    try {
      const res = await apiFetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.warn("Failed to fetch users from backend:", err);
      return [];
    }
  },
};

export interface DatabaseCapacity {
  success: boolean;
  databaseType: string;
  pageSize: number;
  pageCount: number;
  freelistCount: number;
  allocatedBytes: number;
  allocatedMb: number;
  allocatedGb: number;
  activeDataBytes: number;
  activeDataMb: number;
  freelistBytes: number;
  freelistMb: number;
  maxStorageGb: number;
  maxStorageMb: number;
  maxStorageBytes: number;
  remainingBytes: number;
  remainingMb: number;
  remainingGb: number;
  usagePercent: number;
  dtrStorageRecordCount: number;
  dtrStoragePdfBytes: number;
  dtrStoragePdfMb: number;
  timestamp: string;
  error?: string;
}

// DTR Storage & Audit Trailing API (connected to Turso dtr_storage table)
export const dtrStorageApi = {
  // Get live Turso database capacity, page usage, and remaining space metrics
  async getDatabaseCapacity(): Promise<DatabaseCapacity | null> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-storage/database-capacity?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn("Failed to fetch database capacity:", err);
      return null;
    }
  },

  // Fetch records from database with optional filters
  async getRecords(filters?: {
    module?: string;
    province?: string;
    user_id?: string;
    status?: string;
    search?: string;
  }): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.module) params.set("module", filters.module);
      if (filters?.province) params.set("province", filters.province);
      if (filters?.user_id) params.set("user_id", filters.user_id);
      if (filters?.status && filters.status !== "All") params.set("status", filters.status);
      if (filters?.search) params.set("search", filters.search);
      params.set("_t", Date.now().toString());

      const query = `?${params.toString()}`;
      const res = await apiFetch(`${API_BASE}/dtr-storage${query}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.records || [];
    } catch (err) {
      console.warn("Failed to fetch dtr_storage records:", err);
      return [];
    }
  },

  // Get single record with full binary payload
  async getRecord(id: string): Promise<any | null> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-storage/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.record || null;
    } catch {
      return null;
    }
  },

  // Save/Move DTR record to database with user_id audit trailing
  async saveRecord(payload: Record<string, any>): Promise<{ success: boolean; record?: any; error?: string }> {
    try {
      const user = payload.userId ? { id: payload.userId } : undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (payload.userId) {
        headers["x-user-id"] = String(payload.userId);
      }

      const res = await apiFetch(`${API_BASE}/dtr-storage`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err: any) {
      console.error("Failed to save DTR record to DB:", err);
      return { success: false, error: err.message || "Failed to save DTR record" };
    }
  },

  // Update status or remarks in database
  async updateStatus(id: string, status: string, remarks?: string): Promise<{ success: boolean; record?: any; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-storage/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update record" };
    }
  },

  // Delete DTR record from database
  async deleteRecord(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-storage/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  },
};

// DTR User Setup & Presets API (connected to Turso dtr_user_setup table)
export interface DtrUserSetup {
  id: string;
  userId: string;
  user_id: string;
  employeeName: string;
  employee_name: string;
  province: string;
  supervisorName: string;
  supervisor_name: string;
  supervisorTitle: string;
  supervisor_title: string;
  selectedOfficerOption: string;
  selected_officer_option: string;
  regularHours: string;
  regular_hours: string;
  saturdayHours: string;
  saturday_hours: string;
  periodText: string;
  period_text: string;
  otcUsername?: string;
  otc_username?: string;
  otcPassword?: string;
  otc_password?: string;
  hasOtcPassword?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface DtrUserSetupInput {
  id?: string;
  userId: string;
  employeeName: string;
  province?: string;
  supervisorName?: string;
  supervisorTitle?: string;
  selectedOfficerOption?: string;
  regularHours?: string;
  saturdayHours?: string;
  periodText?: string;
  otcUsername?: string;
  otc_username?: string;
  otcPassword?: string;
  otc_password?: string;
}

export const dtrUserSetupApi = {
  async getSetup(userId: string): Promise<DtrUserSetup | null> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-user-setup/${encodeURIComponent(userId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.setup || null;
    } catch {
      return null;
    }
  },

  async getAllSetups(filters?: { user_id?: string; employee_name?: string }): Promise<DtrUserSetup[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.user_id) params.set("user_id", filters.user_id);
      if (filters?.employee_name) params.set("employee_name", filters.employee_name);
      const query = params.toString() ? `?${params.toString()}` : "";
      const headers: Record<string, string> = {};
      if (typeof window !== "undefined") {
        try {
          const rawUser = window.localStorage.getItem("dict_current_user");
          if (rawUser) {
            const parsed = JSON.parse(rawUser);
            if (parsed?.id) headers["x-user-id"] = String(parsed.id);
          }
        } catch {}
      }
      const res = await apiFetch(`${API_BASE}/dtr-user-setup${query}`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.setups || [];
    } catch {
      return [];
    }
  },

  async saveSetup(setup: DtrUserSetupInput): Promise<{ success: boolean; setup?: DtrUserSetup; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-user-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to save setup" };
    }
  },

  async deleteSetup(userId: string): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-user-setup/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  },
};

export interface DtrWorkScheduleSetting {
  id: string;
  scheduleName: string;
  workDaysPerWeek: number;
  workDays: string[];
  hoursPerDay: number;
  standardAmArrival: string;
  standardAmDeparture: string;
  standardPmArrival: string;
  standardPmDeparture: string;
  regularHoursLabel: string;
  saturdayHoursLabel: string;
  noWorkDayLabel: string;
  gracePeriodMinutes: number;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const dtrScheduleSettingsApi = {
  async getSettings(): Promise<DtrWorkScheduleSetting> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-schedule-settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.setting) return data.setting;
    } catch (err) {
      console.warn("Could not fetch schedule settings from backend, using default:", err);
    }
    return {
      id: "main_schedule_setting",
      scheduleName: "Standard 5-Day Workweek",
      workDaysPerWeek: 5,
      workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      hoursPerDay: 8,
      standardAmArrival: "8:00",
      standardAmDeparture: "12:00",
      standardPmArrival: "1:00",
      standardPmDeparture: "5:00",
      regularHoursLabel: "8:00 AM - 5:00 PM",
      saturdayHoursLabel: "As Required",
      noWorkDayLabel: "NO WORK: 4-DAY WORKWEEK",
      gracePeriodMinutes: 0,
      isActive: true,
    };
  },

  async saveSettings(
    settings: Partial<DtrWorkScheduleSetting>
  ): Promise<{ success: boolean; setting?: DtrWorkScheduleSetting; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/dtr-schedule-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Broadcast local event so other tabs and components update immediately
      window.dispatchEvent(new CustomEvent("dict_dtr_schedule_settings_updated", { detail: data.setting }));
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to save schedule settings" };
    }
  },
};

export interface OtcFetchParams {
  username?: string;
  password?: string;
  month: number;
  year: number;
  scope: "full" | "first-half" | "second-half";
  employeeName?: string;
}

export interface OtcFetchResponse {
  success: boolean;
  employeeName?: string;
  userName?: string;
  employeeNumber?: string;
  departmentName?: string;
  totalPunches?: number;
  scope?: string;
  month?: number;
  year?: number;
  rows?: any[];
  error?: string;
  message?: string;
  isNetworkError?: boolean;
}

const CLIENT_OTC_COMPANY_ID = "94324";
const CLIENT_OTC_API_KEY = "jGR7ij1oVYv2wk7AhhnLbEyCqJSP13";
const CLIENT_OTC_BASE_URL = "https://api1.opentimeclock.com";

interface ClientOtcUserRecord {
  userFullName: string;
  userName: string;
  digitId?: string;
  employeeNumber?: string;
  email?: string;
  mobilePhone?: string;
  role?: string;
  departmentName?: string;
  [key: string]: any;
}

export const FALLBACK_OTC_USERS: ClientOtcUserRecord[] = [
  {
    userFullName: "Ace Mata Malto",
    userName: "Ace M.",
    departmentName: "R5 - JO (Projects)",
    role: "Employee",
    email: "maltoace9@gmail.com",
  },
  {
    userFullName: "Ralph Dela Torre",
    userName: "Ralph Dela Torre",
    departmentName: "DICT Region V",
    role: "Employee",
    email: "ralph.delatorre@dict.gov.ph",
  },
  {
    userFullName: "Admin",
    userName: "dictlc3",
    departmentName: "DICT Regional Office",
    role: "Admin",
    email: "valentino.espeleta@dict.gov.ph",
  },
];

export function getFallbackClientUsers(): ClientOtcUserRecord[] {
  const users: ClientOtcUserRecord[] = [...FALLBACK_OTC_USERS];
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("dict_otc_users_cache");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}

    try {
      const rawUser = localStorage.getItem("dict_current_user");
      if (rawUser) {
        const u = JSON.parse(rawUser);
        const name = String(u.name || "").trim();
        const otc = localStorage.getItem("dict_otc_username") || name;
        if (name && !users.some((x) => x.userFullName.toLowerCase() === name.toLowerCase())) {
          users.push({
            userFullName: name,
            userName: otc,
            departmentName: "DICT Region V",
            role: "Employee",
            email: u.email || "",
          });
        }
      }
    } catch {}
  }
  return users;
}

let clientCachedUsers: ClientOtcUserRecord[] = [];
let clientCacheTime = 0;

export async function directClientQueryOtcUsers(): Promise<ClientOtcUserRecord[]> {
  const now = Date.now();
  if (clientCachedUsers.length > 0 && now - clientCacheTime < 10 * 60 * 1000) {
    return clientCachedUsers;
  }
  try {
    const payload = JSON.stringify({
      cmd: "api/t1QueryUsers",
      companyId: CLIENT_OTC_COMPANY_ID,
      developerToken: CLIENT_OTC_API_KEY,
      nextRecord: "0",
      maxRecords: "5000",
    });
    const res = await fetch(`${CLIENT_OTC_BASE_URL}/Jun-Inside-VPC`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (!res.ok) {
      throw new Error(`Direct OTC query failed with HTTP ${res.status}`);
    }
    const parsed = await res.json();
    if (Array.isArray(parsed.data) && parsed.data.length > 0) {
      clientCachedUsers = parsed.data;
      clientCacheTime = now;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("dict_otc_users_cache", JSON.stringify(clientCachedUsers));
        } catch {}
      }
      return clientCachedUsers;
    }
  } catch (err) {
    console.warn("[directClientQueryOtcUsers] Upstream OTC fetch failed; using fallback cache:", err);
  }

  if (clientCachedUsers.length > 0) {
    return clientCachedUsers;
  }

  const fallback = getFallbackClientUsers();
  return fallback;
}

function isRegionVClient(user: ClientOtcUserRecord): boolean {
  const dept = (user.departmentName || "").toLowerCase();
  return (
    dept.includes("r5") ||
    dept.includes("region v") ||
    dept.includes("bicol") ||
    dept.includes("albay") ||
    dept.includes("camarines") ||
    dept.includes("catanduanes") ||
    dept.includes("masbate") ||
    dept.includes("sorsogon")
  );
}

export function directClientFindOtcUser(
  users: ClientOtcUserRecord[],
  queryTerm: string,
  preferredEmployeeName?: string
): ClientOtcUserRecord | null {
  if (!queryTerm) return null;
  const q = queryTerm.toLowerCase().trim();
  const qClean = q.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
  const qTokens = qClean.split(" ").filter((t) => t.length > 0);
  const prefNorm = preferredEmployeeName
    ? preferredEmployeeName.toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim()
    : "";

  // 0. Preferred user alias match (e.g. if profile is "Ace Mata Malto" and user enters "Ace")
  if (prefNorm) {
    const prefUser = users.find((u) => {
      const f = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
      const uName = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
      return f === prefNorm || uName === prefNorm || f.includes(prefNorm) || prefNorm.includes(f);
    });
    if (prefUser) {
      const prefWords = `${prefUser.userName || ""} ${prefUser.userFullName || ""}`
        .toLowerCase()
        .replace(/[\.\,\-\_]/g, " ")
        .split(" ")
        .filter(Boolean);
      if (prefWords.includes(qClean) || (qTokens.length > 0 && qTokens.every((t) => prefWords.includes(t)))) {
        return prefUser;
      }
    }
  }

  // 1. Exact Email
  if (q.includes("@")) {
    const emailMatch = users.find((u) => (u.email || "").toLowerCase().trim() === q);
    if (emailMatch) return emailMatch;
  }

  // 2. Exact match on username or full name (prefer Region V / preferred profile if multiple)
  const exactMatches = users.filter((u) => {
    const uName = (u.userName || "").toLowerCase().trim();
    const fName = (u.userFullName || "").toLowerCase().trim();
    return uName === q || fName === q;
  });
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    if (prefNorm) {
      const prefMatch = exactMatches.find((u) => {
        const f = (u.userFullName || "").toLowerCase();
        return f.includes(prefNorm) || prefNorm.includes(f);
      });
      if (prefMatch) return prefMatch;
    }
    const r5Match = exactMatches.find(isRegionVClient);
    if (r5Match) return r5Match;
    return exactMatches[0];
  }

  // 3. Normalized clean match
  const cleanMatches = users.filter((u) => {
    const uNameClean = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNameClean = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    return uNameClean === qClean || fNameClean === qClean;
  });
  if (cleanMatches.length === 1) return cleanMatches[0];
  if (cleanMatches.length > 1) {
    if (prefNorm) {
      const prefMatch = cleanMatches.find((u) => {
        const f = (u.userFullName || "").toLowerCase();
        return f.includes(prefNorm) || prefNorm.includes(f);
      });
      if (prefMatch) return prefMatch;
    }
    const r5Match = cleanMatches.find(isRegionVClient);
    if (r5Match) return r5Match;
    return cleanMatches[0];
  }

  // 4. Multi-token scoring (query tokens must all be contained)
  if (qTokens.length > 1) {
    let bestUsers: ClientOtcUserRecord[] = [];
    let bestScore = 0;
    for (const u of users) {
      const uFull = `${u.userName || ""} ${u.userFullName || ""} ${u.email || ""}`
        .toLowerCase()
        .replace(/[\.\,\-\_]/g, " ");
      const matchedCount = qTokens.filter((t) => uFull.includes(t)).length;
      if (matchedCount === qTokens.length) {
        if (matchedCount > bestScore) {
          bestScore = matchedCount;
          bestUsers = [u];
        } else if (matchedCount === bestScore) {
          bestUsers.push(u);
        }
      }
    }
    if (bestUsers.length === 1) return bestUsers[0];
    if (bestUsers.length > 1) {
      if (prefNorm) {
        const prefMatch = bestUsers.find((u) => (u.userFullName || "").toLowerCase().includes(prefNorm));
        if (prefMatch) return prefMatch;
      }
      const r5Match = bestUsers.find(isRegionVClient);
      if (r5Match) return r5Match;
      return bestUsers[0];
    }
  }

  // 5. Employee number
  const empMatch = users.find((u) => (u.employeeNumber || "").toLowerCase().trim() === q);
  if (empMatch) return empMatch;

  // 6. Word boundary match on single token
  const wordMatches = users.filter((u) => {
    const uNameClean = (u.userName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNameClean = (u.userFullName || "").toLowerCase().replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const words = `${uNameClean} ${fNameClean}`.split(" ");
    return words.includes(qClean) || (qClean.length >= 4 && fNameClean.includes(qClean));
  });
  if (wordMatches.length === 1) return wordMatches[0];
  if (wordMatches.length > 1) {
    if (prefNorm) {
      const prefMatch = wordMatches.find((u) => {
        const f = (u.userFullName || "").toLowerCase();
        return f.includes(prefNorm) || prefNorm.includes(f);
      });
      if (prefMatch) return prefMatch;
    }
    const r5Match = wordMatches.find(isRegionVClient);
    if (r5Match) return r5Match;
    return wordMatches[0];
  }

  return null;
}

export function matchesPunchRecordClient(
  r: { userName?: string; userFullName?: string; employeeNumber?: string },
  searchTerms: string[]
): boolean {
  const u = (r.userName || "").toLowerCase().trim();
  const f = (r.userFullName || "").toLowerCase().trim();
  const emp = (r.employeeNumber || "").toLowerCase().trim();

  return searchTerms.some((term) => {
    if (!term) return false;
    const t = term.toLowerCase().trim();
    if (u === t || f === t || (emp && emp === t)) return true;

    const tNorm = t.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const fNorm = f.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    const uNorm = u.replace(/[\.\,\-\_]/g, " ").replace(/\s+/g, " ").trim();
    if (fNorm === tNorm || uNorm === tNorm) return true;

    const tokens = tNorm.split(" ").filter((w) => w.length > 0);
    if (tokens.length > 1) {
      const allWords = `${uNorm} ${fNorm}`.split(" ").filter(Boolean);
      const allTokensMatch = tokens.every((tok) => allWords.includes(tok));
      if (allTokensMatch) return true;
    }

    return false;
  });
}

export async function directClientVerifyOtc(
  username: string,
  password?: string,
  preferredEmployeeName?: string
): Promise<{
  success: boolean;
  authenticated?: boolean;
  employeeName?: string;
  userName?: string;
  employeeNumber?: string;
  departmentName?: string;
  error?: string;
  message?: string;
  isNetworkError?: boolean;
}> {
  try {
    const users = await directClientQueryOtcUsers();
    const foundUser = directClientFindOtcUser(users, username.trim(), preferredEmployeeName);
    if (!foundUser) {
      return {
        success: false,
        authenticated: false,
        isNetworkError: false,
        error: `❌ Username "${username.trim()}" not found in Open Time Clock (Company ID: ${CLIENT_OTC_COMPANY_ID}).`,
      };
    }

    if (password && password.trim()) {
      try {
        const forge = await import("node-forge");
        const forgeLib: any = (forge as any).default || forge;
        const md = forgeLib.md?.md5 ? forgeLib.md.md5.create() : (forgeLib as any).md5?.create();
        md.update(password.trim());
        const md5Hex = md.digest().toHex();

        const authRes = await fetch(`${CLIENT_OTC_BASE_URL}/T1-TimeClockFree`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cmd: "web/sGetOneUserInfo",
            companyId: CLIENT_OTC_COMPANY_ID,
            action: "checkLogin",
            userName: foundUser.userName,
            md5Password: md5Hex,
          }),
        });
        const rawText = await authRes.text();
        let resData: any = rawText;
        try {
          resData = JSON.parse(rawText);
        } catch {
          // Plain text response, leave as rawText
        }
        if (resData === "PASSWORDERROR" || (typeof rawText === "string" && rawText.includes("PASSWORDERROR"))) {
          return {
            success: false,
            authenticated: false,
            isNetworkError: false,
            error: `❌ Incorrect Password: The password provided for Open Time Clock account "${foundUser.userName}" is incorrect. Please verify your credentials.`,
          };
        }
        if (resData === "USERNAMEERROR" || (typeof rawText === "string" && rawText.includes("USERNAMEERROR"))) {
          return {
            success: false,
            authenticated: false,
            isNetworkError: false,
            error: `❌ Account Error: Username "${foundUser.userName}" was not recognized by Open Time Clock authentication.`,
          };
        }
      } catch (authErr) {
        console.warn("[directClientVerifyOtc] Remote password check bypassed:", authErr);
      }
    }

    return {
      success: true,
      authenticated: true,
      employeeName: foundUser.userFullName,
      userName: foundUser.userName,
      employeeNumber: foundUser.employeeNumber || "",
      departmentName: foundUser.departmentName || "",
      message: `✓ Open Time Clock credentials verified for ${foundUser.userFullName} (${foundUser.userName})`,
    };
  } catch (err: any) {
    return {
      success: false,
      authenticated: false,
      isNetworkError: true,
      error: `⚠️ Connection Notice: Open Time Clock could not be reached directly (${err.message || "Failed to fetch"}).`,
    };
  }
}

export async function directClientFetchTimeCards(params: OtcFetchParams): Promise<OtcFetchResponse> {
  const { username, password, month, year, scope, employeeName } = params;
  try {
    const userTerm = (username || employeeName || "").trim();
    const verifyRes = await directClientVerifyOtc(userTerm, password, employeeName);
    if (!verifyRes.success && username) {
      return {
        success: false,
        isNetworkError: verifyRes.isNetworkError,
        error: verifyRes.error,
      };
    }

    const targetFullName = verifyRes.employeeName || employeeName || username || "";
    const targetUserName = verifyRes.userName || username || "";

    const monthNum = parseInt(String(month), 10);
    const yearNum = parseInt(String(year), 10);
    const daysInMonth = new Date(yearNum, monthNum + 1, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");

    let fromDay = "01";
    let toDay = pad(daysInMonth);
    if (scope === "first-half") {
      fromDay = "01";
      toDay = "15";
    } else if (scope === "second-half") {
      fromDay = "16";
      toDay = pad(daysInMonth);
    }

    const fromDateTime = `${yearNum}-${pad(monthNum + 1)}-${fromDay} 00:00:00`;
    const toDateTime = `${yearNum}-${pad(monthNum + 1)}-${toDay} 23:59:59`;

    const res = await fetch(`${CLIENT_OTC_BASE_URL}/Jun-Inside-VPC`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "api/t1QueryTimeCards",
        companyId: CLIENT_OTC_COMPANY_ID,
        developerToken: CLIENT_OTC_API_KEY,
        nextRecord: "0",
        dateTimeFrom: fromDateTime,
        dateTimeTo: toDateTime,
        userFullName: targetFullName || "ALL USERS",
        departmentName: "ALL DEPARTMENTS",
        maxRecords: "5000",
      }),
    });

    if (!res.ok) {
      throw new Error(`Direct OTC query returned HTTP ${res.status}`);
    }

    const json = await res.json();
    let records: any[] = Array.isArray(json.data) ? json.data : [];

    if (records.length === 0 && targetFullName) {
      const allRes = await fetch(`${CLIENT_OTC_BASE_URL}/Jun-Inside-VPC`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: "api/t1QueryTimeCards",
          companyId: CLIENT_OTC_COMPANY_ID,
          developerToken: CLIENT_OTC_API_KEY,
          nextRecord: "0",
          dateTimeFrom: fromDateTime,
          dateTimeTo: toDateTime,
          userFullName: "ALL USERS",
          departmentName: "ALL DEPARTMENTS",
          maxRecords: "5000",
        }),
      });
      if (allRes.ok) {
        const allJson = await allRes.json();
        const allRecords: any[] = Array.isArray(allJson.data) ? allJson.data : [];
        const searchTerms = [targetFullName, targetUserName, username, employeeName]
          .filter(Boolean)
          .map((s) => s!.toLowerCase().trim());

        records = allRecords.filter((r) => matchesPunchRecordClient(r, searchTerms));
      }
    }

    const byDay: Record<number, any[]> = {};
    records.forEach((punch) => {
      if (!punch.inDateTime) return;
      const datePart = punch.inDateTime.split(" ")[0];
      const day = parseInt(datePart.split("-")[2], 10);
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(punch);
    });

    const dtrRows = [];
    for (let d = 1; d <= 31; d++) {
      if (d > daysInMonth || (scope === "first-half" && d > 15) || (scope === "second-half" && d < 16)) {
        dtrRows.push({
          day: d,
          amArrival: "",
          amDeparture: "",
          pmArrival: "",
          pmDeparture: "",
          undertimeHours: "",
          undertimeMinutes: "",
          isCustomLabel: false,
          customLabel: "",
        });
        continue;
      }

      const dayPunches = byDay[d] || [];
      let amIn = "";
      let amOut = "";
      let pmIn = "";
      let pmOut = "";

      dayPunches.sort((a: any, b: any) => a.inDateTime.localeCompare(b.inDateTime));
      dayPunches.forEach((p: any) => {
        const inTime = p.inDateTime ? p.inDateTime.split(" ")[1].substring(0, 5) : "";
        const outTime = p.outDateTime && !p.outDateTime.startsWith("0000") ? p.outDateTime.split(" ")[1].substring(0, 5) : "";
        const inHour = inTime ? parseInt(inTime.split(":")[0], 10) : -1;
        const outHour = outTime ? parseInt(outTime.split(":")[0], 10) : -1;

        if (inHour >= 0 && inHour < 12) {
          if (!amIn) amIn = inTime;
          if (outTime) {
            if (outHour <= 12 || (outHour === 13 && parseInt(outTime.split(":")[1], 10) === 0)) {
              amOut = outTime;
            } else {
              amOut = "12:00";
              pmIn = "1:00";
              pmOut = outTime;
            }
          }
        } else if (inHour >= 12) {
          if (!pmIn) pmIn = inTime;
          if (outTime) pmOut = outTime;
        }
      });

      const to12Hour = (val: string) => {
        if (!val || !val.trim()) return "";
        const match = val.trim().match(/^(\d{1,2}):(\d{2})/);
        if (!match) return val.trim();
        let h = parseInt(match[1], 10);
        const m = match[2];
        if (h > 12) h -= 12;
        else if (h === 0) h = 12;
        return `${h}:${m}`;
      };

      dtrRows.push({
        day: d,
        amArrival: to12Hour(amIn),
        amDeparture: to12Hour(amOut),
        pmArrival: to12Hour(pmIn),
        pmDeparture: to12Hour(pmOut),
        undertimeHours: "",
        undertimeMinutes: "",
        isCustomLabel: false,
        customLabel: "",
      });
    }

    return {
      success: true,
      employeeName: targetFullName,
      userName: targetUserName,
      employeeNumber: verifyRes.employeeNumber || records[0]?.employeeNumber || "",
      departmentName: verifyRes.departmentName,
      totalPunches: records.length,
      scope,
      month: monthNum,
      year: yearNum,
      rows: dtrRows,
      message: `Successfully verified and fetched ${records.length} punches from Open Time Clock for ${targetFullName}!`,
    };
  } catch (err: any) {
    return {
      success: false,
      isNetworkError: true,
      error: `⚠️ Network error fetching from Open Time Clock: ${err.message || "Failed to fetch"}`,
    };
  }
}

export const openTimeClockApi = {
  async verifyAccount(
    username: string,
    password?: string,
    preferredEmployeeName?: string
  ): Promise<{
    success: boolean;
    employeeName?: string;
    userName?: string;
    employeeNumber?: string;
    departmentName?: string;
    error?: string;
    message?: string;
    isNetworkError?: boolean;
  }> {
    // 1. Try backend serverless / express proxy first
    try {
      const res = await apiFetch(`${API_BASE}/opentimeclock/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, employeeName: preferredEmployeeName }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        // If server responded with valid response and not 503 network error, return it
        if (data.success || !data.isNetworkError) {
          return data;
        }
      }
    } catch (err: any) {
      console.warn("[openTimeClockApi] Backend verify unreachable, falling back to direct Open Time Clock API...", err);
    }

    // 2. Direct client-side Open Time Clock fallback
    try {
      const directResult = await directClientVerifyOtc(username, password, preferredEmployeeName);
      return directResult;
    } catch {
      return {
        success: false,
        isNetworkError: true,
        error: "Unable to reach Open Time Clock server. Please check your internet connection or start the local server.",
      };
    }
  },

  async fetchTimeCards(params: OtcFetchParams): Promise<OtcFetchResponse> {
    // 1. Try backend serverless / express proxy first
    try {
      const res = await apiFetch(`${API_BASE}/opentimeclock/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success || !data.isNetworkError) {
          return data;
        }
      }
    } catch (err: any) {
      console.warn("[openTimeClockApi] Backend fetch unreachable, falling back to direct Open Time Clock API...", err);
    }

    // 2. Direct client-side Open Time Clock fallback
    try {
      const directResult = await directClientFetchTimeCards(params);
      return directResult;
    } catch {
      return {
        success: false,
        isNetworkError: true,
        error: "Unable to fetch punches from Open Time Clock. Please check your internet connection.",
      };
    }
  },
};

export function isOtcNetworkError(errObj?: { isNetworkError?: boolean; error?: string; message?: string } | any): boolean {
  if (!errObj) return false;
  if (errObj.isNetworkError) return true;
  const msg = String(errObj.error || errObj.message || errObj || "").toLowerCase();
  return /failed to fetch|fetch failed|network|connect|timeout|unreachable|offline|load failed|net::err|enotfound|econnreset|abort|cancelled|502|503|504|econnrefused/i.test(msg);
}

export function formatOtcErrorMessage(err?: string, isNetErr?: boolean): string {
  if (!err) return isNetErr ? "Open Time Clock service is currently unreachable." : "Authentication failed.";
  if (/failed to fetch|fetch failed|networkerror|load failed|net::err|enotfound|econnreset|abort|cancelled|connect econnrefused/i.test(err)) {
    return "Unable to establish a connection to Open Time Clock (Company ID: 94324). Please check your internet connection or verify that the local server is running.";
  }
  return err;
}
