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
  contact?: string;
  details?: string;
  bandwidth?: string | number;
  latitude: number | null;
  longitude: number | null;
}

const API_BASE = "/api";

export const projectApi = {
  // Fetch geographical project sites across all projects
  async getMapSites(municipality?: string): Promise<MapSite[]> {
    try {
      const url = municipality 
        ? `${API_BASE}/projects/map-sites?municipality=${encodeURIComponent(municipality)}`
        : `${API_BASE}/projects/map-sites`;
      const res = await fetch(url);
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
      const res = await fetch(`${API_BASE}/overview/stats`);
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
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Fetch all projects metadata from backend
  async getProjects(): Promise<ApiProject[]> {
    try {
      const res = await fetch(`${API_BASE}/projects`);
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
      const res = await fetch(`${API_BASE}/projects/${id}`, {
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
      const res = await fetch(`${API_BASE}/${table}${query}`);
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
      const res = await fetch(`${API_BASE}/${table}`, {
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
      const res = await fetch(`${API_BASE}/${table}/${id}`, {
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
      const res = await fetch(`${API_BASE}/${table}/${id}`, {
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
      const res = await fetch(`${API_BASE}/${table}/bulk`, {
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
      const res = await fetch(`${API_BASE}/administration/login`, {
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
      const res = await fetch(`${API_BASE}/administration`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.users || [];
    } catch (err) {
      console.warn("Failed to fetch administration users from backend:", err);
      return [];
    }
  },

  // Create new administrator in Turso
  async createAdministrator(user: Partial<AdminUser>): Promise<AdminUser | null> {
    try {
      const res = await fetch(`${API_BASE}/administration`, {
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
      const res = await fetch(`${API_BASE}/administration/${id}`, {
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
      const res = await fetch(`${API_BASE}/administration/${id}`, {
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
      const res = await fetch(`${API_BASE}/administration/permissions/check?userId=${userId}&projectId=${projectId}`);
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
      const res = await fetch(`${API_BASE}/administration/reset-defaults`, {
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
      const res = await fetch(url);
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
      const res = await fetch(`${API_BASE}/dtr-generator/${encodeURIComponent(idOrName)}`);
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
  }): Promise<{ success: boolean; record?: DtrGeneratorSignatureRecord; error?: string }> {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (data.user_Id) {
        headers["x-user-id"] = data.user_Id;
      }
      const res = await fetch(`${API_BASE}/dtr-generator`, {
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
      const res = await fetch(`${API_BASE}/dtr-generator/p12-identity`, {
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
      const res = await fetch(`${API_BASE}/dtr-generator/sign-pdf`, {
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
      const res = await fetch(`${API_BASE}/dtr-generator/${encodeURIComponent(id)}`, {
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
      const res = await fetch(`${API_BASE}/modules`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.modules || [];
    } catch (err) {
      console.warn("Failed to fetch modules from Turso:", err);
      return [];
    }
  },

  // Get single module by ID or Code
  async getModule(idOrCode: string): Promise<SystemModule | null> {
    try {
      const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(idOrCode)}`);
      if (!res.ok) return null;
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
      const res = await fetch(`${API_BASE}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moduleData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return { success: true, module: data.module };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to create module" };
    }
  },

  // Update an existing module
  async updateModule(
    id: string,
    updates: Partial<SystemModule>
  ): Promise<{ success: boolean; module?: SystemModule; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return { success: true, module: data.module };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update module" };
    }
  },

  // Toggle module active/deactivated state
  async toggleStatus(id: string): Promise<{ success: boolean; module?: SystemModule; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(id)}/toggle`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return { success: true, module: data.module };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to toggle module status" };
    }
  },

  // Delete a custom module
  async deleteModule(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/modules/${encodeURIComponent(id)}`, {
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

// Users and Credential Management API (connected to Turso users table)
export const usersApi = {
  // Sync / save Google OAuth credentials to Turso users table
  async syncGoogleUser(payload: {
    google_id?: string;
    email: string;
    name: string;
    avatar_url?: string | null;
  }): Promise<{ success: boolean; user?: AdminUser; isNewUser?: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_BASE}/users/google-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
      return data;
    } catch (err: any) {
      console.error("Failed to sync Google user to DB:", err);
      return { success: false, error: err.message || "Failed to sync Google user" };
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
      const res = await fetch(`${API_BASE}/users/register`, {
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
      const res = await fetch(`${API_BASE}/users/login`, {
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
      const res = await fetch(`${API_BASE}/users`);
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

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/dtr-storage${query}`);
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
      const res = await fetch(`${API_BASE}/dtr-storage/${encodeURIComponent(id)}`);
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

      const res = await fetch(`${API_BASE}/dtr-storage`, {
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
      const res = await fetch(`${API_BASE}/dtr-storage/${encodeURIComponent(id)}`, {
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
      const res = await fetch(`${API_BASE}/dtr-storage/${encodeURIComponent(id)}`, {
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



