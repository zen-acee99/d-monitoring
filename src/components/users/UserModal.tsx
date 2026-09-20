import React, { useState, useEffect } from "react";
import {
  Shield,
  UserCheck,
  Check,
  KeyRound,
  RefreshCw,
  MapPin,
  CheckCircle2,
  XCircle,
  Power,
  Ban,
  UserX,
  Wifi,
  Building2,
  Smartphone,
  Key,
  ShieldCheck,
  Radio,
  Globe,
  Network,
  GraduationCap,
  Database,
  BarChart3,
  FileText,
  Calendar,
  Link2,
  Users,
  Settings,
  FolderKanban,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { PROJECTS } from "@/config/projects";
import { UserRecord, UserRole } from "@/data/userStore";
import { Modal } from "@/components/ui/modal";
import { modulesApi, SystemModule } from "@/services/api";
import { createFullAccessMatrix, createEmptyAccessMatrix } from "@/services/authStore";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: UserRecord) => void | Promise<void>;
  initialUser?: UserRecord | null;
  isSubmitting?: boolean;
}

export const ROLE_OPTIONS: { value: UserRole; label: string; description: string; badgeColor: string }[] = [
  { 
    value: "Super Admin", 
    label: "Super Admin", 
    description: "Complete system administration, access management, and technical configuration",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40"
  },
  { 
    value: "Admin", 
    label: "Admin", 
    description: "Administrative oversight, project administration, and user management",
    badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40"
  },
  { 
    value: "Regional Director", 
    label: "Regional Director", 
    description: "Full executive oversight and sign-off authority across all regional programs",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40"
  },
  { 
    value: "Asst. Regional Director", 
    label: "Asst. Regional Director", 
    description: "Operational leadership, administrative direction, and cross-project monitoring",
    badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
  },
  { 
    value: "Technical Operations Division", 
    label: "Technical Operations Division", 
    description: "Technical operations management, infrastructure deployments, and telemetry oversight",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
  },
  { 
    value: "OIC Chief - Technical Operations Division", 
    label: "OIC Chief - Technical Operations Division", 
    description: "Divisional supervision, technical operations clearance, and regional deployment approvals",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40"
  },
  { 
    value: "Provincial Officer", 
    label: "Provincial Officer", 
    description: "Provincial-level operational supervision, project coordination, and field monitoring",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  // Engineers
  {
    value: "Engr. I",
    label: "Engr. I",
    description: "Engineer I - Field implementation, technical inspections, and project support",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40"
  },
  {
    value: "Engr. II",
    label: "Engr. II",
    description: "Engineer II - Infrastructure monitoring, maintenance coordination, and site deployments",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40"
  },
  {
    value: "Engr. III",
    label: "Engr. III",
    description: "Engineer III - Lead engineer, technical project oversight, and engineering supervision",
    badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40"
  },
  // Project Development Officers
  {
    value: "PDO I",
    label: "PDO I",
    description: "Project Development Officer I - Project tracking, documentation, and reporting",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  },
  {
    value: "PDO II",
    label: "PDO II",
    description: "Project Development Officer II - Program coordination, stakeholder engagement, and monitoring",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  },
  {
    value: "PDO III",
    label: "PDO III",
    description: "Project Development Officer III - Lead project development, program evaluation, and regional coordination",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
  },
  // Planning / Project Logistics Officers
  {
    value: "PLO I",
    label: "PLO I",
    description: "Planning / Logistics Officer I - Regional project planning support, logistics tracking, and operations documentation",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40"
  },
  {
    value: "PLO II",
    label: "PLO II",
    description: "Planning / Logistics Officer II - Strategic planning coordination, resource allocation, and field logistics",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40"
  },
  {
    value: "PLO III",
    label: "PLO III",
    description: "Planning / Logistics Officer III - Lead planning officer, regional logistics supervision, and program milestone alignment",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40"
  },
  // Information Systems Analysts
  {
    value: "ISA I",
    label: "ISA I",
    description: "Information Systems Analyst I - Systems support, data verification, and application testing",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/40"
  },
  {
    value: "ISA II",
    label: "ISA II",
    description: "Information Systems Analyst II - Database administration, system analytics, and module integration",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/40"
  },
  {
    value: "ISA III",
    label: "ISA III",
    description: "Information Systems Analyst III - Enterprise systems architecture, cybersecurity liaison, and technical leadership",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/40"
  },
  // Information Technology Officers
  {
    value: "ITO I",
    label: "ITO I",
    description: "Information Technology Officer I - ICT operations, network administration, and IT support",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40"
  },
  {
    value: "ITO II",
    label: "ITO II",
    description: "Information Technology Officer II - Regional IT management, infrastructure security, and systems supervision",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40"
  },
  // Administrative Officers
  {
    value: "ADMIN I",
    label: "ADMIN I",
    description: "Administrative Officer I - Records handling, administrative support, and office coordination",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  {
    value: "ADMIN II",
    label: "ADMIN II",
    description: "Administrative Officer II - Procurement assistance, general services, and personnel logistics",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  {
    value: "ADMIN III",
    label: "ADMIN III",
    description: "Administrative Officer III - Property custody, supply management, and administrative services",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  {
    value: "ADMIN IV",
    label: "ADMIN IV",
    description: "Administrative Officer IV - HR management, administrative operations, and divisional coordination",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  {
    value: "ADMIN V",
    label: "ADMIN V",
    description: "Administrative Officer V - Chief of administrative services, financial/HR leadership, and executive support",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40"
  },
  // Accountants
  {
    value: "ACCOUNTANT I",
    label: "ACCOUNTANT I",
    description: "Accountant I - Financial disbursement review, bookkeeping, and voucher auditing",
    badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/40"
  },
  {
    value: "ACCOUNTANT II",
    label: "ACCOUNTANT II",
    description: "Accountant II - Budget reconciliation, financial statements, and COA compliance",
    badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/40"
  },
  {
    value: "ACCOUNTANT III",
    label: "ACCOUNTANT III",
    description: "Accountant III - Regional accounting management, fiscal operations, and budget allocation",
    badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/40"
  },
  {
    value: "ACCOUNTANT IV",
    label: "ACCOUNTANT IV",
    description: "Accountant IV - Senior financial officer, fiscal audit oversight, and budget control",
    badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/40"
  },
  {
    value: "ACCOUNTANT V",
    label: "ACCOUNTANT V",
    description: "Accountant V - Chief Accountant, regional financial management, and comptrollership",
    badgeColor: "bg-lime-500/20 text-lime-300 border-lime-500/40"
  },
  // Support Staff
  {
    value: "CLERK",
    label: "CLERK",
    description: "Administrative Clerk - Document receiving, records filing, and office clerical tasks",
    badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/40"
  },
  {
    value: "DRIVER",
    label: "DRIVER",
    description: "Administrative Driver - Official field transport, vehicle logistics, and mobile operations dispatch",
    badgeColor: "bg-stone-500/20 text-stone-300 border-stone-500/40"
  },
];

export const REGION_OPTIONS = [
  "Region V (Bicol)",
  "Central Office (CO)",
  "Region I (Ilocos)",
  "Region II (Cagayan Valley)",
  "Region III (Central Luzon)",
  "Region IV-A (CALABARZON)",
  "Region IV-B (MIMAROPA)",
  "Region VI (Western Visayas)",
  "Region VII (Central Visayas)",
  "Region VIII (Eastern Visayas)",
];

export const PROVINCE_OPTIONS = [
  "Albay",
  "Camarines Norte",
  "Camarines Sur",
  "Catanduanes",
  "Masbate",
  "Sorsogon",
];

export const FOCAL_PROVINCE_OPTIONS = [
  "All Provinces / Regional",
  "Albay",
  "Camarines Sur",
  "Camarines Norte",
  "Catanduanes",
  "Masbate",
  "Sorsogon",
];

const getModuleIcon = (code: string, id?: string) => {
  const c = (code || id || "").toUpperCase();
  if (c.includes("FREEWIFI")) return <Wifi className="w-4 h-4 text-blue-400" />;
  if (c.includes("ELGU")) return <Building2 className="w-4 h-4 text-emerald-400" />;
  if (c.includes("EGOVPH")) return <Smartphone className="w-4 h-4 text-cyan-400" />;
  if (c.includes("PNPKI")) return <Key className="w-4 h-4 text-amber-400" />;
  if (c.includes("CYBERSECURITY")) return <ShieldCheck className="w-4 h-4 text-rose-400" />;
  if (c.includes("GECS")) return <Radio className="w-4 h-4 text-teal-400" />;
  if (c.includes("NBP")) return <Globe className="w-4 h-4 text-indigo-400" />;
  if (c.includes("GOVNET")) return <Network className="w-4 h-4 text-violet-400" />;
  if (c.includes("ILCDB")) return <GraduationCap className="w-4 h-4 text-sky-400" />;
  if (c.includes("MISS")) return <Database className="w-4 h-4 text-purple-400" />;
  if (c.includes("IIDB")) return <BarChart3 className="w-4 h-4 text-yellow-400" />;
  if (c.includes("DTR")) return <FileText className="w-4 h-4 text-emerald-400" />;
  if (c.includes("CALENDAR")) return <Calendar className="w-4 h-4 text-indigo-400" />;
  if (c.includes("ADMIN")) return <Settings className="w-4 h-4 text-purple-400" />;
  if (c.includes("PROJECT_DATA") || c.includes("DATA")) return <FolderKanban className="w-4 h-4 text-amber-400" />;
  return <Layers className="w-4 h-4 text-slate-400" />;
};

export function UserModal({ isOpen, onClose, onSave, initialUser, isSubmitting }: UserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("Regional Director");
  const [region, setRegion] = useState("Region V (Bicol)");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isFocal, setIsFocal] = useState(false);
  const [focalProject, setFocalProject] = useState("freewifi");
  const [focalProvince, setFocalProvince] = useState("All Provinces / Regional");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [canEdit, setCanEdit] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [moduleCategoryFilter, setModuleCategoryFilter] = useState<"All" | "Project" | "Core Tool" | "Management">("All");

  useEffect(() => {
    modulesApi.getModules().then((list) => {
      if (list && list.length > 0) setModules(list);
    });
  }, []);

  useEffect(() => {
    if (initialUser) {
      setName(initialUser.name || "");
      setEmail(initialUser.email || "");
      setRole((initialUser.role as UserRole) || "Regional Director");
      setRegion(initialUser.region || "Region V (Bicol)");
      setStatus(initialUser.status || "active");
      setIsFocal(!!initialUser.isFocal);
      setFocalProject(initialUser.focalProject || "freewifi");
      if (initialUser.role === "Provincial Officer" && (!initialUser.focalProvince || initialUser.focalProvince === "All Provinces / Regional")) {
        setFocalProvince("Albay");
      } else {
        setFocalProvince(initialUser.focalProvince || "All Provinces / Regional");
      }
      setPhone(initialUser.phone || "");
      setAccess(initialUser.access || PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}));
      setCanEdit(initialUser.canEdit !== undefined ? initialUser.canEdit : initialUser.role !== "Viewer");
      setCanDelete(initialUser.canDelete !== undefined ? initialUser.canDelete : initialUser.role === "Super Admin" || initialUser.role === "Regional Director");
    } else {
      // Default new user setup
      setName("");
      setEmail("");
      setRole("Regional Director");
      setRegion("Region V (Bicol)");
      setStatus("active");
      setIsFocal(false);
      setFocalProject("freewifi");
      setFocalProvince("All Provinces / Regional");
      setPhone("");
      setCanEdit(true);
      setCanDelete(true);
      // Default: grant full access for executive roles
      setAccess(PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}));
    }
    setErrors({});
  }, [initialUser, isOpen]);

  // When role changes to Director / Super Admin / Admin / OIC Chief, grant default full module access
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === "Provincial Officer") {
      if (!focalProvince || focalProvince === "All Provinces / Regional") {
        setFocalProvince("Albay");
      }
    }
    if (
      newRole === "Super Admin" ||
      newRole === "Admin" ||
      newRole === "Regional Director" ||
      newRole === "Asst. Regional Director" ||
      newRole === "Assistant Regional Director" ||
      newRole === "OIC Chief - Technical Operations Division"
    ) {
      const full = createFullAccessMatrix();
      PROJECTS.forEach((p) => {
        full[p.id] = true;
        full[`MOD_${p.id.toUpperCase()}`] = true;
      });
      modules.forEach((m) => {
        full[m.code] = true;
        full[m.id] = true;
      });
      setAccess(full);
      setCanEdit(true);
      setCanDelete(true);
    } else {
      setCanEdit(true);
      setCanDelete(false);
    }
  };

  const handleToggleModule = (key: string, altKey?: string) => {
    setAccess((prev) => {
      const upper = key.toUpperCase();
      const modCode = upper.startsWith("MOD_") ? upper : `MOD_${upper}`;
      const slug = upper.replace(/^MOD_/, "").toLowerCase();
      const current = Boolean(prev[key] || prev[modCode] || prev[slug] || (altKey && prev[altKey]));
      const next = !current;
      const updated = {
        ...prev,
        [key]: next,
        [modCode]: next,
        [slug]: next,
      };
      if (altKey) {
        updated[altKey] = next;
        updated[altKey.toLowerCase()] = next;
      }
      return updated;
    });
  };

  const handleGrantAll = () => {
    const full = createFullAccessMatrix();
    PROJECTS.forEach((p) => {
      full[p.id] = true;
      full[`MOD_${p.id.toUpperCase()}`] = true;
    });
    modules.forEach((m) => {
      full[m.code] = true;
      full[m.id] = true;
      const projId = m.route_path?.split("/projects/")[1];
      if (projId) full[projId] = true;
    });
    setAccess(full);
  };

  const handleRevokeAll = () => {
    const empty = createEmptyAccessMatrix();
    PROJECTS.forEach((p) => {
      empty[p.id] = false;
      empty[`MOD_${p.id.toUpperCase()}`] = false;
    });
    modules.forEach((m) => {
      empty[m.code] = false;
      empty[m.id] = false;
      const projId = m.route_path?.split("/projects/")[1];
      if (projId) empty[projId] = false;
    });
    setAccess(empty);
  };

  const allDisplayModules = React.useMemo(() => {
    const list = (modules && modules.length > 0)
      ? modules.filter((m) => m.code !== "MOD_URL_SHORTENER" && m.id !== "mod-url-shortener" && m.id !== "url_shortener")
      : [
          ...PROJECTS.map((p) => ({
            id: p.id,
            code: `MOD_${p.id.toUpperCase()}`,
            name: p.name,
            shortName: p.shortName,
            category: "Project",
            is_active: true,
            route_path: `/projects/${p.id}`,
          })),
          {
            id: "dtr",
            code: "MOD_DTR",
            name: "DTR Generator & PNPKI Digital Signing",
            shortName: "DTR",
            category: "Core Tool",
            is_active: true,
            route_path: "/dtr",
          },
          {
            id: "calendar",
            code: "MOD_CALENDAR",
            name: "Regional Calendar & Events",
            shortName: "Calendar",
            category: "Core Tool",
            is_active: true,
            route_path: "/calendar",
          },
          {
            id: "admin",
            code: "MOD_ADMIN",
            name: "Administration & User Access Control",
            shortName: "Administration",
            category: "Management",
            is_active: true,
            route_path: "/settings/system",
          },
          {
            id: "project_data",
            code: "MOD_PROJECT_DATA",
            name: "Project Data Management (CRUD)",
            shortName: "Project Data",
            category: "Management",
            is_active: true,
            route_path: "/settings/projects",
          },
        ];

    return list.map((m) => {
      if (m.code === "MOD_ADMIN" || m.id === "admin" || m.id === "mod-admin") {
        return {
          ...m,
          name: "Administration & User Access Control",
          shortName: "Administration",
          route_path: "/settings/system",
          category: "Management",
        };
      }
      return m;
    });
  }, [modules]);

  const enabledCount = allDisplayModules.filter((m) => {
    const projId = m.route_path?.split("/projects/")[1] || m.id.replace("mod-", "");
    return Boolean(access[m.code] || access[m.id] || access[projId]);
  }).length;

  const projectModulesCount = allDisplayModules.filter((m) => m.category === "Project" || !m.category).length;
  const toolModulesCount = allDisplayModules.filter((m) => m.category === "Core Tool" || m.category === "Tool").length;
  const mgmtModulesCount = allDisplayModules.filter((m) => m.category === "Management" || m.category === "Admin").length;

  const filteredDisplayModules = allDisplayModules.filter((m) => {
    if (moduleCategoryFilter === "All") return true;
    if (moduleCategoryFilter === "Project") return m.category === "Project" || !m.category;
    if (moduleCategoryFilter === "Core Tool") return m.category === "Core Tool" || m.category === "Tool";
    if (moduleCategoryFilter === "Management") return m.category === "Management" || m.category === "Admin";
    return true;
  });

  const handleGrantCategory = (cat: "Project" | "Core Tool" | "Management") => {
    setAccess((prev) => {
      const next = { ...prev };
      allDisplayModules.forEach((m) => {
        const isMatch =
          (cat === "Project" && (m.category === "Project" || !m.category)) ||
          (cat === "Core Tool" && (m.category === "Core Tool" || m.category === "Tool")) ||
          (cat === "Management" && (m.category === "Management" || m.category === "Admin"));
        if (isMatch) {
          const projId = m.route_path?.split("/projects/")[1] || m.id.replace("mod-", "");
          next[m.code] = true;
          next[m.id] = true;
          next[m.code.toUpperCase()] = true;
          if (projId) next[projId] = true;
        }
      });
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!email.trim()) {
      newErrors.email = "Email address is required";
    } else if (!email.includes("@")) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const userData: UserRecord = {
      id: initialUser?.id || `usr-${Date.now().toString(36)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: initialUser?.password || undefined,
      role,
      region,
      status,
      isFocal,
      focalProject: isFocal ? focalProject : undefined,
      focalProvince: (isFocal || role === "Provincial Officer")
        ? (role === "Provincial Officer" && (!focalProvince || focalProvince === "All Provinces / Regional") ? "Albay" : focalProvince)
        : undefined,
      phone: phone.trim() || undefined,
      access,
      canEdit,
      canDelete,
      authProvider: "google",
      lastLogin: initialUser?.lastLogin || "Never",
      createdAt: initialUser?.createdAt || new Date().toISOString().split("T")[0],
    };

    onSave(userData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialUser ? "Edit Personnel Profile" : "Add New Personnel / Director"}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engr. Maria Clara or Director Juan Cruz"
              className={`w-full bg-[#111728] border ${
                errors.name ? "border-red-500" : "border-[#1C2844]"
              } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors`}
            />
            {errors.name && <p className="text-[10px] text-red-400 font-medium">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Gov / Google Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. maria.clara@dict.gov.ph or user@gmail.com"
              className={`w-full bg-[#111728] border ${
                errors.email ? "border-red-500" : "border-[#1C2844]"
              } rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors`}
            />
            {errors.email && <p className="text-[10px] text-red-400 font-medium">{errors.email}</p>}
          </div>
        </div>

        {/* Google / GovMail SSO Authentication Info */}
        <div className="bg-[#0C1220] border border-blue-500/20 p-3 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xs">
            <span className="font-semibold text-slate-200">Google / GovMail SSO Login</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              No password needed. Personnel will securely log in using their registered Google / GovMail email address via Google SSO.
            </p>
          </div>
        </div>

        {/* Account Access Status (Active vs Deactivated) */}
        <div className={`p-4 rounded-xl border transition-all ${
          status === "active"
            ? "bg-emerald-950/20 border-emerald-500/30"
            : "bg-red-950/20 border-red-500/30"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                {status === "active" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                Account Access Status <span className="text-red-400">*</span>
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {status === "active"
                  ? "Account is Active. Personnel can log in via Google SSO and access designated modules."
                  : "Account is Deactivated. Personnel is completely blocked from logging in or accessing the system."}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border self-start sm:self-auto shrink-0 ${
                status === "active"
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  : "bg-red-500/15 text-red-300 border-red-500/40"
              }`}
            >
              {status === "active" ? "Active Account" : "Deactivated"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setStatus("active")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                status === "active"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/30"
                  : "bg-[#111728] text-slate-400 border-[#1C2844] hover:text-white hover:border-slate-600"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${status === "active" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              Active (Authorized Access)
            </button>

            <button
              type="button"
              onClick={() => setStatus("inactive")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                status === "inactive"
                  ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-md shadow-red-950/50 ring-1 ring-red-500/30"
                  : "bg-[#111728] text-slate-400 border-[#1C2844] hover:text-white hover:border-slate-600"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${status === "inactive" ? "bg-red-400 animate-pulse" : "bg-slate-500"}`} />
              Deactivate (Block Access)
            </button>
          </div>
        </div>

        {/* Role & Region Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Organizational Role</span>
              {(role === "Regional Director" || role === "Asst. Regional Director" || role === "Assistant Regional Director" || role === "Super Admin" || role === "Admin") && (
                <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Executive
                </span>
              )}
              {role === "Provincial Officer" && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Provincial Officer
                </span>
              )}
            </label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0C101D] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400">
              {ROLE_OPTIONS.find((r) => r.value === role)?.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Regional Jurisdiction</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              {REGION_OPTIONS.map((reg) => (
                <option key={reg} value={reg} className="bg-[#0C101D] text-white">
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* When Provincial Officer is selected, show Province dropdown */}
          {role === "Provincial Officer" && (
            <div className="sm:col-span-2 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/40 rounded-xl p-3.5 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
              <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  Assigned Province (PO Jurisdiction)
                </span>
                <span className="text-[10px] text-amber-300 font-mono px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 font-bold">
                  Select Province
                </span>
              </label>
              <select
                value={focalProvince === "All Provinces / Regional" ? "Albay" : focalProvince}
                onChange={(e) => setFocalProvince(e.target.value)}
                className="w-full bg-[#0C101D] border border-amber-500/50 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-colors cursor-pointer"
              >
                {PROVINCE_OPTIONS.map((prov) => (
                  <option key={prov} value={prov} className="bg-[#0C101D] text-white">
                    {prov}
                  </option>
                ))}
              </select>
              <p className="text-[10.5px] text-slate-400">
                Designate the province station assigned to this Provincial Officer (e.g. Albay, Camarines Sur, Camarines Norte, Catanduanes, Masbate, Sorsogon).
              </p>
            </div>
          )}
        </div>

        {/* Focal Person Checkbox & Selector */}
        <div className="bg-[#111728] border border-[#1C2844] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFocal}
                onChange={(e) => setIsFocal(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Designate as Project Focal Person
                </span>
                <p className="text-[10px] text-slate-400">
                  Flags this user as the primary contact and regional coordinator for a specific DICT initiative
                </p>
              </div>
            </label>

            {isFocal && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Focal Active
              </span>
            )}
          </div>

          {/* Focal Project & Province Dropdown (when checked) */}
          {isFocal && (
            <div className="pt-3 border-t border-[#18233C] grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-emerald-400">
                  Assigned Focal Project / Service
                </label>
                <select
                  value={focalProject}
                  onChange={(e) => setFocalProject(e.target.value)}
                  className="w-full bg-[#0C101D] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {PROJECTS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0C101D] text-white">
                      {p.name} ({p.shortName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-emerald-400">
                  Assigned Province Scope
                </label>
                <select
                  value={focalProvince}
                  onChange={(e) => setFocalProvince(e.target.value)}
                  className="w-full bg-[#0C101D] border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {FOCAL_PROVINCE_OPTIONS.map((prov) => (
                    <option key={prov} value={prov} className="bg-[#0C101D] text-white">
                      {prov}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Contact details */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Contact Number (Optional)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +63 917 123 4567"
            className="w-full bg-[#111728] border border-[#1C2844] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Project Data Management Edit & Modify Authority */}
        <div className="p-3.5 rounded-xl bg-[#111728] border border-[#1C2844] space-y-2.5">
          <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-blue-400" />
            Project Data Management Authority
          </label>
          <p className="text-[10px] text-slate-400">
            Controls whether this administrator can create, edit, or delete records in project tables
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0C101D] border border-[#18233C] text-xs text-slate-200 cursor-pointer hover:border-blue-500/40 select-none">
              <input
                type="checkbox"
                checked={canEdit}
                onChange={(e) => setCanEdit(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500 w-4 h-4"
              />
              <span className="font-semibold text-white">Can Edit & Modify Records</span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0C101D] border border-[#18233C] text-xs text-slate-200 cursor-pointer hover:border-red-500/40 select-none">
              <input
                type="checkbox"
                checked={canDelete}
                onChange={(e) => setCanDelete(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-red-500 focus:ring-red-500 w-4 h-4"
              />
              <span className="font-semibold text-white">Can Delete Records</span>
            </label>
          </div>
        </div>

        {/* Module Access Permissions Matrix */}
        <div className="space-y-3 pt-3 border-t border-[#18233C]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  Module Access Permissions
                </label>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono text-[10px] font-bold">
                  {enabledCount} / {allDisplayModules.length} Active
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 mt-0.5">
                Grant or restrict authorized access per DICT project, core tool, and administration console.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleGrantAll}
                className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10.5px] font-bold transition-all cursor-pointer"
              >
                Grant All
              </button>
              <button
                type="button"
                onClick={handleRevokeAll}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10.5px] font-bold transition-all cursor-pointer"
              >
                Revoke All
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setModuleCategoryFilter("All")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                moduleCategoryFilter === "All"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/40"
                  : "bg-[#111728] text-slate-400 border border-[#1C2844] hover:text-white"
              }`}
            >
              All Modules ({allDisplayModules.length})
            </button>
            <button
              type="button"
              onClick={() => setModuleCategoryFilter("Project")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                moduleCategoryFilter === "Project"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/40"
                  : "bg-[#111728] text-slate-400 border border-[#1C2844] hover:text-white"
              }`}
            >
              DICT Projects ({projectModulesCount})
            </button>
            <button
              type="button"
              onClick={() => setModuleCategoryFilter("Core Tool")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                moduleCategoryFilter === "Core Tool"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/40"
                  : "bg-[#111728] text-slate-400 border border-[#1C2844] hover:text-white"
              }`}
            >
              Core Tools ({toolModulesCount})
            </button>
            <button
              type="button"
              onClick={() => setModuleCategoryFilter("Management")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                moduleCategoryFilter === "Management"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-900/40"
                  : "bg-[#111728] text-slate-400 border border-[#1C2844] hover:text-white"
              }`}
            >
              Administration ({mgmtModulesCount})
            </button>
          </div>

          {/* Redesigned Spacious 2-Column Permissions List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1 pt-1">
            {filteredDisplayModules.map((mod) => {
              const projId = mod.route_path?.split("/projects/")[1] || mod.id.replace("mod-", "");
              const isChecked = Boolean(access[mod.code] || access[mod.id] || access[projId]);
              return (
                <div
                  key={mod.id || mod.code}
                  onClick={() => handleToggleModule(mod.code, projId)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer select-none transition-all flex items-center justify-between gap-3 ${
                    isChecked
                      ? "bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-transparent border-blue-500/50 text-blue-200 shadow-md shadow-blue-950/30 ring-1 ring-blue-500/20"
                      : "bg-[#111728] border-[#1C2844] text-slate-400 hover:border-slate-600 hover:bg-[#141c30]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        isChecked
                          ? "bg-blue-500/20 border-blue-500/40 shadow-sm shadow-blue-900/40"
                          : "bg-slate-900 border-slate-800"
                      }`}
                    >
                      {getModuleIcon(mod.code, mod.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 text-xs leading-tight">
                        {mod.name || mod.shortName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black/50 text-emerald-400 border border-emerald-500/30">
                          {mod.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {mod.category || "Project"}
                        </span>
                        {!mod.is_active && (
                          <span
                            className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60"
                            title="Deactivated globally in Module Management"
                          >
                            Deactivated
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modern iOS-Style Toggle Switch */}
                  <div className="shrink-0 flex items-center pl-2">
                    <div
                      className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                        isChecked ? "bg-blue-600 shadow-sm shadow-blue-500/50" : "bg-slate-800 border border-slate-700"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform transform shadow-md ${
                          isChecked ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#18233C] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white shadow-lg shadow-blue-900/30 transition-all cursor-pointer flex items-center gap-2"
          >
            {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? "Saving to Turso..." : initialUser ? "Update User" : "Create User"}</span>
          </button>
        </div>

      </form>
    </Modal>
  );
}
