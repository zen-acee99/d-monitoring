import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Settings,
  Check,
  X,
  UserCheck,
  Crown,
  Edit2,
  Trash2,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FolderLock,
  RefreshCw,
  Plus,
  Code2,
  CheckCircle2,
  XCircle,
  Power,
  Database,
  MapPin
} from "lucide-react";
import { PROJECTS } from "@/config/projects";
import { getStoredUsers, saveStoredUsers, UserRecord } from "@/data/userStore";
import { UserModal, ROLE_OPTIONS, REGION_OPTIONS } from "@/components/users/UserModal";
import { administrationApi, modulesApi, SystemModule } from "@/services/api";
import { createFullAccessMatrix, createEmptyAccessMatrix, syncCurrentUserIfUpdated, getCurrentUser, hasModuleAccess, AUTH_EVENT, setCachedSystemModules } from "@/services/authStore";

// Interactive switch component for project permissions
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    onClick={onChange}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer border transition-all select-none ${
      checked
        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
        : "bg-[#111728] border-[#1C2844] text-slate-400 hover:text-slate-200 hover:border-slate-700"
    }`}
  >
    <div
      className={`w-2 h-2 rounded-full transition-all ${
        checked
          ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
          : "bg-slate-600"
      }`}
    />
    <span>{label}</span>
  </button>
);

export function SystemSettings() {
  const [currentUser, setCurrentUserSession] = useState(() => getCurrentUser());

  useEffect(() => {
    const handleAuth = () => setCurrentUserSession(getCurrentUser());
    window.addEventListener(AUTH_EVENT, handleAuth);
    return () => window.removeEventListener(AUTH_EVENT, handleAuth);
  }, []);

  const isSuperAdminOrDirector =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Regional Director" ||
    currentUser?.role === "Assistant Regional Director";
  const canGlobalEdit = isSuperAdminOrDirector || (currentUser?.canEdit && hasModuleAccess(currentUser, "MOD_ADMIN"));

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"directory" | "modules">("directory");
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("All");
  const [selectedRegion, setSelectedRegion] = useState("All");
  const [focalFilter, setFocalFilter] = useState<"All" | "Focal" | "NonFocal">("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Module Management State (Turso table: module)
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [moduleSearch, setModuleSearch] = useState("");
  const [moduleCategoryFilter, setModuleCategoryFilter] = useState("All");
  const [moduleStatusFilter, setModuleStatusFilter] = useState<"All" | "Active" | "Deactivated">("All");

  // Module Add / Edit Modal State
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<SystemModule | null>(null);
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [moduleFormCode, setModuleFormCode] = useState("");
  const [moduleFormName, setModuleFormName] = useState("");
  const [moduleFormShortName, setModuleFormShortName] = useState("");
  const [moduleFormCategory, setModuleFormCategory] = useState("Project");
  const [moduleFormDesc, setModuleFormDesc] = useState("");
  const [moduleFormRoute, setModuleFormRoute] = useState("");
  const [moduleFormActive, setModuleFormActive] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Sync users from Turso administration table
  const loadUsers = async () => {
    setLoading(true);
    try {
      const dbUsers = await administrationApi.getAdministrators();
      if (Array.isArray(dbUsers)) {
        setUsers(dbUsers as UserRecord[]);
        saveStoredUsers(dbUsers as UserRecord[]);
        return;
      }
    } catch (e) {
      console.warn("Failed to load users from Turso:", e);
      setUsers(getStoredUsers());
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    setLoading(true);
    try {
      const restored = await administrationApi.resetDefaults();
      if (Array.isArray(restored) && restored.length > 0) {
        setUsers(restored as UserRecord[]);
        saveStoredUsers(restored as UserRecord[]);
        showToast("Default DICT team accounts restored in Turso!", "success");
      }
    } catch (err: any) {
      showToast("Failed to restore default accounts: " + (err.message || "Failed"), "error");
    } finally {
      setLoading(false);
    }
  };

  // Sync modules from Turso module table
  const loadModules = async () => {
    setLoadingModules(true);
    try {
      const list = await modulesApi.getModules();
      setModules(list);
      setCachedSystemModules(list);
    } catch (err: any) {
      console.warn("Failed to load modules from Turso:", err);
    } finally {
      setLoadingModules(false);
    }
  };

  const handleToggleModuleStatus = async (mod: SystemModule) => {
    try {
      const res = await modulesApi.toggleStatus(mod.id);
      if (res.success && res.module) {
        const nextList = modules.map((m) => (m.id === mod.id ? res.module! : m));
        setModules(nextList);
        setCachedSystemModules(nextList);
        showToast(
          `Module ${mod.code} status changed to ${res.module.is_active ? "ACTIVE" : "DEACTIVATED"} in Turso!`,
          "success"
        );
      } else {
        showToast("Failed to toggle module status", "error");
      }
    } catch (err: any) {
      showToast("Error toggling status: " + (err.message || "Failed"), "error");
    }
  };

  const handleOpenAddModule = () => {
    setEditingModule(null);
    setModuleFormCode("");
    setModuleFormName("");
    setModuleFormShortName("");
    setModuleFormCategory("Project");
    setModuleFormDesc("");
    setModuleFormRoute("");
    setModuleFormActive(true);
    setIsModuleModalOpen(true);
  };

  const handleOpenEditModule = (mod: SystemModule) => {
    setEditingModule(mod);
    setModuleFormCode(mod.code);
    setModuleFormName(mod.name);
    setModuleFormShortName(mod.shortName || "");
    setModuleFormCategory(mod.category || "Project");
    setModuleFormDesc(mod.description || "");
    setModuleFormRoute(mod.route_path || "");
    setModuleFormActive(mod.is_active);
    setIsModuleModalOpen(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleFormCode.trim()) {
      showToast("Module Code is required (e.g. MOD_INVENTORY)", "error");
      return;
    }
    if (!moduleFormName.trim()) {
      showToast("Module Name is required", "error");
      return;
    }

    setIsSavingModule(true);
    try {
      let code = moduleFormCode.trim().toUpperCase();
      if (!code.startsWith("MOD_")) code = `MOD_${code.replace(/[^A-Z0-9_]/g, "_")}`;

      if (editingModule) {
        const res = await modulesApi.updateModule(editingModule.id, {
          code,
          name: moduleFormName.trim(),
          shortName: moduleFormShortName.trim() || undefined,
          category: moduleFormCategory,
          description: moduleFormDesc.trim() || undefined,
          route_path: moduleFormRoute.trim() || undefined,
          is_active: moduleFormActive,
        });

        if (res.success && res.module) {
          setModules((prev) => prev.map((m) => (m.id === editingModule.id ? res.module! : m)));
          window.dispatchEvent(new CustomEvent("dict_modules_updated", { detail: res.module }));
          showToast(`Module "${res.module.code}" successfully updated in Turso!`, "success");
          setIsModuleModalOpen(false);
          setEditingModule(null);
        } else {
          showToast(res.error || "Failed to update module", "error");
        }
      } else {
        const res = await modulesApi.createModule({
          code,
          name: moduleFormName.trim(),
          shortName: moduleFormShortName.trim() || undefined,
          category: moduleFormCategory,
          description: moduleFormDesc.trim() || undefined,
          route_path: moduleFormRoute.trim() || undefined,
          is_active: moduleFormActive,
        });

        if (res.success && res.module) {
          setModules((prev) => [...prev, res.module!]);
          window.dispatchEvent(new CustomEvent("dict_modules_updated", { detail: res.module }));
          showToast(`Module "${res.module.code}" successfully created in Turso!`, "success");
          setIsModuleModalOpen(false);
        } else {
          showToast(res.error || "Failed to create module", "error");
        }
      }
    } catch (err: any) {
      showToast("Error saving module: " + (err.message || "Failed"), "error");
    } finally {
      setIsSavingModule(false);
    }
  };



  useEffect(() => {
    loadUsers();
    loadModules();
  }, []);

  const handleSaveUser = async (userData: UserRecord) => {
    const isOwn =
      String(currentUser?.id) === String(userData.id) ||
      (currentUser?.email && userData.email && currentUser.email.toLowerCase() === userData.email.toLowerCase());
    if (!canGlobalEdit && !isOwn) {
      showToast("Access Denied: You do not have permission to modify other personnel accounts.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const isExisting = users.some((u) => String(u.id) === String(userData.id));
      if (isExisting) {
        const saved = await administrationApi.updateAdministrator(userData.id, userData as any);
        const resolved = (saved as UserRecord) || userData;
        setUsers((prev) =>
          prev.map((u) => (String(u.id) === String(userData.id) ? resolved : u))
        );
        syncCurrentUserIfUpdated(resolved);
        showToast(`Personnel "${userData.name}" successfully updated in Turso!`, "success");
      } else {
        if (!canGlobalEdit) {
          showToast("Access Denied: Only administrators can register new accounts.", "error");
          return;
        }
        const saved = await administrationApi.createAdministrator(userData as any);
        const resolved = (saved as UserRecord) || userData;
        setUsers((prev) => [resolved, ...prev]);
        showToast(`New personnel "${userData.name}" successfully registered in Turso!`, "success");
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error("Save personnel error:", err);
      showToast("Error saving personnel: " + (err.message || "Failed"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (user: UserRecord) => {
    if (!canGlobalEdit) {
      showToast("Access Denied: Only administrators can modify account status.", "error");
      return;
    }
    const nextStatus = user.status === "active" ? "inactive" : "active";
    const updatedUser: UserRecord = { ...user, status: nextStatus };
    try {
      await administrationApi.updateAdministrator(user.id, updatedUser as any);
      setUsers((prev) => prev.map((u) => (String(u.id) === String(user.id) ? updatedUser : u)));
      saveStoredUsers(users.map((u) => (String(u.id) === String(user.id) ? updatedUser : u)));
      syncCurrentUserIfUpdated(updatedUser);
      showToast(
        `Account for ${user.name} is now ${nextStatus === "active" ? "Active" : "Deactivated"}.`,
        nextStatus === "active" ? "success" : "error"
      );
    } catch (err: any) {
      showToast("Failed to update status: " + (err.message || "Error"), "error");
    }
  };

  const handleDeleteUser = async (userId: string | number) => {
    if (!isSuperAdminOrDirector && !currentUser?.canDelete) {
      showToast("Access Denied: Deletion requires Super Admin or Regional Director role.", "error");
      setDeleteConfirmId(null);
      return;
    }

    setIsDeleting(true);
    try {
      const ok = await administrationApi.deleteAdministrator(userId);
      if (ok) {
        setUsers((prev) => prev.filter((u) => String(u.id) !== String(userId)));
        showToast("Personnel successfully deleted from Turso database.", "success");
      } else {
        showToast("Failed to delete personnel from database.", "error");
      }
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error("Delete personnel error:", err);
      showToast("Error deleting personnel: " + (err.message || "Failed"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAccess = async (userId: string | number, moduleKey: string) => {
    if (!canGlobalEdit) {
      showToast("Access Denied: Only administrators can modify permission matrices.", "error");
      return;
    }
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target) return;
    const upper = moduleKey.toUpperCase();
    const modCode = upper.startsWith("MOD_") ? upper : `MOD_${upper}`;
    const slug = upper.replace(/^MOD_/, "").toLowerCase();
    const currentVal = Boolean(target.access?.[modCode] || target.access?.[slug] || target.access?.[moduleKey]);
    const nextVal = !currentVal;

    const newAccess = {
      ...target.access,
      [moduleKey]: nextVal,
      [modCode]: nextVal,
      [slug]: nextVal,
    };
    const updated = { ...target, access: newAccess };
    setUsers((prev) =>
      prev.map((u) => (String(u.id) === String(userId) ? updated : u))
    );
    try {
      await administrationApi.updateAdministrator(userId, updated as any);
      syncCurrentUserIfUpdated(updated);
      saveStoredUsers(users.map((u) => (String(u.id) === String(userId) ? updated : u)));
    } catch (err: any) {
      showToast("Failed to sync access change to Turso", "error");
    }
  };

  const handleGrantAll = async (userId: string | number) => {
    if (!canGlobalEdit) {
      showToast("Access Denied: Only administrators can modify permission matrices.", "error");
      return;
    }
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target) return;
    const fullAccess = createFullAccessMatrix();
    modules.forEach((m) => {
      fullAccess[m.code] = true;
      fullAccess[m.id] = true;
      if (m.route_path) {
        const seg = m.route_path.replace(/^\//, "").replace("projects/", "");
        fullAccess[seg] = true;
        fullAccess[`MOD_${seg.toUpperCase()}`] = true;
      }
    });

    const updated = { ...target, access: fullAccess };
    setUsers((prev) =>
      prev.map((u) => (String(u.id) === String(userId) ? updated : u))
    );
    try {
      await administrationApi.updateAdministrator(userId, updated as any);
      syncCurrentUserIfUpdated(updated);
      saveStoredUsers(users.map((u) => (String(u.id) === String(userId) ? updated : u)));
      showToast(`Granted FULL access to ${target.name}!`, "success");
    } catch (err: any) {
      showToast("Failed to sync full access to Turso", "error");
    }
  };

  const handleRevokeAll = async (userId: string | number) => {
    if (!canGlobalEdit) {
      showToast("Access Denied: Only administrators can modify permission matrices.", "error");
      return;
    }
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target) return;
    const emptyAccess = createEmptyAccessMatrix();
    PROJECTS.forEach((p) => {
      emptyAccess[p.id] = false;
      emptyAccess[`MOD_${p.id.toUpperCase()}`] = false;
    });

    const updated = { ...target, access: emptyAccess };
    setUsers((prev) =>
      prev.map((u) => (String(u.id) === String(userId) ? updated : u))
    );
    syncCurrentUserIfUpdated(updated);
    saveStoredUsers(users.map((u) => (String(u.id) === String(userId) ? updated : u)));
    await administrationApi.updateAdministrator(userId, { access: emptyAccess } as any);
    showToast(`Revoked all module permissions from ${target.name}.`, "info");
  };

  // Filtered list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.region.toLowerCase().includes(search.toLowerCase());

    const matchesRole = selectedRole === "All" || u.role === selectedRole;
    const matchesRegion = selectedRegion === "All" || u.region === selectedRegion;

    const matchesFocal =
      focalFilter === "All" ||
      (focalFilter === "Focal" && u.isFocal) ||
      (focalFilter === "NonFocal" && !u.isFocal);

    return matchesSearch && matchesRole && matchesRegion && matchesFocal;
  });

  const totalUsers = users.length;
  const directorCount = users.filter(
    (u) => u.role === "Regional Director" || u.role === "Assistant Regional Director"
  ).length;
  const focalCount = users.filter((u) => u.isFocal).length;
  const activeCount = users.filter((u) => u.status === "active").length;

  // Filtered module list from Turso table: module
  const filteredModules = useMemo(() => {
    return modules.filter((m) => {
      const q = moduleSearch.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q));

      const matchesCategory = moduleCategoryFilter === "All" || m.category === moduleCategoryFilter;
      const matchesStatus =
        moduleStatusFilter === "All" ||
        (moduleStatusFilter === "Active" && m.is_active) ||
        (moduleStatusFilter === "Deactivated" && !m.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [modules, moduleSearch, moduleCategoryFilter, moduleStatusFilter]);

  const totalModules = modules.length;
  const activeModulesCount = modules.filter((m) => m.is_active).length;
  const deactivatedModulesCount = modules.filter((m) => !m.is_active).length;
  const projectModulesCount = modules.filter((m) => m.category === "Project").length;

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto text-slate-200">
      
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
              : toast.type === "error"
              ? "bg-red-950/90 border-red-500/40 text-red-300"
              : "bg-blue-950/90 border-blue-500/40 text-blue-300"
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Administration & Access Control
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Turso Database Connected
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-purple-400" />
            Administration Module
          </h1>
          <p className="text-xs text-slate-400">
            Unified management for Personnel Directory, Permissions Matrix, and System Modules (Table: Module) with specific module codes
          </p>
        </div>

        <div className="flex items-center gap-2 z-10">
          <button
            onClick={() => {
              loadUsers();
              loadModules();
            }}
            disabled={loading || loadingModules}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#111728] hover:bg-[#1C263E] border border-[#1C2844] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh personnel and modules from Turso database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading || loadingModules ? "animate-spin" : ""}`} />
            <span>Sync Turso</span>
          </button>

          {activeTab === "modules" ? (
            <button
              onClick={handleOpenAddModule}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Module
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingUser(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Personnel
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {activeTab === "modules" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Modules</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{totalModules}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Turso Table: module</div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active Modules
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{activeModulesCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Online in system</div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> Deactivated Modules
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">{deactivatedModulesCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Deactivated codes</div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Database className="w-3.5 h-3.5" /> Project Modules
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono mt-1">{projectModulesCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Editing Data in Project Data Mgmt</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Personnel</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{totalUsers}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Registered accounts</div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" /> Executive Leadership
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono mt-1">{directorCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Director & Assistant Director</div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" /> Project Focals
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{focalCount}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Assigned focal persons</div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Active Accounts</div>
            <div className="text-2xl font-black text-purple-400 font-mono mt-1">{activeCount} / {totalUsers}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Authorized logins</div>
          </div>
        </div>
      )}

      {/* Administration Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#18233C] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "directory"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
              : "bg-[#0C101D] text-slate-400 border border-[#18233C] hover:text-white hover:border-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Users & Access Directory
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === "directory" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>
            {users.length}
          </span>
        </button>



        <button
          type="button"
          onClick={() => setActiveTab("modules")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "modules"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
              : "bg-[#0C101D] text-slate-400 border border-[#18233C] hover:text-white hover:border-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          Module Management (Table: Module)
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === "modules" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>
            {modules.length}
          </span>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl overflow-hidden shadow-xl flex flex-col">
        
        {/* Filter / Search Bar */}
        {activeTab === "modules" ? (
          <div className="p-4 border-b border-[#18233C] bg-[#080B14] flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                placeholder="Search modules by code (e.g. MOD_FREEWIFI), name, or description..."
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                className="w-full rounded-xl border border-[#1C2844] bg-[#111728] pl-10 pr-4 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none placeholder:text-slate-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={moduleCategoryFilter}
                onChange={(e) => setModuleCategoryFilter(e.target.value)}
                className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="All">All Categories</option>
                <option value="Project">DICT Projects</option>
                <option value="Core Tool">Core System Tools</option>
                <option value="Management">Management & Settings</option>
              </select>

              <select
                value={moduleStatusFilter}
                onChange={(e) => setModuleStatusFilter(e.target.value as any)}
                className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Deactivated">Deactivated Only</option>
              </select>

              <button
                type="button"
                onClick={handleOpenAddModule}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Module</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-[#18233C] bg-[#080B14] flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 md:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="search"
                placeholder="Search personnel by name, email, or region..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#1C2844] bg-[#111728] pl-10 pr-4 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none placeholder:text-slate-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Role Filter */}
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Roles</option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Focal Filter */}
              <select
                value={focalFilter}
                onChange={(e) => setFocalFilter(e.target.value as any)}
                className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Designations</option>
                <option value="Focal">Focal Persons Only</option>
                <option value="NonFocal">Non-Focal Only</option>
              </select>

              {/* Region Filter */}
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All">All Regions</option>
                {REGION_OPTIONS.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* View 1: Users & Access Directory (Last Activity column removed) */}
        {activeTab === "directory" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-extrabold text-slate-400 uppercase bg-[#111728] border-b border-[#18233C] tracking-wider">
                <tr>
                  <th className="px-6 py-4">User Profile</th>
                  <th className="px-6 py-4">Role & Status</th>
                  <th className="px-6 py-4">Focal Designation</th>
                  <th className="px-6 py-4">Jurisdiction Scope</th>
                  <th className="px-6 py-4">Accessible Projects</th>
                  <th className="px-6 py-4">Data Management Authority</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18233C]/60 text-xs">
                {filteredUsers.map((user) => {
                  const isDirector = user.role === "Regional Director";
                  const isAsstDirector = user.role === "Asst. Regional Director" || user.role === "Assistant Regional Director";
                  const isSuperAdmin = user.role === "Super Admin" || user.role === "Admin";

                  const roleBadgeColor =
                    ROLE_OPTIONS.find((r) => r.value === user.role)?.badgeColor ||
                    "bg-slate-500/20 text-slate-300 border-slate-500/40";

                  const focalProjObj = user.focalProject
                    ? PROJECTS.find((p) => p.id === user.focalProject)
                    : null;

                  const accessCount = PROJECTS.filter(
                    (p) =>
                      Boolean(
                        user.access?.[p.id] ||
                        user.access?.[`MOD_${p.id.toUpperCase()}`] ||
                        user.access?.[p.id.toLowerCase()]
                      )
                  ).length;

                  return (
                    <tr key={user.id} className="hover:bg-[#111728]/40 transition-colors">
                      
                      {/* User Profile */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                              isDirector
                                ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-md shadow-blue-900/20"
                                : isAsstDirector
                                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                                : isSuperAdmin
                                ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {user.name}
                              {(isDirector || isAsstDirector) && (
                                <Crown className="w-3.5 h-3.5 text-blue-400" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400">{user.email}</div>
                            {user.phone && <div className="text-[10px] text-slate-500">{user.phone}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Role & Status */}
                      <td className="px-6 py-4 space-y-1.5 whitespace-nowrap">
                        <div>
                          <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${roleBadgeColor}`}>
                            {user.role}
                          </span>
                        </div>
                        {user.role === "Provincial Officer" && user.focalProvince && (
                          <div className="text-[10px] text-amber-300 font-semibold flex items-center gap-1 whitespace-nowrap">
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            {user.focalProvince}
                          </div>
                        )}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(user)}
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 transition-all cursor-pointer ${
                              user.status === "active"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/25"
                            }`}
                            title={`Click to ${user.status === "active" ? "Deactivate (Block Access)" : "Activate"} this account`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                            {user.status === "active" ? "Active Account" : "Deactivated"}
                          </button>
                        </div>
                      </td>

                      {/* Focal Status */}
                      <td className="px-6 py-4">
                        {user.isFocal ? (
                          <div className="space-y-1">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              Focal Person
                            </span>
                            {focalProjObj && (
                              <div className="text-[11px] text-emerald-400 font-semibold">
                                {focalProjObj.shortName} ({focalProjObj.category})
                              </div>
                            )}
                            {user.focalProvince && (
                              <div className="text-[10px] text-emerald-300/90 font-medium">
                                Scope: {user.focalProvince}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Region */}
                      <td className="px-6 py-4 font-semibold text-slate-300">
                        {user.region}
                      </td>

                      {/* Accessible Projects */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono font-bold text-xs shrink-0">
                          {accessCount} / {PROJECTS.length} Projects
                        </span>
                      </td>

                      {/* Data Management Authority */}
                      <td className="px-6 py-4">
                        {user.canEdit ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Can Edit & Modify
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Read-Only
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(user);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(user.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3.5 rounded-full bg-slate-850 border border-slate-800 text-slate-500">
                          <Users className="w-8 h-8 opacity-50" />
                        </div>
                        <div className="text-sm font-bold text-white">
                          {search ? "No Personnel Matching Search" : "No Personnel Records in Turso Database"}
                        </div>
                        <p className="text-xs text-slate-400 max-w-sm">
                          {search
                            ? `No personnel match the search term "${search}".`
                            : "All administration records have been cleared or deleted. You can add a new team member or restore the official DICT Region V personnel."}
                        </p>
                        {!search && (
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(null);
                                setIsModalOpen(true);
                              }}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Add Personnel
                            </button>
                            <button
                              type="button"
                              onClick={handleResetDefaults}
                              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Restore Default DICT Personnel
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* View 2: Access Control & Permissions Matrix */}
        {/* View 2: Module Management (Table: Module) */}
        {activeTab === "modules" && (
          <div className="flex flex-col">
            {/* Context Header & Editing Data notice */}
            <div className="p-4 bg-[#0A0E1A] border-b border-[#18233C] flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Turso Cloud Table: <code className="text-emerald-400 font-mono font-black">module</code>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                      {filteredModules.length} Modules Registered
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Each module has a specific module code and can be toggled Active or Deactivated globally. Personnel module access is granted independently in Administration.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs bg-indigo-950/40 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-indigo-200">
                <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong className="text-white">Editing Data Center:</strong> Data records, schemas, and values are edited in{" "}
                  <strong className="text-indigo-300">Project Data Management</strong>.
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-slate-400 uppercase bg-[#080B14] border-b border-[#18233C] tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 font-bold">Module Code</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Module Name & Route</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Category</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Global Status</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">Description</th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18233C]/60 text-xs">
                  {filteredModules.map((mod) => (
                    <tr key={mod.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Module Code */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-600/40 shadow-sm flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                            {mod.code}
                          </span>
                        </div>
                      </td>

                      {/* Module Name & Route */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white text-xs">{mod.name}</div>
                        {mod.route_path && (
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                            <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                            <span className="hover:text-blue-400 transition-colors">{mod.route_path}</span>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          mod.category === "Project"
                            ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                            : mod.category === "Core Tool"
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                            : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                        }`}>
                          {mod.category}
                        </span>
                      </td>

                      {/* Global Status (Interactive Toggle) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleModuleStatus(mod)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                            mod.is_active
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:bg-emerald-500/25"
                              : "bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.15)] hover:bg-red-500/25"
                          }`}
                          title={`Click to toggle status for module ${mod.code}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              mod.is_active
                                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                                : "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]"
                            }`}
                          />
                          <span>{mod.is_active ? "Active" : "Deactivated"}</span>
                          <Power className="w-3 h-3 ml-1 opacity-70" />
                        </button>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3.5 max-w-xs text-[11px] text-slate-400 leading-relaxed">
                        {mod.description || "No description provided."}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModule(mod)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Module Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredModules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="p-3.5 rounded-full bg-slate-850 border border-slate-800 text-slate-500">
                            <Code2 className="w-8 h-8 opacity-50" />
                          </div>
                          <div className="text-sm font-bold text-white">
                            {moduleSearch ? "No Modules Match Your Search" : "No Modules Available"}
                          </div>
                          <p className="text-xs text-slate-400 max-w-sm">
                            {moduleSearch
                              ? `No module matched the search criteria "${moduleSearch}".`
                              : "No modules registered in the Turso module table."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Delete User Account</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to remove this user? They will lose all access permissions across DICT Region 5 dashboards.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteConfirmId)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white shadow-lg shadow-red-900/30 transition-colors flex items-center gap-1.5"
              >
                {isDeleting && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Delete Account"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module Add / Edit Modal */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl max-w-lg w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#18233C] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingModule ? `Edit Module: ${editingModule.code}` : "Register New System Module"}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Turso Table: module • Configures system module code and activation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModuleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1">
                    <span>Module Code</span>
                    <span className="text-emerald-400 font-mono text-[10px]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MOD_INVENTORY"
                    value={moduleFormCode}
                    onChange={(e) => setModuleFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Auto-prefixed with MOD_</span>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Category</label>
                  <select
                    value={moduleFormCategory}
                    onChange={(e) => setModuleFormCategory(e.target.value)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Project">DICT Project</option>
                    <option value="Core Tool">Core System Tool</option>
                    <option value="Management">Management & Settings</option>
                    <option value="Utility">Utility Service</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">
                  Module Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regional Equipment Inventory System"
                  value={moduleFormName}
                  onChange={(e) => setModuleFormName(e.target.value)}
                  className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Short Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Inventory"
                    value={moduleFormShortName}
                    onChange={(e) => setModuleFormShortName(e.target.value)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Route Path (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. /projects/inventory"
                    value={moduleFormRoute}
                    onChange={(e) => setModuleFormRoute(e.target.value)}
                    className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the module function and scope..."
                  value={moduleFormDesc}
                  onChange={(e) => setModuleFormDesc(e.target.value)}
                  className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="p-3 bg-[#111728] border border-[#1C2844] rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Initial Status</span>
                  <span className="text-[10px] text-slate-400">
                    Determines whether the module is globally active or deactivated
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setModuleFormActive((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs border transition-all cursor-pointer flex items-center gap-1.5 ${
                    moduleFormActive
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-red-500/20 text-red-300 border-red-500/40"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${moduleFormActive ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span>{moduleFormActive ? "Active" : "Deactivated"}</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#18233C]">
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingModule}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-900/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingModule && <RefreshCw className="w-3 h-3 animate-spin" />}
                  <span>{editingModule ? "Update Module" : "Create Module"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable User Modal (Add & Edit) */}
      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsModalOpen(false);
            setEditingUser(null);
          }
        }}
        onSave={handleSaveUser}
        initialUser={editingUser}
        isSubmitting={isSubmitting}
      />

    </div>
  );
}
