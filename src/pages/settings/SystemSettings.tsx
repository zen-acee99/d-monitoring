import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
  MapPin,
  CalendarClock,
  Clock,
  Calendar,
  AlertTriangle,
  Save,
  BookmarkCheck,
  Sliders,
  Sun,
  Moon,
  FileKey,
  KeyRound,
  Eye,
  EyeOff,
  UploadCloud,
  FileSignature,
  Building2,
  Phone,
  Mail,
  User,
  CheckCircle
} from "lucide-react";
import { PROJECTS } from "@/config/projects";
import { getStoredUsers, saveStoredUsers, UserRecord } from "@/data/userStore";
import { UserModal, ROLE_OPTIONS, REGION_OPTIONS } from "@/components/users/UserModal";
import {
  administrationApi,
  modulesApi,
  SystemModule,
  dtrScheduleSettingsApi,
  DtrWorkScheduleSetting,
  dtrGeneratorApi,
  dtrUserSetupApi
} from "@/services/api";
import {
  inspectP12Keystore,
  P12SignerIdentity,
  formatPnpkiDate
} from "@/services/pnpkiCertificateService";
import { createFullAccessMatrix, createEmptyAccessMatrix, syncCurrentUserIfUpdated, getCurrentUser, hasModuleAccess, AUTH_EVENT, setCachedSystemModules } from "@/services/authStore";
import { getTheme, toggleTheme, THEME_EVENT, AppTheme } from "@/services/themeStore";

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

export function SystemSettings({
  defaultTab,
}: {
  defaultTab?: "directory" | "modules" | "schedule" | "profile";
} = {}) {
  const [currentUser, setCurrentUserSession] = useState(() => getCurrentUser());
  const currentUserEmail = (currentUser?.email || "").toLowerCase().trim();
  const isAceUser = currentUserEmail === "ace.malto@dict.gov.ph" || currentUserEmail === "acemm.1599@gmail.com";

  useEffect(() => {
    const handleAuth = () => setCurrentUserSession(getCurrentUser());
    window.addEventListener(AUTH_EVENT, handleAuth);
    return () => window.removeEventListener(AUTH_EVENT, handleAuth);
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = (searchParams.get("tab") as any) || defaultTab;

  const isSuperAdminOrDirector =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Admin" ||
    currentUser?.role === "Regional Director" ||
    currentUser?.role === "OIC- Regional Director" ||
    currentUser?.role === "Asst. Regional Director" ||
    currentUser?.role === "Assistant Regional Director" ||
    currentUser?.role === "OIC Chief - Technical Operations Division";
  const canGlobalEdit = isSuperAdminOrDirector || (currentUser?.canEdit && hasModuleAccess(currentUser, "MOD_ADMIN"));

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"directory" | "modules" | "schedule" | "profile">(() => {
    if (requestedTab === "profile" || requestedTab === "modules" || requestedTab === "schedule" || requestedTab === "directory") {
      return requestedTab;
    }
    return canGlobalEdit ? "directory" : "profile";
  });

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "profile" || tabParam === "modules" || tabParam === "schedule" || tabParam === "directory") {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Personnel Profile & PNPKI .p12 Keystore State
  const [profileName, setProfileName] = useState(currentUser?.name || "");
  const [profileDesignation, setProfileDesignation] = useState(currentUser?.role || "");
  const [profileStation, setProfileStation] = useState(currentUser?.region || "Region V (Bicol)");
  const [profileProvince, setProfileProvince] = useState(currentUser?.focalProvince || "Albay");
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || "");
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || "");
  const [supervisorName, setSupervisorName] = useState("DIR. CARMELITA H. CENTENO");
  const [supervisorTitle, setSupervisorTitle] = useState("Regional Director, DICT Region V");
  const [otcUsername, setOtcUsername] = useState("");
  const [otcPassword, setOtcPassword] = useState("");

  // PNPKI .p12 & Digital Signature State
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [p12File, setP12File] = useState<{ name: string; size: number; base64: string } | null>(null);
  const [p12Password, setP12Password] = useState("");
  const [showP12Password, setShowP12Password] = useState(false);
  const [savePasswordToDb, setSavePasswordToDb] = useState(true);
  const [isP12Unlocked, setIsP12Unlocked] = useState(false);
  const [isP12PasswordSaved, setIsP12PasswordSaved] = useState(false);
  const [p12SignerIdentity, setP12SignerIdentity] = useState<P12SignerIdentity | null>(null);
  const [p12Error, setP12Error] = useState<string | null>(null);
  const [profileRecordId, setProfileRecordId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileTimestamp, setProfileTimestamp] = useState(() => formatPnpkiDate());
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

  // DTR Work Schedule Settings State (Turso table: dtr_work_schedule_settings)
  const [scheduleSetting, setScheduleSetting] = useState<DtrWorkScheduleSetting>({
    id: "main_schedule_setting",
    scheduleName: "Standard 5-Day Workweek",
    workDaysPerWeek: 5,
    workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    hoursPerDay: 8,
    standardAmArrival: "08:00",
    standardAmDeparture: "12:00",
    standardPmArrival: "13:00",
    standardPmDeparture: "17:00",
    regularHoursLabel: "8:00 AM - 5:00 PM",
    saturdayHoursLabel: "As Required",
    noWorkDayLabel: "NO WORK: 4-DAY WORKWEEK",
    gracePeriodMinutes: 0,
    isActive: true,
  });
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

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

  const loadScheduleSetting = async () => {
    setLoadingSchedule(true);
    try {
      const s = await dtrScheduleSettingsApi.getSettings();
      if (s) setScheduleSetting(s);
    } catch (e) {
      console.warn("Failed to load schedule settings:", e);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSaveScheduleSetting = async () => {
    setIsSavingSchedule(true);
    try {
      const res = await dtrScheduleSettingsApi.saveSettings({
        ...scheduleSetting,
        updatedBy: currentUser?.name || "HRM Administrator",
      });
      if (res.success && res.setting) {
        setScheduleSetting(res.setting);
        showToast("Work schedule policy saved to Turso database!", "success");
      } else {
        showToast(res.error || "Failed to save schedule policy", "error");
      }
    } catch (err: any) {
      showToast("Error saving schedule: " + (err.message || "Failed"), "error");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // Preset quick apply handler
  const handleApplySchedulePreset = (preset: "standard_5day" | "compressed_4day") => {
    if (preset === "standard_5day") {
      setScheduleSetting((prev) => ({
        ...prev,
        scheduleName: "Standard 5-Day Workweek",
        workDaysPerWeek: 5,
        workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        hoursPerDay: 8,
        standardAmArrival: "08:00",
        standardAmDeparture: "12:00",
        standardPmArrival: "13:00",
        standardPmDeparture: "17:00",
        regularHoursLabel: "8:00 AM - 5:00 PM",
        saturdayHoursLabel: "As Required",
        noWorkDayLabel: "NO WORK: 4-DAY WORKWEEK",
      }));
      showToast("Applied Standard 5-Day Workweek preset (8 hrs/day). Click 'Save Work Schedule' to persist.", "info");
    } else if (preset === "compressed_4day") {
      setScheduleSetting((prev) => ({
        ...prev,
        scheduleName: "4-Day Compressed Workweek (Friday No Work)",
        workDaysPerWeek: 4,
        workDays: ["Monday", "Tuesday", "Wednesday", "Thursday"],
        hoursPerDay: 10,
        standardAmArrival: "08:00",
        standardAmDeparture: "12:00",
        standardPmArrival: "13:00",
        standardPmDeparture: "19:00",
        regularHoursLabel: "8:00 AM - 7:00 PM",
        saturdayHoursLabel: "As Required",
        noWorkDayLabel: "NO WORK: 4-DAY WORKWEEK",
      }));
      showToast("Applied 4-Day Compressed Workweek preset (10 hrs/day, Friday No Work). Click 'Save Work Schedule' to persist.", "info");
    }
  };

  const handleToggleWorkDay = (day: string) => {
    const current = scheduleSetting.workDays || [];
    let updated: string[];
    if (current.includes(day)) {
      if (current.length <= 1) {
        showToast("At least 1 working day must remain active.", "error");
        return;
      }
      updated = current.filter((d) => d !== day);
    } else {
      updated = [...current, day];
    }
    setScheduleSetting((prev) => ({
      ...prev,
      workDays: updated,
      workDaysPerWeek: updated.length,
    }));
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



  const loadPersonnelProfileAndP12 = async () => {
    const user = currentUser || getCurrentUser();
    if (!user || !user.id) return;
    setLoadingProfile(true);
    setP12Error(null);
    try {
      // 1. Load DTR User Setup
      const setup = await dtrUserSetupApi.getSetup(String(user.id));
      if (setup) {
        if (setup.employee_name || setup.employeeName) setProfileName(setup.employee_name || setup.employeeName || "");
        if (setup.province) setProfileProvince(setup.province);
        if (setup.supervisor_name || setup.supervisorName) setSupervisorName(setup.supervisor_name || setup.supervisorName || "");
        if (setup.supervisor_title || setup.supervisorTitle) setSupervisorTitle(setup.supervisor_title || setup.supervisorTitle || "");
        if (setup.otc_username || setup.otcUsername) setOtcUsername(setup.otc_username || setup.otcUsername || "");
        if (setup.otc_password || setup.otcPassword) setOtcPassword(setup.otc_password || setup.otcPassword || "");
      } else {
        if (user.name) setProfileName(user.name);
        if (user.role) setProfileDesignation(user.role);
        if (user.region) setProfileStation(user.region);
        if (user.focalProvince) setProfileProvince(user.focalProvince);
        if (user.phone) setProfilePhone(user.phone);
        if (user.email) setProfileEmail(user.email);
      }

      // 2. Load PNPKI .p12 Keystore & Signature Profile from Turso
      const records = await dtrGeneratorApi.getRecords({ user_Id: String(user.id) });
      const userSigRecord = records.find(
        (r) => r.user_Id === String(user.id) || r.id === `dtr-sig-${user.id}`
      ) || records[0];

      if (userSigRecord) {
        setProfileRecordId(userSigRecord.id);
        let fullRecord = userSigRecord;
        if (!fullRecord.p12 && (fullRecord.hasP12 || fullRecord.p12_filename)) {
          const fetched = await dtrGeneratorApi.getRecord(userSigRecord.id);
          if (fetched) fullRecord = fetched;
        }

        if (fullRecord.image_digiSigned) {
          setSignatureImage(fullRecord.image_digiSigned);
        }

        if ((fullRecord.p12 || fullRecord.hasP12) && fullRecord.p12_filename) {
          const rawBase64 = fullRecord.p12 || "";
          setP12File({
            name: fullRecord.p12_filename,
            size: fullRecord.p12_filesize || 0,
            base64: rawBase64,
          });

          if (fullRecord.hasP12Password) {
            setIsP12Unlocked(true);
            setIsP12PasswordSaved(true);
            try {
              const idRes = await dtrGeneratorApi.getP12Identity({
                profileId: fullRecord.id,
                user_Id: String(user.id),
              });
              if (idRes.success && idRes.identity) {
                setP12SignerIdentity(idRes.identity as P12SignerIdentity);
              }
            } catch {
              if (rawBase64) {
                const clientRes = inspectP12Keystore(rawBase64, "");
                if (clientRes.success) {
                  setP12SignerIdentity(clientRes.identity);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("Failed to load personnel profile and .p12:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleP12FileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".p12") && !file.name.toLowerCase().endsWith(".pfx")) {
      setP12Error("Please select a valid .p12 or .pfx PKCS#12 certificate file.");
      showToast("Invalid file type. Only .p12 or .pfx files supported.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setP12File({
        name: file.name,
        size: file.size,
        base64,
      });
      setIsP12Unlocked(false);
      setP12SignerIdentity(null);
      setP12Error(null);
      showToast(`Loaded ${file.name}. Enter keystore password to unlock.`, "info");
    };
    reader.readAsDataURL(file);
  };

  const handleUnlockP12Keystore = async () => {
    if (!p12File?.base64) {
      setP12Error("No .p12 certificate file loaded.");
      return;
    }
    if (!p12Password) {
      setP12Error("Please enter your .p12 keystore password.");
      return;
    }

    setP12Error(null);

    // 1. Try pure JavaScript client-side node-forge inspection
    const clientInspection = inspectP12Keystore(p12File.base64, p12Password);
    if (clientInspection.success) {
      setIsP12Unlocked(true);
      setP12SignerIdentity(clientInspection.identity);
      setP12Error(null);
      showToast(`✓ Keystore verified for ${clientInspection.identity.commonName}!`, "success");
      return;
    }

    const clientError = clientInspection.error || "Incorrect password or corrupted keystore.";

    // 2. Try backend inspection via dtrGeneratorApi.getP12Identity fallback
    try {
      const serverRes = await dtrGeneratorApi.getP12Identity({
        p12: p12File.base64,
        p12_password: p12Password,
        user_Id: currentUser?.id ? String(currentUser.id) : undefined,
      });
      if (serverRes.success && serverRes.identity) {
        setIsP12Unlocked(true);
        setP12SignerIdentity(serverRes.identity as P12SignerIdentity);
        setP12Error(null);
        showToast(`✓ Keystore verified for ${serverRes.identity.commonName}!`, "success");
        return;
      } else {
        setP12Error(serverRes.error || clientError);
      }
    } catch {
      setP12Error(clientError);
    }
  };

  const handleSignatureImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a PNG or JPG signature image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setSignatureImage(base64);
      showToast("Digital signature image uploaded successfully!", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleClearP12Keystore = async () => {
    if (!window.confirm("Are you sure you want to remove your .p12 digital certificate from this account?")) {
      return;
    }
    setP12File(null);
    setP12Password("");
    setIsP12Unlocked(false);
    setIsP12PasswordSaved(false);
    setP12SignerIdentity(null);
    setP12Error(null);

    if (currentUser?.id) {
      try {
        await dtrGeneratorApi.saveSignatureProfile({
          id: `dtr-sig-${currentUser.id}`,
          user_Id: String(currentUser.id),
          Name: profileName || currentUser.name || "PERSONNEL",
          clear_p12: true,
          image_digiSigned: signatureImage,
        });
        showToast("PNPKI .p12 certificate cleared from your profile.", "info");
      } catch (err) {
        console.warn("Failed to clear p12 in backend:", err);
      }
    }
  };

  const handleClearSignatureImage = async () => {
    setSignatureImage(null);
    if (currentUser?.id) {
      try {
        await dtrGeneratorApi.saveSignatureProfile({
          id: `dtr-sig-${currentUser.id}`,
          user_Id: String(currentUser.id),
          Name: profileName || currentUser.name || "PERSONNEL",
          image_digiSigned: null,
          p12: p12File?.base64,
          p12_filename: p12File?.name,
          p12_filesize: p12File?.size,
        });
        showToast("Signature image removed.", "info");
      } catch (err) {
        console.warn("Failed to clear signature image:", err);
      }
    }
  };

  const handleSavePersonnelProfile = async () => {
    const user = currentUser || getCurrentUser();
    if (!user?.id) {
      showToast("Please sign in first to save your profile.", "error");
      return;
    }
    if (!profileName.trim()) {
      showToast("Please provide your official personnel name.", "error");
      return;
    }

    setIsSavingProfile(true);
    try {
      // 1. Save DTR User Setup (Biometrics, Supervisor, Province)
      const setupRes = await dtrUserSetupApi.saveSetup({
        userId: String(user.id),
        employeeName: profileName.trim(),
        province: profileProvince,
        supervisorName: supervisorName.trim(),
        supervisorTitle: supervisorTitle.trim(),
        otcUsername: otcUsername.trim(),
        otcPassword: otcPassword.trim(),
      });

      // 2. Save PNPKI .p12 Keystore & Signature Profile
      const nameToSave = (p12SignerIdentity?.commonName || profileName || user.name || "PERSONNEL").trim();
      const sigPayload: any = {
        id: user.id ? `dtr-sig-${user.id}` : profileRecordId || undefined,
        user_Id: String(user.id),
        Name: nameToSave,
        image_digiSigned: signatureImage,
      };

      if (p12File?.base64) {
        sigPayload.p12 = p12File.base64;
        sigPayload.p12_filename = p12File.name;
        sigPayload.p12_filesize = p12File.size;
      }
      if (savePasswordToDb && p12Password) {
        sigPayload.p12_password = p12Password;
      }

      const sigRes = await dtrGeneratorApi.saveSignatureProfile(sigPayload);

      // 3. Update user session in authStore so the entire UI immediately updates
      const updatedUser: UserRecord = {
        ...user,
        name: profileName.trim(),
        role: profileDesignation.trim() || user.role,
        region: profileStation.trim() || user.region,
        focalProvince: profileProvince,
        phone: profilePhone.trim() || user.phone,
        email: profileEmail.trim() || user.email,
      };
      syncCurrentUserIfUpdated(updatedUser);

      // Also persist to local users database store
      const storedUsers = getStoredUsers();
      const updatedStored = storedUsers.map((u) =>
        String(u.id) === String(user.id) ? { ...u, ...updatedUser } : u
      );
      saveStoredUsers(updatedStored);
      setUsers(updatedStored);

      if (sigRes.success || setupRes.success) {
        showToast(
          isAceUser
            ? "✓ Personal Profile, PNPKI .p12 keystore & signature saved to Turso database!"
            : "✓ Personal Profile & signature saved to Turso database!",
          "success"
        );
        if (savePasswordToDb && p12Password) {
          setIsP12PasswordSaved(true);
          setIsP12Unlocked(true);
        }
      } else {
        showToast(`⚠️ Notice: ${sigRes.error || setupRes.error || "Saved with notices."}`, "info");
      }
    } catch (err: any) {
      console.error("Save profile error:", err);
      showToast(`Error saving profile: ${err.message || "Failed to save."}`, "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadModules();
    loadScheduleSetting();
    loadPersonnelProfileAndP12();
  }, [currentUser]);

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
      const existingMatch = users.find(
        (u) =>
          String(u.id) === String(userData.id) ||
          (u.email && userData.email && u.email.toLowerCase() === userData.email.toLowerCase())
      );
      if (existingMatch) {
        const targetId = existingMatch.id || userData.id;
        const saved = await administrationApi.updateAdministrator(targetId, userData as any);
        if (!saved) {
          throw new Error("Could not update personnel record in database. Please verify connection or permissions.");
        }
        const resolved = saved as UserRecord;
        setUsers((prev) => {
          const updated = prev.map((u) =>
            String(u.id) === String(targetId) ||
            String(u.id) === String(userData.id) ||
            (u.email && resolved.email && u.email.toLowerCase() === resolved.email.toLowerCase())
              ? resolved
              : u
          );
          saveStoredUsers(updated);
          return updated;
        });
        syncCurrentUserIfUpdated(resolved);
        window.dispatchEvent(new CustomEvent("dict_users_updated", { detail: resolved }));
        window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: getCurrentUser() }));
        showToast(`Personnel "${resolved.name}" successfully updated in Turso!`, "success");
      } else {
        if (!canGlobalEdit) {
          showToast("Access Denied: Only administrators can register new accounts.", "error");
          return;
        }
        const saved = await administrationApi.createAdministrator(userData as any);
        if (!saved) {
          throw new Error("Could not register personnel record in database.");
        }
        const resolved = saved as UserRecord;
        setUsers((prev) => {
          const updated = [resolved, ...prev];
          saveStoredUsers(updated);
          return updated;
        });
        window.dispatchEvent(new CustomEvent("dict_users_updated", { detail: resolved }));
        showToast(`New personnel "${resolved.name}" successfully registered in Turso!`, "success");
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

  const handleRemoveFocal = async (user: UserRecord) => {
    if (!canGlobalEdit) {
      showToast("Access Denied: Only administrators can modify focal designations.", "error");
      return;
    }
    const payload = {
      ...user,
      isFocal: false,
      focalProject: null as any,
      pnpkiRole: null as any,
    };
    try {
      const saved = await administrationApi.updateAdministrator(user.id, payload as any);
      const resolved: UserRecord = saved
        ? { ...(saved as UserRecord), isFocal: false, focalProject: undefined, pnpkiRole: undefined }
        : { ...user, isFocal: false, focalProject: undefined, pnpkiRole: undefined };
      setUsers((prev) => {
        const updated = prev.map((u) => (String(u.id) === String(user.id) ? resolved : u));
        saveStoredUsers(updated);
        return updated;
      });
      syncCurrentUserIfUpdated(resolved);
      window.dispatchEvent(new CustomEvent("dict_users_updated", { detail: resolved }));
      showToast(`Removed Focal Person designation from ${user.name}.`, "success");
    } catch (err: any) {
      showToast("Failed to remove focal designation: " + (err.message || "Error"), "error");
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
      (u.role || "").toLowerCase().includes(search.toLowerCase()) ||
      u.region.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      selectedRole === "All" ||
      (selectedRole === "Custom"
        ? !ROLE_OPTIONS.some((r) => r.value === u.role)
        : u.role === selectedRole);
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

  // Filtered module list from Turso table: module (excluding hidden Regional Calendar)
  const visibleModules = useMemo(
    () => modules.filter((m) => m.code !== "MOD_CALENDAR" && m.id !== "mod-calendar" && m.id !== "calendar"),
    [modules]
  );

  const filteredModules = useMemo(() => {
    return visibleModules.filter((m) => {
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
  }, [visibleModules, moduleSearch, moduleCategoryFilter, moduleStatusFilter]);

  const totalModules = visibleModules.length;
  const activeModulesCount = visibleModules.filter((m) => m.is_active).length;
  const deactivatedModulesCount = visibleModules.filter((m) => !m.is_active).length;
  const projectModulesCount = visibleModules.filter((m) => m.category === "Project").length;

  const [currentTheme, setCurrentTheme] = useState<AppTheme>(() => getTheme());
  const [isSavingTheme, setIsSavingTheme] = useState(false);

  useEffect(() => {
    const handleTheme = (e: Event) => {
      const customEv = e as CustomEvent<AppTheme>;
      setCurrentTheme(customEv.detail || getTheme());
    };
    window.addEventListener(THEME_EVENT, handleTheme);
    return () => window.removeEventListener(THEME_EVENT, handleTheme);
  }, []);

  const handleToggleAppTheme = async () => {
    setIsSavingTheme(true);
    const { theme: nextTheme, savedToDb } = await toggleTheme();
    setCurrentTheme(nextTheme);
    setIsSavingTheme(false);
    showToast(
      `Switched to ${nextTheme === "light" ? "White / Light" : "Dark"} Theme${savedToDb ? " (Saved to Turso DB)" : ""}!`,
      "success"
    );
  };

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

        <div className="flex flex-wrap items-center gap-2 z-10">
          <button
            type="button"
            onClick={handleToggleAppTheme}
            disabled={isSavingTheme}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              currentTheme === "light"
                ? "bg-amber-500/15 border-amber-500/40 text-amber-600 hover:bg-amber-500/25"
                : "bg-[#111728] hover:bg-[#1C263E] border-[#1C2844] text-slate-200"
            }`}
            title="Toggle Dark / White Theme and save to Turso Database"
          >
            {currentTheme === "light" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Theme: White (Saved in DB)</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-blue-400" />
                <span>Theme: Dark (Saved in DB)</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              loadUsers();
              loadModules();
              loadScheduleSetting();
              loadPersonnelProfileAndP12();
            }}
            disabled={loading || loadingModules || loadingSchedule || loadingProfile}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#111728] hover:bg-[#1C263E] border border-[#1C2844] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh personnel, modules, schedule policy, and PNPKI profile from Turso database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${loading || loadingModules || loadingSchedule || loadingProfile ? "animate-spin" : ""}`} />
            <span>Sync Turso</span>
          </button>

          {activeTab === "profile" ? (
            <button
              onClick={handleSavePersonnelProfile}
              disabled={isSavingProfile}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-purple-900/40 cursor-pointer disabled:opacity-50"
            >
              {isSavingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSavingProfile ? "Saving Profile..." : "Save Profile & PNPKI .p12"}</span>
            </button>
          ) : activeTab === "schedule" ? (
            <button
              onClick={handleSaveScheduleSetting}
              disabled={isSavingSchedule}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-amber-900/40 cursor-pointer disabled:opacity-50"
            >
              {isSavingSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSavingSchedule ? "Saving..." : "Save Work Schedule"}</span>
            </button>
          ) : activeTab === "modules" ? (
            <button
              onClick={handleOpenAddModule}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-900/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Module
            </button>
          ) : (
            canGlobalEdit && (
              <button
                onClick={() => {
                  setEditingUser(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Add Personnel
              </button>
            )
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {activeTab === "profile" ? (
        <div className={`grid grid-cols-2 ${isAceUser ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Personnel Name
            </div>
            <div className="text-xl font-black text-white font-mono mt-1 truncate">
              {profileName || currentUser?.name || "Personnel"}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              {profileDesignation || currentUser?.role || "Staff Member"}
            </div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Station / Office
            </div>
            <div className="text-xl font-black text-cyan-400 font-mono mt-1 truncate">
              {profileProvince || "Albay"}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              {profileStation || "Region V (Bicol)"}
            </div>
          </div>

          {/* PNPKI .p12 Keystore KPI Card (Visible exclusively to ace.malto@dict.gov.ph) */}
          {isAceUser && (
            <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
              <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> PNPKI .p12 Keystore
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-1 truncate flex items-center gap-1.5">
                {isP12Unlocked ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Verified & Active</span>
                  </>
                ) : p12File ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span>Locked (.p12 Loaded)</span>
                  </>
                ) : (
                  <span className="text-slate-500 font-normal text-sm">Not Uploaded</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                {p12SignerIdentity?.sha256Fingerprint ? `SHA: ${p12SignerIdentity.sha256Fingerprint.slice(0, 17)}...` : "Civil Service Form 48 Ready"}
              </div>
            </div>
          )}

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <FileSignature className="w-3.5 h-3.5" /> Digital Stamp & Image
            </div>
            <div className="text-xl font-black text-purple-400 font-mono mt-1 truncate">
              {signatureImage ? "Signature Loaded" : "No Signature"}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
              {signatureImage ? (
                <>
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Transparent Stamp Ready
                </>
              ) : (
                <span className="text-slate-500 font-normal">Upload transparent PNG</span>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "schedule" ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Working Days
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {scheduleSetting.workDaysPerWeek} Days / Week
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              {scheduleSetting.workDays?.join(", ") || "Mon - Fri"}
            </div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Daily Render Target
            </div>
            <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
              {scheduleSetting.hoursPerDay} Hours / Day
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {scheduleSetting.hoursPerDay * scheduleSetting.workDaysPerWeek} hrs total weekly target
            </div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" /> Core Work Hours
            </div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1 truncate">
              {scheduleSetting.regularHoursLabel || `${scheduleSetting.standardAmArrival} - ${scheduleSetting.standardPmDeparture}`}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Lunch: {scheduleSetting.standardAmDeparture} - {scheduleSetting.standardPmArrival}
            </div>
          </div>

          <div className="bg-[#0C101D] border border-[#18233C] p-4 rounded-2xl">
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
              <BookmarkCheck className="w-3.5 h-3.5" /> Active Schedule Policy
            </div>
            <div className="text-sm font-black text-purple-300 font-mono mt-1 truncate">
              {scheduleSetting.scheduleName}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Applied to DTR Form 48 & Provincial
            </div>
          </div>
        </div>
      ) : activeTab === "modules" ? (
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

        <button
          type="button"
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "schedule"
              ? "bg-amber-600 text-white shadow-lg shadow-amber-900/30"
              : "bg-[#0C101D] text-slate-400 border border-[#18233C] hover:text-white hover:border-slate-700"
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          HRM & Work Schedule Policy
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === "schedule" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>
            {scheduleSetting.workDaysPerWeek}D / {scheduleSetting.hoursPerDay}H
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "profile"
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30"
              : "bg-[#0C101D] text-slate-400 border border-[#18233C] hover:text-white hover:border-slate-700"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-purple-300" />
          {isAceUser ? "Personnel Profile & PNPKI .p12 Keystore" : "Personnel Profile"}
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === "profile" ? "bg-white/20 text-white" : isP12Unlocked ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
          }`}>
            {isAceUser ? (isP12Unlocked ? "Verified" : p12File ? "Locked" : "Setup") : (signatureImage ? "Ready" : "Setup")}
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
        ) : activeTab === "directory" ? (
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
                <option value="Custom">Custom / Other Positions</option>
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
        ) : null}

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

                      {/* Focal Status / Project Handled */}
                      <td className="px-6 py-4">
                        {user.isFocal ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                {focalProjObj ? focalProjObj.shortName : user.focalProject ? user.focalProject.toUpperCase() : "Focal Person"}
                                {user.pnpkiRole && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-400/40 font-mono text-[9px] font-black">
                                    {user.pnpkiRole}
                                  </span>
                                )}
                              </span>
                              {canGlobalEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFocal(user)}
                                  title={`Remove Focal designation from ${user.name}`}
                                  className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            {focalProjObj && (
                              <div className="text-[11px] text-emerald-400 font-semibold">
                                {user.role} &gt; {focalProjObj.shortName}
                                {user.pnpkiRole ? ` (${user.pnpkiRole})` : ` (${focalProjObj.category})`}
                              </div>
                            )}
                            {user.focalProvince && (
                              <div className="text-[10px] text-emerald-300/90 font-medium">
                                Scope: {user.focalProvince}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="text-slate-500 text-[11px] font-medium">Non-Focal</span>
                            {user.focalProvince && user.focalProvince !== "All Provinces / Regional" && (
                              <div className="text-[10px] text-slate-400">
                                Scope: {user.focalProvince}
                              </div>
                            )}
                          </div>
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
                        {user.canEdit && (focalProjObj || isDirector || isAsstDirector || isSuperAdmin) ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {focalProjObj ? `Can Edit: ${focalProjObj.shortName} Only` : "Can Edit: All Projects"}
                            </span>
                            {focalProjObj && (
                              <div className="text-[9.5px] text-slate-400">
                                Other projects: Read-Only
                              </div>
                            )}
                          </div>
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

        {/* View 3: HRM & Work Schedule Policy (Table: dtr_work_schedule_settings) */}
        {activeTab === "schedule" && (
          <div className="flex flex-col">
            {/* Header / Intro bar */}
            <div className="p-5 bg-[#0A0E1A] border-b border-[#18233C] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Turso Cloud Table: <code className="text-amber-400 font-mono font-black">dtr_work_schedule_settings</code>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live in Form 48 & Provincial
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure work days per week (e.g. 4-Day vs 5-Day), required daily rendered hours (e.g. 10 hrs vs 8 hrs), standard time in/out, and auto smart tags.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveScheduleSetting}
                  disabled={isSavingSchedule}
                  className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-amber-900/40 cursor-pointer disabled:opacity-50"
                >
                  {isSavingSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSavingSchedule ? "Saving..." : "Save Work Schedule Policy"}</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Preset Selector */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Quick Schedule Presets
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Preset 1: Standard 5-Day */}
                  <div
                    onClick={() => handleApplySchedulePreset("standard_5day")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      scheduleSetting.workDaysPerWeek === 5 && scheduleSetting.hoursPerDay === 8
                        ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-950/40"
                        : "bg-[#111728] border-[#1C2844] hover:border-slate-600 hover:bg-[#151D33]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-sm">Standard 5-Day Workweek</h4>
                          {scheduleSetting.workDaysPerWeek === 5 && scheduleSetting.hoursPerDay === 8 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Monday to Friday • 8 Hours / Day (40 hrs/week) • 8:00 AM - 5:00 PM
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
                        <span key={d} className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
                          {d} (8h)
                        </span>
                      ))}
                      {["Sat", "Sun"].map((d) => (
                        <span key={d} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-500 border border-slate-700 text-[10px]">
                          {d} (Off)
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Preset 2: 4-Day Compressed */}
                  <div
                    onClick={() => handleApplySchedulePreset("compressed_4day")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      scheduleSetting.workDaysPerWeek === 4 && scheduleSetting.hoursPerDay === 10
                        ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-950/40"
                        : "bg-[#111728] border-[#1C2844] hover:border-slate-600 hover:bg-[#151D33]"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-white text-sm">4-Day Compressed Workweek</h4>
                          {scheduleSetting.workDaysPerWeek === 4 && scheduleSetting.hoursPerDay === 10 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Monday to Thursday • 10 Hours / Day (40 hrs/week) • Friday is NO WORK (Auto Smart Tagged)
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <CalendarClock className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["Mon", "Tue", "Wed", "Thu"].map((d) => (
                        <span key={d} className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold text-[10px]">
                          {d} (10h)
                        </span>
                      ))}
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                        Fri (No Work)
                      </span>
                      {["Sat", "Sun"].map((d) => (
                        <span key={d} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-500 border border-slate-700 text-[10px]">
                          {d} (Off)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Working Days Configuration */}
              <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      Official Working Days in Week ({scheduleSetting.workDaysPerWeek} Days Active)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Click to toggle which days are official work days vs off days (unselected days will be automatically tagged as NO WORK).
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-xl">
                    {scheduleSetting.workDaysPerWeek} Working Days / Week
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                    const isSelected = (scheduleSetting.workDays || []).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleWorkDay(day)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/15 border-amber-500/50 text-white shadow-md shadow-amber-950/30"
                            : "bg-[#0A0E1A] border-[#18233C] text-slate-500 hover:text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-xs font-black">{day.substring(0, 3)}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          isSelected ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-500"
                        }`}>
                          {isSelected ? `${scheduleSetting.hoursPerDay}h Work` : "No Work"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Working Hours & Daily Target Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left Column: Hours and Timings */}
                <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Daily Hours & Core Timings
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Daily Render Target (Hours/Day)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={scheduleSetting.hoursPerDay}
                        onChange={(e) =>
                          setScheduleSetting((prev) => ({
                            ...prev,
                            hoursPerDay: Math.max(1, parseInt(e.target.value) || 8),
                          }))
                        }
                        className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-500">
                        Default: 8 hrs (5-day) or 10 hrs (4-day)
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Grace Period (Minutes)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={scheduleSetting.gracePeriodMinutes || 0}
                        onChange={(e) =>
                          setScheduleSetting((prev) => ({
                            ...prev,
                            gracePeriodMinutes: Math.max(0, parseInt(e.target.value) || 0),
                          }))
                        }
                        className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-500">Tolerated arrival window</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Morning Arrival (AM In)</label>
                      <input
                        type="text"
                        value={scheduleSetting.standardAmArrival}
                        onChange={(e) =>
                          setScheduleSetting((prev) => ({ ...prev, standardAmArrival: e.target.value }))
                        }
                        placeholder="08:00"
                        className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Morning Departure (AM Out)</label>
                      <input
                        type="text"
                        value={scheduleSetting.standardAmDeparture}
                        onChange={(e) =>
                          setScheduleSetting((prev) => ({ ...prev, standardAmDeparture: e.target.value }))
                        }
                        placeholder="12:00"
                        className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Afternoon Arrival (PM In)</label>
                      <input
                        type="text"
                        value={scheduleSetting.standardPmArrival}
                        onChange={(e) =>
                          setScheduleSetting((prev) => ({ ...prev, standardPmArrival: e.target.value }))
                        }
                        placeholder="13:00"
                        className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300">Afternoon Departure (PM Out)</label>
                      <input
                        type="text"
                        value={scheduleSetting.standardPmDeparture}
                        onChange={(e) =>
                          setScheduleSetting((prev) => ({ ...prev, standardPmDeparture: e.target.value }))
                        }
                        placeholder="17:00"
                        className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Form 48 Display Labels & Smart Tagging */}
                <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-purple-400" />
                    Form 48 Header Labels & Smart Tagging
                  </h4>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Regular Days Header Text (Official Hours for arrival and departure)
                    </label>
                    <input
                      type="text"
                      value={scheduleSetting.regularHoursLabel}
                      onChange={(e) =>
                        setScheduleSetting((prev) => ({ ...prev, regularHoursLabel: e.target.value }))
                      }
                      placeholder="e.g. 8:00 AM - 7:00 PM (Mon-Thu)"
                      className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500">Printed on Civil Service Form 48 Header</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Saturdays Header Text
                    </label>
                    <input
                      type="text"
                      value={scheduleSetting.saturdayHoursLabel}
                      onChange={(e) =>
                        setScheduleSetting((prev) => ({ ...prev, saturdayHoursLabel: e.target.value }))
                      }
                      placeholder="e.g. As Required or NO WORK"
                      className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Non-Working Day Auto Smart Tag (e.g. for Friday in 4-day workweek)
                    </label>
                    <input
                      type="text"
                      value={scheduleSetting.noWorkDayLabel || "NO WORK: 4-DAY WORKWEEK"}
                      onChange={(e) =>
                        setScheduleSetting((prev) => ({ ...prev, noWorkDayLabel: e.target.value }))
                      }
                      placeholder="NO WORK: 4-DAY WORKWEEK"
                      className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <span className="text-[10px] text-amber-400/80">
                      Auto-filled across all 4 time slots when "Auto-Fill Weekends & Holidays" is executed
                    </span>
                  </div>
                </div>
              </div>

              {/* Policy Enforcement & Compliance Summary Notice */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-blue-950/40 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Active Policy Calculation Rules
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Under the <strong className="text-amber-300">{scheduleSetting.workDaysPerWeek}-Day ({scheduleSetting.hoursPerDay} hrs/day)</strong> schedule, 
                    late minutes are counted if arrival is past <code className="text-amber-300">{scheduleSetting.standardAmArrival}</code> (AM) or <code className="text-amber-300">{scheduleSetting.standardPmArrival}</code> (PM). 
                    Undertime is deducted if departure is before <code className="text-amber-300">{scheduleSetting.standardAmDeparture}</code> (AM) or <code className="text-amber-300">{scheduleSetting.standardPmDeparture}</code> (PM). 
                    Off-days (e.g. {!(scheduleSetting.workDays || []).includes("Friday") ? "Friday, " : ""}Saturday, Sunday) are exempt from late penalties when tagged.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveScheduleSetting}
                  disabled={isSavingSchedule}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white shadow-lg shadow-amber-900/30 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  {isSavingSchedule ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSavingSchedule ? "Saving..." : "Save Policy to Turso"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View 4: Personnel Profile & PNPKI .p12 Keystore */}
        {activeTab === "profile" && (
          <div className="flex flex-col">
            {/* Header / Intro bar */}
            <div className="p-5 bg-[#0A0E1A] border-b border-[#18233C] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {isAceUser ? "Personal Credentials & PNPKI Certificate Keystore" : "Personal Credentials & Signature Setup"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Turso Cloud: dtr_user_setup & dtr_generator
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAceUser
                      ? "Manage your official personnel identity, designation, provincial station, supervisor presets, biometric credentials, signature image, and PNPKI .p12 digital certificate."
                      : "Manage your official personnel identity, designation, provincial station, supervisor presets, biometric credentials, and digital signature image."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSavePersonnelProfile}
                  disabled={isSavingProfile}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-purple-900/40 cursor-pointer disabled:opacity-50"
                >
                  {isSavingProfile ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{isSavingProfile ? "Saving Profile..." : "Save Personnel Profile & .p12"}</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left 6 Columns: Personal Information & Presets */}
                <div className="lg:col-span-6 space-y-5">
                  <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#18233C] pb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-400" />
                        Official Personnel Profile
                      </h4>
                      <span className="text-[10px] text-slate-400">Used across DTR, UAT & Signatures</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Official Full Name <span className="text-purple-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          placeholder="e.g. Engr. Ace M. Malto"
                          className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Position / Designation
                          </label>
                          <input
                            type="text"
                            value={profileDesignation}
                            onChange={(e) => setProfileDesignation(e.target.value)}
                            placeholder="e.g. Engineer II / Provincial Officer"
                            className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Station / Provincial Office
                          </label>
                          <select
                            value={profileProvince}
                            onChange={(e) => setProfileProvince(e.target.value)}
                            className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                          >
                            <option value="Albay">Albay Provincial Office</option>
                            <option value="Camarines Norte">Camarines Norte Provincial Office</option>
                            <option value="Camarines Sur">Camarines Sur Provincial Office</option>
                            <option value="Catanduanes">Catanduanes Provincial Office</option>
                            <option value="Masbate">Masbate Provincial Office</option>
                            <option value="Sorsogon">Sorsogon Provincial Office</option>
                            <option value="Regional Office">DICT Region V - Regional Office (Legazpi)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-cyan-400" />
                            <span>Contact Phone</span>
                          </label>
                          <input
                            type="text"
                            value={profilePhone}
                            onChange={(e) => setProfilePhone(e.target.value)}
                            placeholder="+63 9XX XXX XXXX"
                            className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-blue-400" />
                            <span>Official Email Address</span>
                          </label>
                          <input
                            type="email"
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                            placeholder="name@dict.gov.ph"
                            className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Immediate Supervisor Presets */}
                  <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#18233C] pb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        Immediate Supervisor Presets (Civil Service Form 48)
                      </h4>
                      <span className="text-[10px] text-amber-400/80">Auto-filled in verified DTR</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Supervisor Full Name
                        </label>
                        <input
                          type="text"
                          value={supervisorName}
                          onChange={(e) => setSupervisorName(e.target.value)}
                          placeholder="e.g. DIR. CARMELITA H. CENTENO"
                          className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          Supervisor Official Title / Designation
                        </label>
                        <input
                          type="text"
                          value={supervisorTitle}
                          onChange={(e) => setSupervisorTitle(e.target.value)}
                          placeholder="e.g. Regional Director, DICT Region V"
                          className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Biometric Time Clock Credentials */}
                  <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#18233C] pb-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        Biometric Time Clock Sync (Open Time Clock)
                      </h4>
                      <span className="text-[10px] text-emerald-400">Turso table: dtr_user_setup</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          OTC Username
                        </label>
                        <input
                          type="text"
                          value={otcUsername}
                          onChange={(e) => setOtcUsername(e.target.value)}
                          placeholder="Your OTC login username"
                          className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300">
                          OTC Password / PIN
                        </label>
                        <input
                          type="password"
                          value={otcPassword}
                          onChange={(e) => setOtcPassword(e.target.value)}
                          placeholder="Optional biometric PIN"
                          className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 6 Columns: PNPKI .p12 Keystore & Digital Signature Image */}
                <div className="lg:col-span-6 space-y-5">
                  
                  {/* Card 1: PNPKI .p12 Digital Certificate (Visible exclusively to ace.malto@dict.gov.ph) */}
                  {isAceUser && (
                    <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#18233C] pb-3">
                      <div className="flex items-center gap-2">
                        <FileKey className="w-4 h-4 text-purple-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          PNPKI Digital Certificate (.p12 / .pfx)
                        </h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isP12Unlocked
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : p12File
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {isP12Unlocked ? "Verified & Active" : p12File ? "Locked (Password Required)" : "No Certificate Loaded"}
                      </span>
                    </div>

                    {/* File Upload Box */}
                    <div className="space-y-3">
                      {p12File ? (
                        <div className="p-3.5 rounded-xl bg-[#0A0E1A] border border-[#1C2844] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                              <FileKey className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-xs truncate font-mono">
                                {p12File.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {(p12File.size / 1024).toFixed(1)} KB • PKCS#12 Keystore
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer border border-slate-700 transition-colors">
                              <span>Replace</span>
                              <input
                                type="file"
                                accept=".p12,.pfx"
                                onChange={handleP12FileUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={handleClearP12Keystore}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove .p12 keystore"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#1C2844] hover:border-purple-500/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-[#0A0E1A]/50 hover:bg-purple-950/10 group">
                          <UploadCloud className="w-8 h-8 text-purple-400/70 group-hover:text-purple-400 transition-colors mb-2" />
                          <span className="text-xs font-bold text-white">
                            Upload PNPKI .p12 or .pfx Certificate
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Drag and drop or click to browse standard PKCS#12 digital keystore
                          </span>
                          <input
                            type="file"
                            accept=".p12,.pfx"
                            onChange={handleP12FileUpload}
                            className="hidden"
                          />
                        </label>
                      )}

                      {/* Password input & verification */}
                      {p12File && !isP12Unlocked && (
                        <div className="space-y-2.5 pt-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Keystore Password <span className="text-purple-400">*</span>
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <input
                                type={showP12Password ? "text" : "password"}
                                value={p12Password}
                                onChange={(e) => setP12Password(e.target.value)}
                                placeholder="Enter .p12 certificate password"
                                className="w-full bg-[#0A0E1A] border border-[#1C2844] rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleUnlockP12Keystore();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => setShowP12Password((p) => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              >
                                {showP12Password ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={handleUnlockP12Keystore}
                              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-950/40 transition-colors cursor-pointer shrink-0"
                            >
                              Unlock & Verify
                            </button>
                          </div>

                          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-300 pt-1">
                            <input
                              type="checkbox"
                              checked={savePasswordToDb}
                              onChange={(e) => setSavePasswordToDb(e.target.checked)}
                              className="rounded border-[#1C2844] bg-[#0A0E1A] text-purple-600 focus:ring-0 cursor-pointer"
                            />
                            <span>Save password in encrypted Turso database (Civil Service Form 48 1-click export)</span>
                          </label>
                        </div>
                      )}

                      {/* Error banner */}
                      {p12Error && (
                        <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{p12Error}</span>
                        </div>
                      )}

                      {/* Verified Signer Identity Metadata Grid */}
                      {isP12Unlocked && p12SignerIdentity && (
                        <div className="p-4 rounded-xl bg-[#0A0E1A] border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between border-b border-[#18233C] pb-2">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                              Cryptographic Signer Identity (Verified)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Chains: {p12SignerIdentity.caChainCount}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                            <div>
                              <span className="text-slate-400 text-[10px] block">Signer Common Name (CN):</span>
                              <span className="font-black text-white">{p12SignerIdentity.commonName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Issuer CA:</span>
                              <span className="font-semibold text-purple-300">{p12SignerIdentity.issuerCN || "DICT PNPKI GovCA"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Serial Number:</span>
                              <span className="font-mono text-slate-300 text-[10px] truncate block">{p12SignerIdentity.serialNumber || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Validity Window:</span>
                              <span className="text-[10px] text-emerald-300 font-mono">
                                {p12SignerIdentity.validFrom.slice(0, 10)} to {p12SignerIdentity.validTo.slice(0, 10)}
                              </span>
                            </div>
                          </div>

                          <div className="pt-1 border-t border-[#18233C]/80">
                            <span className="text-slate-400 text-[10px] block">SHA-256 Certificate Fingerprint:</span>
                            <code className="text-[9.5px] text-cyan-300 font-mono break-all select-all block bg-[#111728] p-1.5 rounded-lg border border-[#1C2844] mt-1">
                              {p12SignerIdentity.sha256Fingerprint}
                            </code>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Card 2: Signature Image & DTR Form 48 Stamp Preview */}
                  <div className="bg-[#111728] border border-[#1C2844] p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[#18233C] pb-3">
                      <div className="flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Digital Signature Image & Stamp Preview
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400">Civil Service Form 48</span>
                    </div>

                    <div className="space-y-3">
                      {/* Image Upload / Preview */}
                      {signatureImage ? (
                        <div className="space-y-2">
                          <div className="relative rounded-xl border border-[#1C2844] bg-[#0A0E1A] p-4 flex items-center justify-center min-h-[90px] overflow-hidden group">
                            {/* Transparent checkerboard background */}
                            <div
                              className="absolute inset-0 opacity-15"
                              style={{
                                backgroundImage:
                                  "linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)",
                                backgroundSize: "16px 16px",
                                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
                              }}
                            />
                            <img
                              src={signatureImage}
                              alt="Official Digital Signature"
                              className="max-h-20 max-w-full object-contain relative z-10"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Transparent PNG Loaded
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="text-[11px] font-semibold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer border border-slate-700 transition-colors">
                                Replace
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg"
                                  onChange={handleSignatureImageUpload}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleClearSignatureImage}
                                className="text-[11px] font-semibold text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[#1C2844] hover:border-emerald-500/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-[#0A0E1A]/50 hover:bg-emerald-950/10 group">
                          <FileSignature className="w-8 h-8 text-emerald-400/70 group-hover:text-emerald-400 transition-colors mb-2" />
                          <span className="text-xs font-bold text-white">
                            Upload Transparent Signature Image (PNG)
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Signatures with transparent background overlay seamlessly onto Civil Service Form 48
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            onChange={handleSignatureImageUpload}
                            className="hidden"
                          />
                        </label>
                      )}

                      {/* Official PNPKI Form 48 Stamp Simulation */}
                      <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0C1222] to-[#121A30] border border-[#1E2D4E] space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Live Civil Service Form 48 Stamp Preview:</span>
                          <span className="text-emerald-400 font-mono">DTR Vector Rendering</span>
                        </div>

                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center gap-3">
                          {signatureImage && (
                            <img
                              src={signatureImage}
                              alt="Signature"
                              className="h-10 w-24 object-contain shrink-0"
                            />
                          )}
                          <div className="text-[10px] space-y-0.5 min-w-0">
                            <div className="font-black text-purple-300 uppercase tracking-wide">
                              DICT PNPKI DIGITALLY SIGNED
                            </div>
                            <div className="text-white font-semibold truncate">
                              Signer: {p12SignerIdentity?.commonName || profileName || currentUser?.name || "PERSONNEL"}
                            </div>
                            <div className="text-slate-400 font-mono text-[9px]">
                              Date: {profileTimestamp}
                            </div>
                            {p12SignerIdentity?.sha256Fingerprint && (
                              <div className="text-cyan-400 font-mono text-[8.5px] truncate">
                                SHA-256: {p12SignerIdentity.sha256Fingerprint.slice(0, 23)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
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
