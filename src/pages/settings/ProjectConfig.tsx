import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FolderKanban,
  Search,
  Plus,
  Settings2,
  Download,
  Upload,
  Database,
  Edit,
  Trash2,
  Check,
  AlertTriangle,
  RotateCcw,
  Wifi,
  Building2,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Radio,
  Server,
  Globe,
  FileSpreadsheet,
  FileJson,
  X,
  Eye,
  Filter,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  Activity,
  Sliders,
  Lock,
  Shield,
  UserCheck,
  Key,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  EyeOff,
  ChevronUp
} from "lucide-react";
import { PROJECT_SCHEMAS, ProjectSchema } from "@/data/projectDataStore";
import { PROJECTS, Project, getStoredProjects, saveStoredProjects, updateProjectSetting } from "@/config/projects";
import { projectApi, BackendHealth, administrationApi, AdminUser, modulesApi, SystemModule } from "@/services/api";
import { omadaApi, OmadaConfig, OmadaSupplierConfig, OmadaSyncResult } from "@/services/omadaApi";
import { getCurrentUser, hasModuleAccess, AUTH_EVENT } from "@/services/authStore";
import { getStoredUsers } from "@/data/userStore";

// Icon mapping
const ICONS: Record<string, React.ElementType> = {
  Wifi,
  Building2,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Radio,
  Server,
  Globe,
  FolderKanban,
  Database,
};

export function ProjectConfig() {
  // Stored project metadata list
  const [projectList, setProjectList] = useState<Project[]>(() => getStoredProjects());
  const [systemModules, setSystemModules] = useState<SystemModule[]>([]);

  // Load modules from Turso module table & listen for live module modifications
  useEffect(() => {
    const fetchModules = () => {
      modulesApi.getModules().then((list) => {
        if (list && list.length > 0) setSystemModules(list);
      });
    };
    fetchModules();
    window.addEventListener("dict_modules_updated", fetchModules);
    return () => window.removeEventListener("dict_modules_updated", fetchModules);
  }, []);

  // Listen for external project updates
  useEffect(() => {
    const handleMetaUpdate = () => {
      setProjectList(getStoredProjects());
    };
    window.addEventListener("dict_projects_meta_updated", handleMetaUpdate);
    return () => window.removeEventListener("dict_projects_meta_updated", handleMetaUpdate);
  }, []);

  const schemaKeys = Object.keys(PROJECT_SCHEMAS);
  
  // Current active user from authentication session
  const [currentUser, setCurrentUserSession] = useState(() => getCurrentUser());
  const [administrators, setAdministrators] = useState<AdminUser[]>([]);
  const [activeAdminUser, setActiveAdminUser] = useState<AdminUser | null>(null);

  // Listen for auth change events so permissions and project access update reactively without reloading!
  useEffect(() => {
    const handleAuthChange = (e?: Event) => {
      const customEv = e as CustomEvent<any>;
      const detailUser = customEv?.detail;
      const user = getCurrentUser();
      setCurrentUserSession(user);

      if (detailUser && detailUser.id) {
        setAdministrators((prev) =>
          prev.map((u) => (String(u.id) === String(detailUser.id) ? { ...u, ...detailUser } : u))
        );
      }

      if (user) {
        setActiveAdminUser((prev) => {
          if (!prev) return user as any;
          if (String(prev.id) === String(user.id) || prev.email?.toLowerCase() === user.email?.toLowerCase()) {
            return { ...prev, ...user } as any;
          }
          if (detailUser && String(prev.id) === String(detailUser.id)) {
            return { ...prev, ...detailUser } as any;
          }
          return prev;
        });
      }
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("dict_users_updated", handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("dict_users_updated", handleAuthChange);
    };
  }, []);

  // Load administrators from Turso administration table
  useEffect(() => {
    administrationApi.getAdministrators().then((users) => {
      if (Array.isArray(users)) {
        setAdministrators(users);
        const loggedIn = getCurrentUser();
        const matched = loggedIn
          ? users.find(
              (u) => String(u.id) === String(loggedIn.id) || u.email?.toLowerCase() === loggedIn.email?.toLowerCase()
            )
          : null;
        setActiveAdminUser(matched || (loggedIn as any) || users[0] || null);
      }
    });
  }, []);

  const effectiveUser = activeAdminUser || (currentUser as any);

  // Authorized project keys:
  // Strictly respects the user's granted project modules!
  // If user only has access to eLGU, only eLGU appears here.
  // If user has Grant All or full permissions, all granted projects appear.
  const authorizedSchemaKeys = useMemo(() => {
    if (!effectiveUser) return schemaKeys;

    return schemaKeys.filter((key) => {
      return (
        hasModuleAccess(effectiveUser, key) ||
        hasModuleAccess(effectiveUser, `MOD_${key.toUpperCase()}`) ||
        hasModuleAccess(effectiveUser, `mod-${key}`)
      );
    });
  }, [effectiveUser, schemaKeys]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return authorizedSchemaKeys[0] || "freewifi";
  });

  // Automatically ensure selectedProjectId is always one of the authorized project keys
  useEffect(() => {
    if (authorizedSchemaKeys.length > 0 && !authorizedSchemaKeys.includes(selectedProjectId)) {
      setSelectedProjectId(authorizedSchemaKeys[0]);
    }
  }, [authorizedSchemaKeys, selectedProjectId]);
  
  // Active schema
  const activeSchema: ProjectSchema = PROJECT_SCHEMAS[selectedProjectId] || PROJECT_SCHEMAS.freewifi;

  // Active project metadata from settings
  const activeProjectMeta = useMemo(() => {
    return projectList.find((p) => p.id === selectedProjectId) || {
      id: activeSchema.id,
      name: activeSchema.name,
      shortName: activeSchema.shortName,
      description: activeSchema.description,
      status: "operational" as const,
      category: activeSchema.category,
      enabledAnalytics: [],
    };
  }, [projectList, selectedProjectId, activeSchema]);

  // Current system module from Turso module table
  const currentSystemModule = useMemo(() => {
    return (
      systemModules.find(
        (m) =>
          m.route_path === `/projects/${selectedProjectId}` ||
          m.id === `mod-${selectedProjectId}` ||
          m.code.toLowerCase() === `mod_${selectedProjectId.toLowerCase()}` ||
          m.shortName?.toLowerCase() === selectedProjectId.toLowerCase()
      ) || null
    );
  }, [systemModules, selectedProjectId]);

  // Master records dictionary stored in localStorage
  const [recordsStore, setRecordsStore] = useState<Record<string, Record<string, any>[]>>(() => {
    try {
      const saved = localStorage.getItem("dict_project_data_store_v1");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load project records store", e);
    }
    
    // Default initial store
    const initial: Record<string, Record<string, any>[]> = {};
    schemaKeys.forEach((key) => {
      initial[key] = [];
    });
    return initial;
  });

  // Save to localStorage and dispatch event for all listening components
  useEffect(() => {
    try {
      localStorage.setItem("dict_project_data_store_v1", JSON.stringify(recordsStore));
      window.dispatchEvent(new CustomEvent("dict_project_data_updated", { detail: { recordsStore, projectId: selectedProjectId, source: "project_config" } }));
      window.dispatchEvent(new CustomEvent("dict_records_updated", { detail: { projectId: selectedProjectId, source: "project_config", timestamp: Date.now() } }));
      if (selectedProjectId === "freewifi") {
        window.dispatchEvent(new CustomEvent("dict_freewifi_updated", { detail: { source: "project_config", timestamp: Date.now() } }));
      }
    } catch (e) {
      console.error("Failed to save project records store", e);
    }
  }, [recordsStore, selectedProjectId]);

  // Backend & Turso health check state
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  // Check backend health & Turso connection on mount
  useEffect(() => {
    projectApi.checkHealth().then((h) => {
      if (h) setBackendHealth(h);
    });
  }, []);

  // Check if active user has project view access
  const userHasAccess = useMemo(() => {
    if (!effectiveUser) return false;
    return (
      hasModuleAccess(effectiveUser, selectedProjectId) ||
      hasModuleAccess(effectiveUser, `MOD_${selectedProjectId.toUpperCase()}`) ||
      hasModuleAccess(effectiveUser, `mod-${selectedProjectId}`)
    );
  }, [effectiveUser, selectedProjectId]);

  // Check if active user can edit and modify this module
  const userCanModify = useMemo(() => {
    if (!effectiveUser) return false;
    if (effectiveUser.status === "inactive") return false;
    const canEditFlag = effectiveUser.canEdit !== undefined ? Boolean(effectiveUser.canEdit) : effectiveUser.role !== "Viewer";
    return canEditFlag && userHasAccess;
  }, [effectiveUser, userHasAccess]);

  // Check if active user can delete records
  const userCanDelete = useMemo(() => {
    if (!effectiveUser) return false;
    if (effectiveUser.status === "inactive") return false;
    const canDeleteFlag =
      effectiveUser.canDelete !== undefined
        ? Boolean(effectiveUser.canDelete)
        : effectiveUser.role === "Super Admin" || effectiveUser.role === "Regional Director";
    return canDeleteFlag && userHasAccess;
  }, [effectiveUser, userHasAccess]);

  // Sync records directly from the project's Turso database table
  useEffect(() => {
    let active = true;
    projectApi.getTableRecords(selectedProjectId).then((records) => {
      if (active && Array.isArray(records)) {
        setRecordsStore((prev) => ({
          ...prev,
          [selectedProjectId]: records,
        }));
      }
    });
    return () => {
      active = false;
    };
  }, [selectedProjectId]);

  // Listen for external database updates (e.g. from Dashboard sync or background auto-sync)
  useEffect(() => {
    const handleExternalDataUpdate = (e: any) => {
      const customEv = e as CustomEvent<any>;
      // Skip if event originated from this ProjectConfig instance to prevent double reload loops
      if (customEv?.detail?.source === "project_config") return;

      const targetProj = customEv?.detail?.projectId;
      if (!targetProj || targetProj === selectedProjectId) {
        projectApi.getTableRecords(selectedProjectId).then((records) => {
          if (Array.isArray(records)) {
            setRecordsStore((prev) => ({
              ...prev,
              [selectedProjectId]: records,
            }));
          }
        });
      }
    };

    window.addEventListener("dict_records_updated", handleExternalDataUpdate);
    window.addEventListener("dict_freewifi_updated", handleExternalDataUpdate);
    return () => {
      window.removeEventListener("dict_records_updated", handleExternalDataUpdate);
      window.removeEventListener("dict_freewifi_updated", handleExternalDataUpdate);
    };
  }, [selectedProjectId]);

  // Current project records
  const currentRecords = useMemo(() => {
    return recordsStore[selectedProjectId] || [];
  }, [recordsStore, selectedProjectId]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [provinceFilter, setProvinceFilter] = useState<string>("ALL");

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Project Settings Modal State
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [projectSettingsForm, setProjectSettingsForm] = useState({
    name: "",
    shortName: "",
    category: "",
    status: "operational" as "operational" | "warning" | "critical" | "inactive",
    description: "",
  });

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRawText, setImportRawText] = useState("");
  const [importFormat, setImportFormat] = useState<"csv" | "json">("json");
  const [importError, setImportError] = useState<string | null>(null);

  const [isViewDetailOpen, setIsViewDetailOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<Record<string, any> | null>(null);

  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Omada Northbound API Configuration State (Free Wi-Fi Module)
  const [omadaConfig, setOmadaConfig] = useState<OmadaConfig | null>(null);
  const [isOmadaConfigExpanded, setIsOmadaConfigExpanded] = useState(true);
  const [isSavingOmada, setIsSavingOmada] = useState(false);
  const [isTestingSupplier1, setIsTestingSupplier1] = useState(false);
  const [isTestingSupplier2, setIsTestingSupplier2] = useState(false);
  const [isSyncingOmada, setIsSyncingOmada] = useState(false);
  const [testResult1, setTestResult1] = useState<{ success: boolean; message: string; siteCount?: number } | null>(null);
  const [testResult2, setTestResult2] = useState<{ success: boolean; message: string; siteCount?: number } | null>(null);
  const [showSecret1, setShowSecret1] = useState(false);
  const [showSecret2, setShowSecret2] = useState(false);
  const [syncSummary, setSyncSummary] = useState<OmadaSyncResult | null>(null);

  // Load Omada config when Free Wi-Fi module is active
  useEffect(() => {
    if (selectedProjectId === "freewifi") {
      omadaApi.getConfig().then((cfg) => {
        if (cfg) setOmadaConfig(cfg);
      });
    }
  }, [selectedProjectId]);

  // Test connection to Supplier 1
  const handleTestSupplier1 = async () => {
    if (!omadaConfig) return;
    setIsTestingSupplier1(true);
    setTestResult1(null);
    try {
      const res = await omadaApi.testConnection(omadaConfig.supplier1);
      setTestResult1({
        success: res.success,
        message: res.message || (res.success ? "Connection successful!" : "Connection failed"),
        siteCount: res.siteCount,
      });
      if (res.success) {
        showNotification(`Supplier 1 Connected! Found ${res.siteCount || 0} sites in Omada Controller.`);
      } else {
        showNotification(`Supplier 1 Connection Failed: ${res.message}`, "error");
      }
    } catch (e: any) {
      setTestResult1({ success: false, message: e.message || "Network error" });
      showNotification(`Supplier 1 Connection Error: ${e.message}`, "error");
    } finally {
      setIsTestingSupplier1(false);
    }
  };

  // Test connection to Supplier 2
  const handleTestSupplier2 = async () => {
    if (!omadaConfig) return;
    setIsTestingSupplier2(true);
    setTestResult2(null);
    try {
      const res = await omadaApi.testConnection(omadaConfig.supplier2);
      setTestResult2({
        success: res.success,
        message: res.message || (res.success ? "Connection successful!" : "Connection failed"),
        siteCount: res.siteCount,
      });
      if (res.success) {
        showNotification(`Supplier 2 Connected! Found ${res.siteCount || 0} sites in Omada Controller.`);
      } else {
        showNotification(`Supplier 2 Connection Failed: ${res.message}`, "error");
      }
    } catch (e: any) {
      setTestResult2({ success: false, message: e.message || "Network error" });
      showNotification(`Supplier 2 Connection Error: ${e.message}`, "error");
    } finally {
      setIsTestingSupplier2(false);
    }
  };

  // Save Omada credentials & settings
  const handleSaveOmadaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!omadaConfig || !userCanModify) return;
    setIsSavingOmada(true);
    try {
      const res = await omadaApi.updateConfig(omadaConfig);
      if (res.success && res.config) {
        setOmadaConfig(res.config);
        showNotification("Omada Northbound API credentials and settings saved successfully!");
      } else {
        showNotification(res.message || "Failed to save Omada config", "error");
      }
    } catch (e: any) {
      showNotification(e.message || "Failed to save Omada config", "error");
    } finally {
      setIsSavingOmada(false);
    }
  };

  // Trigger live synchronization with Turso DB
  const handleTriggerOmadaSync = async () => {
    if (!userCanModify) {
      showNotification("Permission Denied: Your role lacks authorization to run database sync.", "error");
      return;
    }
    setIsSyncingOmada(true);
    setSyncSummary(null);
    try {
      showNotification("Synchronizing live site & device telemetry from TP-Link Omada...", "info");
      const res = await omadaApi.syncNow();
      if (res && res.success) {
        setSyncSummary(res);
        showNotification(`Omada Sync Completed! Matched & updated ${res.updatedRecords} sites across Supplier 1 & 2.`);
        // Refresh local table data from Turso
        projectApi.getTableRecords("freewifi").then((records) => {
          if (Array.isArray(records)) {
            setRecordsStore((prev) => ({ ...prev, freewifi: records }));
          }
        });
        window.dispatchEvent(new CustomEvent("dict_records_updated", { detail: { projectId: "freewifi", source: "omada_sync", timestamp: Date.now() } }));
        window.dispatchEvent(new CustomEvent("dict_freewifi_updated", { detail: { source: "omada_sync", timestamp: Date.now() } }));
      } else {
        showNotification("Failed to complete Omada synchronization.", "error");
      }
    } catch (e: any) {
      showNotification(`Sync Error: ${e.message}`, "error");
    } finally {
      setIsSyncingOmada(false);
    }
  };

  // Filtered rows
  const filteredRecords = useMemo(() => {
    return currentRecords.filter((record) => {
      // Search across all values
      const matchesSearch = searchQuery.trim() === "" || Object.values(record).some((val) =>
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Status filter
      const matchesStatus = statusFilter === "ALL" || record.status === statusFilter;

      // Province filter (if record has province)
      const matchesProvince = provinceFilter === "ALL" || record.province === provinceFilter;

      return matchesSearch && matchesStatus && matchesProvince;
    });
  }, [currentRecords, searchQuery, statusFilter, provinceFilter]);

  // Extract unique provinces for the active project
  const availableProvinces = useMemo(() => {
    const set = new Set<string>();
    currentRecords.forEach((r) => {
      if (r.province) set.add(r.province);
    });
    return Array.from(set);
  }, [currentRecords]);

  // Compute status metrics
  const statusMetrics = useMemo(() => {
    const total = currentRecords.length;
    const activeCount = currentRecords.filter((r) => 
      r.status === "Active" || r.status === "Live" || r.status === "Operational" || r.status === "Completed" || r.status === "Deployed"
    ).length;
    const issueCount = currentRecords.filter((r) => 
      r.status === "Degraded" || r.status === "Under Maintenance" || r.status === "Offline" || 
      r.status === "Expiring Soon" || r.status === "Revoked" || r.status === "Fiber Cut / Alert" ||
      r.status === "Critical"
    ).length;

    return { total, activeCount, issueCount };
  }, [currentRecords]);

  // Helper to dynamically get designated focal person for any project (and optional province)
  const getProjectFocalPerson = useCallback(
    (projectId: string, province?: string): string => {
      const projId = String(projectId || "").toLowerCase().replace(/^mod_/, "").replace(/^mod-/, "");

      // Normalize check helper
      const matchesProject = (uFocalProject?: string) => {
        if (!uFocalProject) return projId === "elgu";
        const norm = uFocalProject.toLowerCase().replace(/^mod_/, "").replace(/^mod-/, "");
        return norm === projId;
      };

      const matchesProvince = (u: any, targetProv: string) => {
        const pNorm = targetProv.toLowerCase().trim();
        const fProv = String(u.focalProvince || "").toLowerCase().trim();
        const uReg = String(u.region || "").toLowerCase().trim();
        return fProv.includes(pNorm) || uReg.includes(pNorm);
      };

      // 1. If province is provided, prioritize focal user assigned specifically to that province
      if (province) {
        // A. Logged in user
        if (currentUser?.isFocal && matchesProject(currentUser.focalProject) && matchesProvince(currentUser, province)) {
          return currentUser.name;
        }
        // B. Active admin user in preview
        if (activeAdminUser?.isFocal && matchesProject(activeAdminUser.focalProject) && matchesProvince(activeAdminUser, province)) {
          return activeAdminUser.name;
        }
        // C. Database administrators
        const provAdmin = administrators.find(
          (u) => Boolean(u.isFocal) && matchesProject(u.focalProject) && matchesProvince(u, province)
        );
        if (provAdmin) return provAdmin.name;

        // D. Locally stored users
        try {
          const stored = getStoredUsers();
          const provStored = stored.find(
            (u) => Boolean(u.isFocal) && matchesProject(u.focalProject) && matchesProvince(u, province)
          );
          if (provStored) return provStored.name;
        } catch {}
      }

      // 2. Fallback to regional / overall focal lead for this project
      // A. Logged in user
      if (currentUser?.isFocal && matchesProject(currentUser.focalProject)) {
        return currentUser.name;
      }
      // B. Active admin user in preview
      if (activeAdminUser?.isFocal && matchesProject(activeAdminUser.focalProject)) {
        return activeAdminUser.name;
      }
      // C. Database administrators
      const projAdmin = administrators.find(
        (u) => Boolean(u.isFocal) && matchesProject(u.focalProject)
      );
      if (projAdmin) return projAdmin.name;

      // D. Locally stored users
      try {
        const stored = getStoredUsers();
        const projStored = stored.find(
          (u) => Boolean(u.isFocal) && matchesProject(u.focalProject)
        );
        if (projStored) return projStored.name;
      } catch {}

      // 3. Default regional leads if none designated yet in User Directory
      const defaults: Record<string, string> = {
        elgu: "Engr. K. Bermudez",
        freewifi: "Engr. Ronald Morales",
        govnet: "Engr. Marco Villareal",
        nbp: "Engr. Salvador Gomez",
        cybersecurity: "Michelle Agua",
        pnpki: "Gerald Andrew Gojar",
        ilcdb: "Engr. Jonathan Santos",
        gecs: "TOD Emergency Lead",
        egovph: "eGov Regional Lead",
        miss: "DICT Systems Unit",
        iidb: "Industry Development Lead",
      };

      return defaults[projId] || "DICT Region V Focal";
    },
    [administrators, currentUser, activeAdminUser]
  );

  // Active project focal lead
  const designatedFocalPerson = useMemo(() => {
    return getProjectFocalPerson(selectedProjectId);
  }, [getProjectFocalPerson, selectedProjectId]);

  // Auto calculate progress percentage based on deployment status
  const calculateAutoProgress = (status: string, currentVal?: any): number => {
    const norm = String(status || "").toLowerCase().trim();
    if (norm === "live" || norm === "operational" || norm === "active" || norm === "completed") return 100;
    if (norm === "uat") return 80;
    if (norm === "build up" || norm === "ongoing" || norm === "build-up") return 40;
    if (norm === "inactive" || norm === "offline") return 0;
    if (currentVal !== undefined && currentVal !== "" && !isNaN(Number(currentVal))) return Number(currentVal);
    return 100;
  };

  // Open Add Record Modal
  const handleOpenAddModal = () => {
    if (!userCanModify) {
      showNotification("Permission Denied: Your account role does not have authorization to add records.", "error");
      return;
    }
    const initialData: Record<string, any> = {
      id: `${activeSchema.id}-${Date.now().toString().slice(-4)}`,
    };
    activeSchema.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        initialData[field.key] = field.defaultValue;
      } else if (field.type === "select" && field.options && field.options.length > 0) {
        initialData[field.key] = field.options[0];
      } else {
        initialData[field.key] = "";
      }
    });

    initialData.dictFocal = getProjectFocalPerson(activeSchema.id, initialData.province);
    if (activeSchema.id === "elgu") {
      initialData.progressPercentage = calculateAutoProgress(initialData.status);
    }

    setFormData(initialData);
    setFormErrors({});
    setEditingRecord(null);
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (record: Record<string, any>) => {
    if (!userCanModify) {
      showNotification("Permission Denied: Your account role does not have authorization to edit records in this module.", "error");
      return;
    }
    const loaded = { ...record };
    loaded.dictFocal = getProjectFocalPerson(activeSchema.id, loaded.province);
    if (activeSchema.id === "elgu") {
      loaded.progressPercentage = calculateAutoProgress(loaded.status, loaded.progressPercentage);
    }
    setFormData(loaded);
    setFormErrors({});
    setEditingRecord(record);
    setIsAddEditOpen(true);
  };

  // Open Project Settings Modal
  const handleOpenProjectSettingsModal = () => {
    if (!userCanModify) {
      showNotification("Permission Denied: Your account role does not have authorization to modify project settings.", "error");
      return;
    }
    setProjectSettingsForm({
      name: activeProjectMeta.name,
      shortName: activeProjectMeta.shortName,
      category: activeProjectMeta.category,
      status: activeProjectMeta.status,
      description: activeProjectMeta.description,
    });
    setIsProjectSettingsOpen(true);
  };

  // Save Project Settings Updates
  const handleSaveProjectSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCanModify) {
      showNotification("Permission Denied: Your account role does not have authorization to modify project settings.", "error");
      return;
    }
    const updates = {
      name: projectSettingsForm.name,
      shortName: projectSettingsForm.shortName,
      category: projectSettingsForm.category,
      status: projectSettingsForm.status,
      description: projectSettingsForm.description,
    };
    const updated = updateProjectSetting(selectedProjectId, updates);
    projectApi.updateProject(selectedProjectId, updates);
    setProjectList(updated);
    setIsProjectSettingsOpen(false);
    showNotification(`Updated project settings and operational status for ${projectSettingsForm.shortName}!`);
  };

  // Save Add / Edit Record
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCanModify) {
      showNotification("Permission Denied: Your account role does not have authorization to edit records in this module.", "error");
      return;
    }
    const errors: Record<string, string> = {};

    // Validate required fields
    activeSchema.fields.forEach((field) => {
      if (field.required && (!formData[field.key] || String(formData[field.key]).trim() === "")) {
        errors[field.key] = `${field.label} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const finalData = { ...formData };
    finalData.dictFocal = getProjectFocalPerson(selectedProjectId, finalData.province);
    if (selectedProjectId === "elgu") {
      finalData.progressPercentage = calculateAutoProgress(formData.status, formData.progressPercentage);
    }

    if (editingRecord) {
      // Update existing record in Turso table
      projectApi.updateTableRecord(selectedProjectId, editingRecord.id, finalData);
      setRecordsStore((prev) => {
        const list = prev[selectedProjectId] || [];
        const updated = list.map((item) => (item.id === editingRecord.id ? { ...finalData } : item));
        return { ...prev, [selectedProjectId]: updated };
      });
      showNotification(`Updated record "${finalData[activeSchema.fields[0]?.key] || finalData.id}" in database successfully!`);
    } else {
      // Insert new record into Turso table
      projectApi.createTableRecord(selectedProjectId, finalData).then((saved) => {
        if (saved && saved.id) {
          setRecordsStore((prev) => {
            const list = prev[selectedProjectId] || [];
            return {
              ...prev,
              [selectedProjectId]: [saved, ...list.filter((r) => r.id !== finalData.id && r.id !== saved.id)],
            };
          });
        }
      });
      setRecordsStore((prev) => {
        const list = prev[selectedProjectId] || [];
        return { ...prev, [selectedProjectId]: [finalData, ...list] };
      });
      showNotification(`Saved new record to Turso table "${selectedProjectId}"!`);
    }

    setIsAddEditOpen(false);
  };

  // Delete record
  const handleDeleteRecord = (id: string) => {
    if (!userCanDelete) {
      showNotification("Permission Denied: Your account role does not have authorization to delete records from the database.", "error");
      return;
    }
    const record = currentRecords.find((r) => r.id === id);
    const label = record ? record[activeSchema.fields[0]?.key] || id : id;

    if (window.confirm(`Are you sure you want to delete "${label}"? This action cannot be undone.`)) {
      projectApi.deleteTableRecord(selectedProjectId, id);
      setRecordsStore((prev) => {
        const list = prev[selectedProjectId] || [];
        return { ...prev, [selectedProjectId]: list.filter((r) => r.id !== id) };
      });
      showNotification(`Record deleted from table "${selectedProjectId}".`, "info");
    }
  };

  // Reset current project data to default baseline
  const handleResetToDefaults = () => {
    if (!userCanModify) {
      showNotification("Permission Denied: Your account role does not have authorization to reset database records.", "error");
      return;
    }
    if (window.confirm(`Reset all records for ${activeSchema.name} back to default official records?`)) {
      projectApi.bulkImport(selectedProjectId, activeSchema.defaultRecords, true);
      setRecordsStore((prev) => ({
        ...prev,
        [selectedProjectId]: [...activeSchema.defaultRecords],
      }));
      showNotification(`Reset ${activeSchema.shortName} table to official defaults.`);
    }
  };

  // Export Data to CSV / JSON
  const handleExportData = (format: "csv" | "json") => {
    if (format === "json") {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentRecords, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `DICT_${activeSchema.id}_records_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showNotification(`Exported ${currentRecords.length} records to JSON.`);
    } else {
      // Export CSV
      if (currentRecords.length === 0) {
        showNotification("No records to export.", "error");
        return;
      }
      const keys = Object.keys(currentRecords[0]);
      const csvRows = [];
      csvRows.push(keys.join(","));

      currentRecords.forEach((row) => {
        const values = keys.map((k) => {
          const val = row[k] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(","));
      });

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `DICT_${activeSchema.id}_records_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification(`Exported ${currentRecords.length} records to CSV.`);
    }
  };

  // Download Sample Template
  const handleDownloadSampleTemplate = (format: "csv" | "json") => {
    const sampleRecord: Record<string, any> = { id: `${activeSchema.id}-001` };
    activeSchema.fields.forEach((f) => {
      sampleRecord[f.key] = f.defaultValue ?? (f.options ? f.options[0] : f.type === "number" ? 0 : "");
    });

    if (format === "json") {
      const sample = [sampleRecord];
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sample, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `template_${activeSchema.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      const keys = Object.keys(sampleRecord);
      const csvRows = [
        keys.join(","),
        keys.map((k) => `"${String(sampleRecord[k] ?? "").replace(/"/g, '""')}"`).join(","),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `template_${activeSchema.id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Execute Import
  const handleExecuteImport = () => {
    setImportError(null);
    if (!importRawText.trim()) {
      setImportError("Please paste data or upload a file first.");
      return;
    }

    try {
      let parsedRecords: Record<string, any>[] = [];

      if (importFormat === "json") {
        const obj = JSON.parse(importRawText);
        if (Array.isArray(obj)) {
          parsedRecords = obj;
        } else {
          setImportError("JSON must be an array of records [ { ... }, { ... } ]");
          return;
        }
      } else {
        // Parse CSV
        const lines = importRawText.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) {
          setImportError("CSV must contain a header line and at least 1 data row.");
          return;
        }
        const headers = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());
        parsedRecords = lines.slice(1).map((line, idx) => {
          const values = line.split(",").map((v) => v.replace(/^["']|["']$/g, "").trim());
          const rowObj: Record<string, any> = { id: `${activeSchema.id}-imp-${Date.now()}-${idx}` };
          headers.forEach((h, i) => {
            rowObj[h] = values[i] ?? "";
          });
          return rowObj;
        });
      }

      if (parsedRecords.length === 0) {
        setImportError("No records parsed.");
        return;
      }

      // Save to Turso table in background
      projectApi.bulkImport(selectedProjectId, parsedRecords, false);

      // Merge or Replace
      setRecordsStore((prev) => {
        const existing = prev[selectedProjectId] || [];
        return {
          ...prev,
          [selectedProjectId]: [...parsedRecords, ...existing],
        };
      });

      showNotification(`Successfully imported ${parsedRecords.length} records into table "${selectedProjectId}"!`);
      setIsImportOpen(false);
      setImportRawText("");
    } catch (err: any) {
      setImportError(`Failed to parse data: ${err.message || "Syntax error"}`);
    }
  };

  // Handle File Input for Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportRawText(text);
      if (file.name.endsWith(".json")) {
        setImportFormat("json");
      } else if (file.name.endsWith(".csv")) {
        setImportFormat("csv");
      }
    };
    reader.readAsText(file);
  };

  // Status Badge Styler
  const renderStatusBadge = (status: string) => {
    const isGood = status === "Active" || status === "Live" || status === "Operational" || status === "Completed" || status === "Deployed";
    const isWarning = status === "Degraded" || status === "Under Maintenance" || status === "Expiring Soon" || status === "UAT" || status === "Build UP" || status === "Standby" || status === "Ongoing" || status === "For Testing" || status === "Under Expansion" || status === "Planning Phase";
    const isCritical = status === "Offline" || status === "Revoked" || status === "Fiber Cut / Alert" || status === "Critical" || status === "Inactive";

    let colorClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (isGood) colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (isWarning) colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
    if (isCritical) colorClass = "bg-red-500/10 text-red-400 border-red-500/30";

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 ${colorClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isGood ? "bg-emerald-400" : isWarning ? "bg-amber-400" : "bg-red-400"}`} />
        {status}
      </span>
    );
  };

  const IconComp = ICONS[activeSchema.iconName] || Database;

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-top-4 ${
            notification.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
              : notification.type === "error"
              ? "bg-red-950/90 border-red-500/40 text-red-300"
              : "bg-blue-950/90 border-blue-500/40 text-blue-300"
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HEADER SECTION                                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  Project Data Management
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  Editing Data Center
                </span>
                {currentSystemModule ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    <span className={`w-1.5 h-1.5 rounded-full ${currentSystemModule.is_active ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span>Module Code: {currentSystemModule.code}</span>
                    {!currentSystemModule.is_active && (
                      <span className="text-[9px] font-sans font-bold bg-amber-500/20 text-amber-300 px-1 rounded border border-amber-500/30">
                        Deactivated in System
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-900 text-slate-300 border border-slate-700">
                    <span>Module Code: MOD_{selectedProjectId.toUpperCase()}</span>
                  </span>
                )}
                {backendHealth && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Turso DB: table <code className="text-cyan-200 font-mono font-bold">{selectedProjectId}</code></span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Live database editor, metric updates, schema mapper, and project settings pipeline for DICT Region V
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          
          <button
            onClick={handleOpenProjectSettingsModal}
            disabled={!userCanModify}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
              userCanModify
                ? "bg-[#141C2E] hover:bg-[#1C263E] border-blue-500/30 text-blue-300 cursor-pointer"
                : "bg-[#0C101D] border-slate-800 text-slate-500 cursor-not-allowed opacity-60"
            }`}
            title={userCanModify ? "Configure Project Metadata" : "Restricted: Current personnel role cannot edit this module"}
          >
            {userCanModify ? <Settings2 className="w-3.5 h-3.5 text-blue-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
            Project Settings
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            disabled={!userCanModify}
            className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
              userCanModify
                ? "bg-[#141C2E] hover:bg-[#1C263E] border-[#222E4A] text-slate-200 cursor-pointer"
                : "bg-[#0C101D] border-slate-800 text-slate-500 cursor-not-allowed opacity-60"
            }`}
            title={userCanModify ? "Import Data" : "Restricted: Current personnel role cannot edit this module"}
          >
            {userCanModify ? <Upload className="w-3.5 h-3.5 text-blue-400" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
            Import Data
          </button>

          <button
            onClick={() => handleExportData("csv")}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#141C2E] hover:bg-[#1C263E] border border-[#222E4A] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export CSV
          </button>

          <button
            onClick={() => handleExportData("json")}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#141C2E] hover:bg-[#1C263E] border border-[#222E4A] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-purple-400" />
            Export JSON
          </button>

          <button
            onClick={handleOpenAddModal}
            disabled={!userCanModify}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              userCanModify
                ? "bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-900/30 cursor-pointer"
                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60"
            }`}
            title={userCanModify ? "Add Record" : "Restricted: Current personnel role cannot edit this module"}
          >
            {userCanModify ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            Add Record
          </button>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADMINISTRATION & PERSONNEL EDIT AUTHORIZATION BAR                        */}
      {/* ========================================================================= */}
      <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
            userCanModify 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          }`}>
            {userCanModify ? <ShieldCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Module Edit Authority:
              </span>
              {userCanModify ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Authorized to Edit & Modify (Table: {selectedProjectId})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Read-Only (Modification Restricted via Administration Table)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Role permissions from the Turso <code className="text-blue-300 font-mono">administration</code> table dictate which users can edit project modules.
            </p>
          </div>
        </div>

        {/* Active Logged-in Personnel Indicator */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Active Personnel:</span>
          <div className="bg-[#141C2E] border border-[#222E4A] rounded-xl px-3 py-1.5 text-xs text-white flex items-center gap-2 max-w-[280px] truncate shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <span className="font-semibold truncate">{effectiveUser?.name || "User"}</span>
            <span className="text-slate-400 text-[11px] shrink-0">({effectiveUser?.role || "Personnel"})</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
              userCanModify 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
            }`}>
              {userCanModify ? "Can Edit" : "Read-Only"}
            </span>
          </div>
        </div>
      </div>

      {/* Module Operational Status Alert (if deactivated in Administration module table) */}
      {currentSystemModule && !currentSystemModule.is_active && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-amber-200 shadow-lg">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-amber-300">
                Notice: Module Code {currentSystemModule.code} is currently Deactivated in the Administration Module Table
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Deactivated Globally
              </span>
            </div>
            <p className="text-amber-200/80 text-[11px] leading-relaxed">
              Editing Data is managed in this module (Project Data Management). Authorized personnel retain the ability to modify, insert, delete, and import records into the <code className="text-amber-100 font-mono font-bold">{selectedProjectId}</code> database table regardless of the module's active/deactive status in Administration.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROJECT SELECTOR TABS & QUICK METRICS                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Project Switcher Bar */}
        <div className="lg:col-span-12 bg-[#0C101D] border border-[#18233C] p-3 rounded-2xl">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            {authorizedSchemaKeys.length === 0 ? (
              <div className="py-3 px-4 text-center text-xs text-amber-300 flex items-center justify-center gap-2 w-full">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>No Project Modules Authorized for this account. Contact an administrator to grant specific project access.</span>
              </div>
            ) : (
              authorizedSchemaKeys.map((key) => {
                const proj = PROJECT_SCHEMAS[key];
                if (!proj) return null;
                const meta = projectList.find((p) => p.id === key);
                const isSelected = selectedProjectId === key;
                const ProjIcon = ICONS[proj.iconName] || Database;
                const count = (recordsStore[key] || proj.defaultRecords || []).length;
                const status = meta?.status || "operational";

                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedProjectId(key);
                      setStatusFilter("ALL");
                      setProvinceFilter("ALL");
                      setSearchQuery("");
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 whitespace-nowrap transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/40"
                        : "bg-[#111625] text-slate-300 hover:text-white hover:bg-[#182035] border-[#1C2744]"
                    }`}
                  >
                    <ProjIcon className={`w-4 h-4 ${isSelected ? "text-white" : "text-blue-400"}`} />
                    <span>{proj.shortName || proj.name}</span>
                    
                    {/* Status indicator dot */}
                    <span
                      className={`w-2 h-2 rounded-full ${
                        status === "operational"
                          ? "bg-emerald-400"
                          : status === "warning"
                          ? "bg-amber-400"
                          : status === "critical"
                          ? "bg-red-400"
                          : "bg-slate-500"
                      }`}
                      title={`System Status: ${status}`}
                    />

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                        isSelected ? "bg-blue-800/80 text-blue-100" : "bg-[#182136] text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* ACTIVE PROJECT OVERVIEW & FILTER CONTROLS                                 */}
      {/* ========================================================================= */}
      {authorizedSchemaKeys.length === 0 ? (
        <div className="bg-[#0C101D] border border-amber-500/30 rounded-2xl p-12 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Project Modules Authorized</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You have access to Project Data Management, but your account has not been assigned permissions to view or modify any specific project modules (e.g. eLGU, Free Wi-Fi, NBP). Please contact an administrator to grant project module permissions.
          </p>
        </div>
      ) : (
        <>
        <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl p-5 space-y-4 shadow-xl">
        
        {/* Active Project Banner */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#18233C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <IconComp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">{activeProjectMeta.name || activeSchema.name}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {activeProjectMeta.category || activeSchema.category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    activeProjectMeta.status === "operational"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : activeProjectMeta.status === "warning"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : activeProjectMeta.status === "critical"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                  }`}
                >
                  {activeProjectMeta.status}
                </span>

                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>DICT Focal: {designatedFocalPerson}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeProjectMeta.description || activeSchema.description}</p>
            </div>
          </div>

          {/* Quick Stat Badges & Edit Settings Trigger */}
          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <button
              onClick={handleOpenProjectSettingsModal}
              className="px-3 py-1.5 rounded-xl bg-[#111728] hover:bg-[#18233C] text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Edit project operational status, category, and description"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configure</span>
            </button>

            <div className="bg-[#111728] border border-[#1C2744] px-3 py-1.5 rounded-xl text-center">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Total Entries</div>
              <div className="text-sm font-black text-white font-mono">{statusMetrics.total}</div>
            </div>

            <div className="bg-[#111728] border border-[#1C2744] px-3 py-1.5 rounded-xl text-center">
              <div className="text-[10px] uppercase font-semibold text-emerald-400">Active / Live</div>
              <div className="text-sm font-black text-emerald-400 font-mono">{statusMetrics.activeCount}</div>
            </div>

            {statusMetrics.issueCount > 0 && (
              <div className="bg-[#111728] border border-amber-500/30 px-3 py-1.5 rounded-xl text-center">
                <div className="text-[10px] uppercase font-semibold text-amber-400">Alerts / Attention</div>
                <div className="text-sm font-black text-amber-400 font-mono">{statusMetrics.issueCount}</div>
              </div>
            )}

            <button
              onClick={handleResetToDefaults}
              className="p-2 rounded-xl bg-[#111728] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1C2744] transition-colors cursor-pointer"
              title="Reset this project's records to official baseline defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FREE WI-FI OMADA NORTHBOUND OPEN API CONFIGURATION CARD                   */}
        {/* ========================================================================= */}
        {selectedProjectId === "freewifi" && omadaConfig && (
          <div className="bg-[#080C16] border border-blue-500/30 rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
            {/* Header / Summary Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-3 border-b border-[#18233C]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      TP-Link Omada Northbound Open API Integration
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      Supplier 1 & Supplier 2
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Sync Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure Open API Client Credentials, test controller connectivity, and synchronize live AP telemetry to Turso DB.
                  </p>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div className="flex items-center gap-2 self-stretch lg:self-auto justify-end flex-wrap">
                <button
                  type="button"
                  onClick={handleTriggerOmadaSync}
                  disabled={isSyncingOmada || !userCanModify}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                    isSyncingOmada
                      ? "bg-blue-800 text-blue-200 cursor-wait"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40"
                  }`}
                  title="Pull live AP, router, and site data from Omada and enrich Turso Free Wi-Fi database"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOmada ? "animate-spin" : ""}`} />
                  <span>{isSyncingOmada ? "Syncing with Omada..." : "Sync Live Omada Data to DB"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsOmadaConfigExpanded(!isOmadaConfigExpanded)}
                  className="px-3 py-2 rounded-xl bg-[#111728] hover:bg-[#18233C] text-slate-300 border border-[#1C2744] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isOmadaConfigExpanded ? (
                    <>
                      <span>Hide Credentials</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Manage API Credentials</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sync Summary Notification */}
            {syncSummary && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Sync Succeeded! Updated <strong>{syncSummary.updatedRecords}</strong> records in database (Supplier 1: {syncSummary.supplier1Count} sites, Supplier 2: {syncSummary.supplier2Count} sites).
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">
                  {new Date(syncSummary.timestamp).toLocaleTimeString()}
                </span>
              </div>
            )}

            {/* Expandable Form Section */}
            {isOmadaConfigExpanded && (
              <form onSubmit={handleSaveOmadaConfig} className="space-y-4 pt-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Supplier 1 Card */}
                  <div className="bg-[#0C101D] border border-[#18233C] rounded-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-[#18233C]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Supplier 1 (Omada Controller)
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={omadaConfig.supplier1.enabled}
                          onChange={(e) =>
                            setOmadaConfig({
                              ...omadaConfig,
                              supplier1: { ...omadaConfig.supplier1, enabled: e.target.checked },
                            })
                          }
                          className="rounded border-[#1C2844] bg-[#080B14] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[11px] font-semibold">Active</span>
                      </label>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Interface Access Address (Base URL)
                        </label>
                        <input
                          type="text"
                          value={omadaConfig.supplier1.baseUrl}
                          onChange={(e) =>
                            setOmadaConfig({
                              ...omadaConfig,
                              supplier1: { ...omadaConfig.supplier1, baseUrl: e.target.value },
                            })
                          }
                          placeholder="https://aps1-omada-northbound.tplinkcloud.com"
                          className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Omada ID</label>
                          <input
                            type="text"
                            value={omadaConfig.supplier1.omadaId}
                            onChange={(e) =>
                              setOmadaConfig({
                                ...omadaConfig,
                                supplier1: { ...omadaConfig.supplier1, omadaId: e.target.value },
                              })
                            }
                            placeholder="0198354e765ea6ffff03ee4d9ea32674"
                            className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Client ID</label>
                          <input
                            type="text"
                            value={omadaConfig.supplier1.clientId}
                            onChange={(e) =>
                              setOmadaConfig({
                                ...omadaConfig,
                                supplier1: { ...omadaConfig.supplier1, clientId: e.target.value },
                              })
                            }
                            placeholder="8f1adacf0ad64c9a8b02043e8d73b3d9"
                            className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Client Secret</label>
                        <div className="relative">
                          <input
                            type={showSecret1 ? "text" : "password"}
                            value={omadaConfig.supplier1.clientSecret}
                            onChange={(e) =>
                              setOmadaConfig({
                                ...omadaConfig,
                                supplier1: { ...omadaConfig.supplier1, clientSecret: e.target.value },
                              })
                            }
                            placeholder="c7311c18360744fc8cc3b9aff6097b4b"
                            className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 pr-8 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret1(!showSecret1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showSecret1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Test Connection Button & Result */}
                      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleTestSupplier1}
                          disabled={isTestingSupplier1}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTestingSupplier1 ? "animate-spin" : ""}`} />
                          <span>{isTestingSupplier1 ? "Testing..." : "Test Connection"}</span>
                        </button>

                        {testResult1 && (
                          <span
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              testResult1.success ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {testResult1.success ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>OK ({testResult1.siteCount || 0} sites)</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Failed</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Supplier 2 Card */}
                  <div className="bg-[#0C101D] border border-[#18233C] rounded-xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between pb-2 border-b border-[#18233C]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Supplier 2 (Omada Controller)
                        </h4>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={omadaConfig.supplier2.enabled}
                          onChange={(e) =>
                            setOmadaConfig({
                              ...omadaConfig,
                              supplier2: { ...omadaConfig.supplier2, enabled: e.target.checked },
                            })
                          }
                          className="rounded border-[#1C2844] bg-[#080B14] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-[11px] font-semibold">Active</span>
                      </label>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Interface Access Address (Base URL)
                        </label>
                        <input
                          type="text"
                          value={omadaConfig.supplier2.baseUrl}
                          onChange={(e) =>
                            setOmadaConfig({
                              ...omadaConfig,
                              supplier2: { ...omadaConfig.supplier2, baseUrl: e.target.value },
                            })
                          }
                          placeholder="https://aps1-omada-northbound.tplinkcloud.com"
                          className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Omada ID</label>
                          <input
                            type="text"
                            value={omadaConfig.supplier2.omadaId}
                            onChange={(e) =>
                              setOmadaConfig({
                                ...omadaConfig,
                                supplier2: { ...omadaConfig.supplier2, omadaId: e.target.value },
                              })
                            }
                            placeholder="05f4dc3c1c94809f73403332c4e51026"
                            className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">Client ID</label>
                          <input
                            type="text"
                            value={omadaConfig.supplier2.clientId}
                            onChange={(e) =>
                              setOmadaConfig({
                                ...omadaConfig,
                                supplier2: { ...omadaConfig.supplier2, clientId: e.target.value },
                              })
                            }
                            placeholder="997fc376f32a402abc6c13e50aee04a7"
                            className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">Client Secret</label>
                        <div className="relative">
                          <input
                            type={showSecret2 ? "text" : "password"}
                            value={omadaConfig.supplier2.clientSecret}
                            onChange={(e) =>
                              setOmadaConfig({
                                ...omadaConfig,
                                supplier2: { ...omadaConfig.supplier2, clientSecret: e.target.value },
                              })
                            }
                            placeholder="a3c36f462325438a8cf8d162e23c5d31"
                            className="w-full bg-[#080B14] border border-[#1C2844] rounded-lg px-3 py-1.5 pr-8 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret2(!showSecret2)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showSecret2 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Test Connection Button & Result */}
                      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleTestSupplier2}
                          disabled={isTestingSupplier2}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTestingSupplier2 ? "animate-spin" : ""}`} />
                          <span>{isTestingSupplier2 ? "Testing..." : "Test Connection"}</span>
                        </button>

                        {testResult2 && (
                          <span
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              testResult2.success ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {testResult2.success ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>OK ({testResult2.siteCount || 0} sites)</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Failed</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Background Auto-Sync Configuration */}
                <div className="bg-[#080B14] border border-[#1C2844] rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Automatic Background Database Sync</span>
                        {omadaConfig.autoSyncEnabled ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Active</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">Manual Only</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Periodically pull the latest Omada site & device telemetry into Turso database automatically
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <select
                      value={omadaConfig.syncIntervalMinutes || 30}
                      onChange={(e) =>
                        setOmadaConfig({
                          ...omadaConfig,
                          syncIntervalMinutes: Number(e.target.value),
                        })
                      }
                      disabled={!omadaConfig.autoSyncEnabled}
                      className="bg-[#0C101D] border border-[#1C2844] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                    >
                      <option value={15}>Every 15 mins</option>
                      <option value={30}>Every 30 mins</option>
                      <option value={60}>Every 1 hour</option>
                      <option value={360}>Every 6 hours</option>
                      <option value={1440}>Every 24 hours</option>
                    </select>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={omadaConfig.autoSyncEnabled}
                        onChange={(e) =>
                          setOmadaConfig({
                            ...omadaConfig,
                            autoSyncEnabled: e.target.checked,
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Save API Configuration Action Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[#18233C]">
                  <p className="text-[11px] text-slate-400">
                    Credentials & schedule are saved securely to Turso metadata and utilized for live AP and client statistics.
                  </p>
                  <button
                    type="submit"
                    disabled={isSavingOmada || !userCanModify}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      userCanModify
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingOmada ? "Saving Credentials..." : "Save Omada API Settings"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          
          {/* Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeSchema.shortName} records by keyword, name, or location...`}
              className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
            >
              <option value="ALL">All Statuses ({currentRecords.length})</option>
              {activeSchema.statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st} ({currentRecords.filter((r) => r.status === st).length})
                </option>
              ))}
            </select>
          </div>

          {/* Province Filter (if applicable) */}
          <div className="sm:col-span-3">
            <select
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
            >
              <option value="ALL">All Provinces</option>
              {availableProvinces.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* MAIN DATA TABLE                                                           */}
      {/* ========================================================================= */}
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#111728] text-slate-400 font-semibold border-b border-[#18233C] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                {activeSchema.columns.map((col) => (
                  <th key={col.key} className="py-3 px-4">
                    {col.label}
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#18233C]/60 text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={activeSchema.columns.length + 2} className="py-14 text-center text-slate-500 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Database className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                      <p>No records found matching your filters.</p>
                      <button
                        onClick={handleOpenAddModal}
                        className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                      >
                        + Add First Record
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => {
                  const isApiSynced = Boolean(record.omadaSupplier || record.omadaSiteId || record.omadaPublicIp);
                  const isSupplier1 = String(record.omadaSupplier || "").includes("1");

                  return (
                  <tr
                    key={record.id || index}
                    className={`transition-colors group ${
                      isApiSynced
                        ? isSupplier1
                          ? "bg-[#091122]/70 hover:bg-[#0E1B38] border-l-4 border-l-blue-500"
                          : "bg-[#081518]/70 hover:bg-[#0B2226] border-l-4 border-l-emerald-400"
                        : "hover:bg-[#111728]/60"
                    }`}
                  >
                    
                    {/* Index */}
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {index + 1}
                    </td>

                    {/* Dynamic Columns */}
                    {activeSchema.columns.map((col) => {
                      const val = record[col.key];

                      if (col.isStatus) {
                        return (
                          <td key={col.key} className="py-3 px-4 whitespace-nowrap">
                            {renderStatusBadge(String(val || "Unknown"))}
                          </td>
                        );
                      }

                      if (col.isBadge) {
                        return (
                          <td key={col.key} className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700">
                              {String(val || "—")}
                            </span>
                          </td>
                        );
                      }

                      // DICT Focal Person column
                      if (col.key === "dictFocal" || col.key === "focalPerson" || col.key === "focal") {
                        const focalName = getProjectFocalPerson(selectedProjectId, record.province);
                        return (
                          <td key={col.key} className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 shadow-sm">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{focalName}</span>
                            </span>
                          </td>
                        );
                      }

                      // Implementation Progress % column
                      if (col.key === "progressPercentage") {
                        const pct = calculateAutoProgress(record.status, val);
                        return (
                          <td key={col.key} className="py-3 px-4 whitespace-nowrap font-mono">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25">
                              <span>{pct}%</span>
                            </span>
                          </td>
                        );
                      }

                      // Free WiFi Site Name Column with Live Omada API telemetry highlight
                      if (col.key === "siteName") {
                        const omadaSupplier = record.omadaSupplier;
                        const omadaIp = record.omadaPublicIp;
                        const omadaRouter = record.omadaRouterModel;
                        return (
                          <td key={col.key} className="py-3 px-4 font-medium text-slate-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-white">{val || "—"}</span>
                              {omadaSupplier && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase inline-flex items-center gap-0.5 border ${
                                    isSupplier1
                                      ? "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.25)]"
                                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
                                  }`}
                                  title="Synchronized live from TP-Link Omada Controller API"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{omadaSupplier}</span>
                                </span>
                              )}
                            </div>
                            {omadaIp && (
                              <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1 mt-0.5">
                                <Activity className="w-2.5 h-2.5 shrink-0" />
                                <span>Public IP: {omadaIp}</span>
                                {omadaRouter && (
                                  <span className="text-slate-400">({omadaRouter})</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      }

                      // Check if compound display (e.g. municipality + province)
                      if (col.key === "municipality" && record.province) {
                        return (
                          <td key={col.key} className="py-3 px-4 font-medium text-slate-200">
                            <div>{val || "—"}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{record.province}</div>
                          </td>
                        );
                      }

                      if (col.key === "lguName" && record.province) {
                        return (
                          <td key={col.key} className="py-3 px-4 font-semibold text-white">
                            <div>{val}</div>
                            <div className="text-[10px] text-blue-400 font-normal">{record.province}</div>
                          </td>
                        );
                      }

                      return (
                        <td key={col.key} className="py-3 px-4 text-slate-300 font-normal">
                          {typeof val === "number" ? (
                            <span className="font-mono">{val.toLocaleString()}</span>
                          ) : (
                            String(val || "—")
                          )}
                        </td>
                      );
                    })}

                    {/* Actions Column */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* View Details */}
                        <button
                          onClick={() => {
                            setViewingRecord(record);
                            setIsViewDetailOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#141C2E] hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 transition-colors cursor-pointer"
                          title="View Full Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Record */}
                        <button
                          onClick={() => handleOpenEditModal(record)}
                          disabled={!userCanModify}
                          className={`p-1.5 rounded-lg transition-colors ${
                            userCanModify
                              ? "bg-[#141C2E] hover:bg-amber-600/20 text-slate-400 hover:text-amber-400 cursor-pointer"
                              : "bg-[#0C101D] text-slate-600 cursor-not-allowed opacity-40"
                          }`}
                          title={userCanModify ? "Edit Record" : "Restricted: Current personnel lacks edit authority"}
                        >
                          {userCanModify ? <Edit className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>

                        {/* Delete Record */}
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          disabled={!userCanDelete}
                          className={`p-1.5 rounded-lg transition-colors ${
                            userCanDelete
                              ? "bg-[#141C2E] hover:bg-red-600/20 text-slate-400 hover:text-red-400 cursor-pointer"
                              : "bg-[#0C101D] text-slate-600 cursor-not-allowed opacity-40"
                          }`}
                          title={userCanDelete ? "Delete Record" : "Restricted: Current personnel lacks delete authority"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="bg-[#111728] border-t border-[#18233C] px-5 py-3 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-2">
          <div>
            Showing <span className="text-white font-semibold">{filteredRecords.length}</span> of{" "}
            <span className="text-white font-semibold">{currentRecords.length}</span> total records for {activeSchema.name}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">Auto-saved to local workspace</span>
          </div>
        </div>
      </div>
      </>
      )}

      {/* ========================================================================= */}
      {/* PROJECT SETTINGS & OPERATIONAL STATUS MODAL                               */}
      {/* ========================================================================= */}
      {isProjectSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-xl flex flex-col overflow-hidden shadow-2xl">
            
            <div className="px-6 py-4 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Project Settings: {activeProjectMeta.shortName}</h3>
                  <p className="text-[11px] text-slate-400">Configure project status, metadata, and operational category</p>
                </div>
              </div>

              <button
                onClick={() => setIsProjectSettingsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProjectSettings} className="p-6 space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Project Full Name
                </label>
                <input
                  type="text"
                  value={projectSettingsForm.name}
                  onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, name: e.target.value })}
                  className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Short Code / Acronym
                  </label>
                  <input
                    type="text"
                    value={projectSettingsForm.shortName}
                    onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, shortName: e.target.value })}
                    className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-300">
                    Category
                  </label>
                  <input
                    type="text"
                    value={projectSettingsForm.category}
                    onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, category: e.target.value })}
                    className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  System Operational Status
                </label>
                <select
                  value={projectSettingsForm.status}
                  onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, status: e.target.value as any })}
                  className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="operational">Operational (Normal Delivery)</option>
                  <option value="warning">Warning (Degraded / Maintenance)</option>
                  <option value="critical">Critical (Incident / Outage)</option>
                  <option value="inactive">Inactive (Suspended)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-300">
                  Operational Description
                </label>
                <textarea
                  rows={3}
                  value={projectSettingsForm.description}
                  onChange={(e) => setProjectSettingsForm({ ...projectSettingsForm, description: e.target.value })}
                  className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                  required
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#18233C] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProjectSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141C2E] hover:bg-[#1C263E] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-900/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save Project Settings
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT RECORD MODAL                                                   */}
      {/* ========================================================================= */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  {editingRecord ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingRecord ? `Edit ${activeSchema.shortName} Record` : `Add New ${activeSchema.shortName} Record`}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingRecord ? `Editing Record ID: ${formData.id}` : `Fill in the project fields below`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveRecord} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeSchema.fields.map((field) => {
                  const error = formErrors[field.key];
                  const value = formData[field.key] ?? "";

                  return (
                    <div
                      key={field.key}
                      className={
                        field.key === "notes" || field.key === "resolutionNotes" || field.key === "deployedModules" || field.key === "apiDocUrl" || field.key === "description"
                          ? "sm:col-span-2 space-y-1"
                          : "space-y-1"
                      }
                    >
                      <label className="block text-[11px] font-semibold text-slate-300">
                        {field.label} {field.required && <span className="text-red-400">*</span>}
                      </label>

                      {field.type === "select" ? (
                        <select
                          value={value}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className={`w-full bg-[#080B14] border ${
                            error ? "border-red-500" : "border-[#1C2844]"
                          } rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors`}
                        >
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          value={value}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [field.key]: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                          placeholder={field.placeholder}
                          className={`w-full bg-[#080B14] border ${
                            error ? "border-red-500" : "border-[#1C2844]"
                          } rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors font-mono`}
                        />
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          value={value}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          className={`w-full bg-[#080B14] border ${
                            error ? "border-red-500" : "border-[#1C2844]"
                          } rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className={`w-full bg-[#080B14] border ${
                            error ? "border-red-500" : "border-[#1C2844]"
                          } rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors`}
                        />
                      )}

                      {error && <p className="text-[10px] text-red-400 font-medium">{error}</p>}
                    </div>
                  );
                })}
              </div>

              {/* Auto-Assigned Focal Person & Implementation Progress for eLGU */}
              {selectedProjectId === "elgu" && (
                <div className="p-3.5 rounded-xl bg-blue-950/25 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-slate-400">Assigned DICT Focal: </span>
                      <span className="font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                        {designatedFocalPerson}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Implementation: </span>
                    <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                      {calculateAutoProgress(formData.status, formData.progressPercentage)}% Progress
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">(Auto from {formData.status || "Status"})</span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#18233C] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141C2E] hover:bg-[#1C263E] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-900/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {editingRecord ? "Save Changes" : "Create Record"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPORT RAW DATA MODAL                                                     */}
      {/* ========================================================================= */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-xl flex flex-col overflow-hidden shadow-2xl">
            
            <div className="px-6 py-4 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Import Data: {activeSchema.name}</h3>
                  <p className="text-[11px] text-slate-400">Paste CSV/JSON or upload file into active dataset</p>
                </div>
              </div>

              <button
                onClick={() => setIsImportOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              {/* Format selection */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <span>Format:</span>
                  <button
                    type="button"
                    onClick={() => setImportFormat("json")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      importFormat === "json"
                        ? "bg-purple-600 text-white"
                        : "bg-[#141C2E] text-slate-400 hover:text-white"
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportFormat("csv")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      importFormat === "csv"
                        ? "bg-emerald-600 text-white"
                        : "bg-[#141C2E] text-slate-400 hover:text-white"
                    }`}
                  >
                    CSV
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadSampleTemplate(importFormat)}
                  className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Download Sample {importFormat.toUpperCase()} Template
                </button>
              </div>

              {/* File upload trigger */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Upload file or paste below:
                </label>
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
              </div>

              {/* Textarea */}
              <textarea
                rows={7}
                value={importRawText}
                onChange={(e) => setImportRawText(e.target.value)}
                placeholder={
                  importFormat === "json"
                    ? `[\n  {\n    "siteName": "Daet Tech Center",\n    "province": "Camarines Norte",\n    "status": "Active"\n  }\n]`
                    : `siteName,province,status\n"Daet Tech Center","Camarines Norte","Active"`
                }
                className="w-full bg-[#080B14] border border-[#1C2844] rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
              />

              {importError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-medium">
                  {importError}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#141C2E] hover:bg-[#1C263E] text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  Import Records
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW RECORD DETAIL MODAL                                                  */}
      {/* ========================================================================= */}
      {isViewDetailOpen && viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl">
            
            <div className="px-6 py-4 border-b border-[#18233C] flex items-center justify-between bg-[#111728]">
              <div className="flex items-center gap-2">
                <IconComp className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Record Details</h3>
              </div>

              <button
                onClick={() => setIsViewDetailOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto max-h-[70vh] custom-scrollbar text-xs">
              {Object.entries(viewingRecord).map(([k, v]) => (
                <div key={k} className="flex justify-between items-start py-2 border-b border-[#18233C]/40">
                  <span className="font-semibold text-slate-400 capitalize">{k.replace(/([A-Z])/g, " $1")}</span>
                  <span className="font-medium text-slate-200 text-right max-w-[260px] break-words">
                    {k === "status" ? renderStatusBadge(String(v)) : String(v || "—")}
                  </span>
                </div>
              ))}

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => {
                    setIsViewDetailOpen(false);
                    handleOpenEditModal(viewingRecord);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Edit This Record
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
