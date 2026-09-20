export interface OmadaSupplierConfig {
  id: "supplier1" | "supplier2";
  name: string;
  baseUrl: string;
  omadaId: string;
  clientId: string;
  clientSecret: string;
  enabled: boolean;
  lastSync?: string;
}

export interface OmadaConfig {
  supplier1: OmadaSupplierConfig;
  supplier2: OmadaSupplierConfig;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
}

export interface OmadaDevice {
  mac: string;
  name: string;
  model: string;
  modelName: string;
  type: string; // 'gateway' | 'ap' | 'switch'
  ip: string;
  publicIp?: string;
  sn?: string;
  firmwareVersion?: string;
  status: number;
  active: boolean;
  lastSeen?: number;
  siteId: string;
  supplierId: "supplier1" | "supplier2";
}

export interface OmadaSite {
  siteId: string;
  name: string;
  supplierId: "supplier1" | "supplier2";
  supplierName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  scenario?: string;
  sitePublicIp?: string;
  devices?: OmadaDevice[];
  deviceCount?: number;
  apCount?: number;
  gatewayCount?: number;
  switchCount?: number;
  clients?: any;
  status?: string;
}

export interface OmadaSyncResult {
  success: boolean;
  totalOmadaSites: number;
  matchedDbRecords: number;
  updatedRecords: number;
  newRecordsCreated: number;
  supplier1Count: number;
  supplier2Count: number;
  timestamp: string;
  details: {
    matched: string[];
    unmatchedOmada: string[];
  };
}

export interface OmadaOverview {
  supplier1: { count: number; enabled: boolean; lastSync?: string };
  supplier2: { count: number; enabled: boolean; lastSync?: string };
  totalSites: number;
  estimatedAps: number;
  onlineStatus: string;
}

const API_BASE = "/api/omada";

export const omadaApi = {
  /**
   * Get current configuration for Supplier 1 and 2
   */
  async getConfig(): Promise<OmadaConfig | null> {
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.config || null;
    } catch (e) {
      console.warn("Failed to fetch Omada config:", e);
      return null;
    }
  },

  /**
   * Save / update Omada configuration
   */
  async updateConfig(updates: Partial<OmadaConfig>): Promise<{ success: boolean; config?: OmadaConfig; message?: string }> {
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP error ${res.status}`);
      }
      return { success: true, config: data.config, message: data.message };
    } catch (e: any) {
      console.error("Failed to update Omada config:", e);
      return { success: false, message: e.message || "Failed to update configuration" };
    }
  },

  /**
   * Test connection to a specific supplier
   */
  async testConnection(supplierConfig: OmadaSupplierConfig): Promise<{
    success: boolean;
    siteCount?: number;
    sites?: any[];
    message?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierConfig),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return {
        success: false,
        message: e.message || "Network error while testing connection",
      };
    }
  },

  /**
   * Fetch all live Omada sites across suppliers
   */
  async getSites(includeDevices = false): Promise<OmadaSite[]> {
    try {
      const res = await fetch(`${API_BASE}/sites?includeDevices=${includeDevices}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return data.sites || [];
    } catch (e) {
      console.warn("Failed to fetch Omada sites:", e);
      return [];
    }
  },

  /**
   * Fetch devices and client stat for a specific site
   */
  async getSiteDevices(
    supplierId: "supplier1" | "supplier2",
    siteId: string
  ): Promise<{ devices: OmadaDevice[]; clients?: any }> {
    try {
      const res = await fetch(`${API_BASE}/sites/${supplierId}/${encodeURIComponent(siteId)}/devices`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      return {
        devices: data.devices || [],
        clients: data.clients || null,
      };
    } catch (e) {
      console.warn(`Failed to fetch devices for ${siteId}:`, e);
      return { devices: [] };
    }
  },

  /**
   * Trigger immediate sync between Omada and Turso Free Wi-Fi database
   */
  async syncNow(): Promise<OmadaSyncResult | null> {
    try {
      const res = await fetch(`${API_BASE}/sync`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error("Failed to run Omada sync:", e);
      return null;
    }
  },

  /**
   * Fetch Omada overview statistics
   */
  async getOverview(): Promise<OmadaOverview | null> {
    try {
      const res = await fetch(`${API_BASE}/overview`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.overview || null;
    } catch {
      return null;
    }
  },
};
