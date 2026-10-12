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
  const primaryBase = normalizeBaseOrigin(env.VITE_API_BASE_URL);
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
      if (port === "3000" || port === "3001") {
        localFallbacks.push(`http://${host}:3003`, `http://${host}:8080`);
      } else if (port === "3002" || port === "3003") {
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
      console.warn(`Failed to fetch records from table "${table}":`, err);
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
      console.error(`Failed to create record in table "${table}":`, err);
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
      console.error(`Failed to update record ${id} in table "${table}":`, err);
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
      console.error(`Failed to delete record ${id} from table "${table}":`, err);
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
      console.error(`Failed to bulk import into table "${table}":`, err);
      return { success: false };
    }
  },
};

export interface AdminUser {
  id: string | number;
  name: string;
  email: string;
  password?: string;
  role: string;
  region: string;
  status: "active" | "inactive";
  isFocal: boolean;
  focalProject?: string;
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
      const res = await apiFetch(`${API_BASE}/administration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
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
      const res = await apiFetch(`${API_BASE}/administration/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.user;
    } catch (err) {
      console.error(`Failed to update administrator ${id}:`, err);
      return null;
    }
  },

  // Delete administrator from Turso
  async deleteAdministrator(id: string | number): Promise<boolean> {
    try {
      const res = await apiFetch(`${API_BASE}/administration/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return Boolean(data.success);
    } catch (err) {
      console.error(`Failed to delete administrator ${id}:`, err);
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
  }): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

// DTR Storage & Audit Trailing API (connected to Turso dtr_storage table)
export const dtrStorageApi = {
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
      const res = await apiFetch(`${API_BASE}/dtr-user-setup${query}`);
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
  totalPunches?: number;
  scope?: string;
  month?: number;
  year?: number;
  rows?: any[];
  error?: string;
  message?: string;
}

export const openTimeClockApi = {
  async verifyAccount(
    username: string,
    password?: string
  ): Promise<{ success: boolean; employeeName?: string; userName?: string; error?: string; message?: string }> {
    try {
      const res = await apiFetch(`${API_BASE}/opentimeclock/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        return {
          success: false,
          error: `API returned unexpected response (${res.status} ${res.statusText}): ${text.slice(0, 150)}`,
        };
      }
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to verify Open Time Clock account" };
    }
  },

  async fetchTimeCards(params: OtcFetchParams): Promise<OtcFetchResponse> {
    try {
      const res = await apiFetch(`${API_BASE}/opentimeclock/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        return {
          success: false,
          error: `API returned unexpected response (${res.status} ${res.statusText}): ${text.slice(0, 150)}`,
        };
      }
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to fetch time cards from Open Time Clock" };
    }
  },
};




