import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Users, Activity, Download, Calendar, CreditCard, Settings, X, MapPin, Box, Database,
  ShieldAlert, Radio, Server, CheckSquare, FileText, Clock, Link as LinkIcon, Lock, LogOut,
  Sparkles, Users2, Building2, ChevronDown, ChevronRight, PenLine
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUser, setCurrentUser, hasModuleAccess, AUTH_EVENT, refreshCurrentUser, refreshSystemModules, getCachedSystemModules } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { signOutGoogle } from "@/services/firebaseAuth";
import { SystemModule } from "@/services/api";
import { getDtrStorage, syncDtrStorageWithBackend } from "@/data/dtrStorage";

interface NavItem {
  name: string;
  path: string;
  icon: any;
  code: string;
}

const mainNav: NavItem[] = [
  { name: "Overview", path: "/", icon: Home, code: "MOD_OVERVIEW" },
  { name: "DTR Generator", path: "/dtr", icon: FileText, code: "MOD_DTR" },
  { name: "Regional Calendar", path: "/calendar", icon: Calendar, code: "MOD_CALENDAR" },
  { name: "Signing Workspace", path: "/signing-workspace", icon: PenLine, code: "MOD_SIGNING" },
];

const projectsNav: NavItem[] = [
  { name: "GECS", path: "/projects/gecs", icon: Radio, code: "MOD_GECS" },
  { name: "Free Wifi 4 All", path: "/projects/freewifi", icon: Activity, code: "MOD_FREEWIFI" },
  { name: "eGOVPH", path: "/projects/egovph", icon: CheckSquare, code: "MOD_EGOVPH" },
  { name: "eLGU", path: "/projects/elgu", icon: Activity, code: "MOD_ELGU" },
  { name: "NBP", path: "/projects/nbp", icon: Server, code: "MOD_NBP" },
  { name: "GovNet", path: "/projects/govnet", icon: Server, code: "MOD_GOVNET" },
  { name: "PNPKI", path: "/projects/pnpki", icon: ShieldAlert, code: "MOD_PNPKI" },
  { name: "ILCDB", path: "/projects/ilcdb", icon: Database, code: "MOD_ILCDB" },
  { name: "Cybersecurity", path: "/projects/cybersecurity", icon: ShieldAlert, code: "MOD_CYBERSECURITY" },
  { name: "MISS", path: "/projects/miss", icon: Activity, code: "MOD_MISS" },
  { name: "IIDB", path: "/projects/iidb", icon: Database, code: "MOD_IIDB" },
];

const settingsNav: NavItem[] = [
  { name: "Project Data Management", path: "/settings/projects", icon: Database, code: "MOD_PROJECT_DATA" },
  { name: "Administration", path: "/settings/system", icon: Settings, code: "MOD_ADMIN" },
];

export function Sidebar({ isOpen, setIsOpen }: any) {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(() => getCurrentUser());
  const [systemModules, setSystemModules] = useState<SystemModule[]>(() => getCachedSystemModules());
  const [isDtrExpanded, setIsDtrExpanded] = useState<boolean>(() => location.pathname.startsWith("/dtr"));
  const [dtrCounts, setDtrCounts] = useState<{ hrm: number; tod: number; provincial: number }>({
    hrm: 0,
    tod: 0,
    provincial: 0,
  });

  const updateDtrCounts = () => {
    try {
      const records = getDtrStorage();
      const hrm = records.filter((r) => r.module === "HRM").length;
      const tod = records.filter((r) => r.module === "TOD").length;
      const provincial = records.filter((r) => r.module === "PROVINCIAL").length;
      setDtrCounts({ hrm, tod, provincial });
    } catch {
      setDtrCounts({ hrm: 0, tod: 0, provincial: 0 });
    }
  };

  const handleLogout = async () => {
    try {
      await signOutGoogle();
    } catch {}
    setCurrentUser(null);
    if (setIsOpen) setIsOpen(false);
    navigate("/login");
  };

  useEffect(() => {
    refreshCurrentUser();
    refreshSystemModules().then((list) => {
      if (list && list.length > 0) setSystemModules(list);
    });

    updateDtrCounts();
    syncDtrStorageWithBackend().then(() => updateDtrCounts()).catch(() => {});

    const handleAuthChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    const handleModulesChange = () => {
      setSystemModules(getCachedSystemModules());
      setCurrentUserState(getCurrentUser());
    };
    const handleStorageUpdate = () => {
      updateDtrCounts();
    };

    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("dict_users_updated", handleAuthChange);
    window.addEventListener("dict_modules_updated", handleModulesChange);
    window.addEventListener("dict_dtr_storage_updated", handleStorageUpdate);
    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("storage", handleStorageUpdate);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("dict_users_updated", handleAuthChange);
      window.removeEventListener("dict_modules_updated", handleModulesChange);
      window.removeEventListener("dict_dtr_storage_updated", handleStorageUpdate);
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  // Auto expand DTR when navigating to /dtr
  useEffect(() => {
    if (location.pathname.startsWith("/dtr")) {
      setIsDtrExpanded(true);
    }
  }, [location.pathname]);

  const currentTab = new URLSearchParams(location.search).get("tab") || "generator";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 h-full max-h-screen flex flex-col bg-[#0C101A] border-r border-[#1A2235] transition-transform duration-300 ease-in-out lg:static lg:flex lg:translate-x-0 shrink-0",
        isOpen ? "translate-x-0 flex" : "-translate-x-full hidden lg:flex"
      )}
    >
      <div className="flex h-16 shrink-0 items-center px-5 border-b border-[#1A2235]/60 bg-[#0C101A]">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/dict-logo.png"
            alt="DICT Logo"
            className="h-9 w-9 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.35)] transition-transform group-hover:scale-105"
          />
          <div className="flex flex-col">
            <span className="font-bold text-base leading-tight tracking-tight text-white group-hover:text-blue-400 transition-colors">DICT</span>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Region V</span>
          </div>
        </Link>
        <button className="lg:hidden text-slate-400 hover:text-white ml-auto p-1.5 rounded-lg hover:bg-slate-800 transition-colors" onClick={() => setIsOpen(false)}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-3 px-3 space-y-5 min-h-0">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isDtrItem = item.code === "MOD_DTR";
            const isActive = location.pathname === item.path;
            const hasAccess = hasModuleAccess(currentUser, item.code);

            if (isDtrItem) {
              return (
                <div key={item.name} className="space-y-1">
                  <div
                    onClick={() => {
                      if (!hasAccess) return;
                      setIsDtrExpanded((prev) => !prev);
                      if (!location.pathname.startsWith("/dtr")) {
                        navigate("/dtr");
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        if (!hasAccess) return;
                        setIsDtrExpanded((prev) => !prev);
                        if (!location.pathname.startsWith("/dtr")) {
                          navigate("/dtr");
                        }
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200 relative select-none group cursor-pointer",
                      !hasAccess
                        ? "text-slate-500/60 opacity-50 cursor-not-allowed hover:bg-transparent border border-transparent"
                        : isActive
                        ? "bg-gradient-to-r from-blue-600/20 to-transparent text-blue-400 border border-blue-500/30"
                        : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent"
                    )}
                  >
                    {isActive && hasAccess && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                    )}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate font-semibold">{item.name}</span>
                    </div>
                    {hasAccess ? (
                      <div className="p-1 rounded-md text-slate-400 group-hover:text-white transition-colors">
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            isDtrExpanded ? "rotate-0 text-blue-400" : "-rotate-90 text-slate-400"
                          )}
                        />
                      </div>
                    ) : (
                      <Lock className="w-3.5 h-3.5 ml-auto text-amber-500/80 shrink-0" />
                    )}
                  </div>

                  {/* Sub-modules under DTR Generator */}
                  {hasAccess && isDtrExpanded && (
                    <div className="pl-3 pr-1 py-1 space-y-1 border-l-2 border-[#1E293B] ml-4 animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Sub-module 1: Generator */}
                      <Link
                        to="/dtr?tab=generator"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                          isActive && currentTab === "generator"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">CS Form 48</span>
                        </div>
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          Builder
                        </span>
                      </Link>

                      {/* Sub-module 2: HRM - module */}
                      <Link
                        to="/dtr?tab=hrm"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                          isActive && currentTab === "hrm"
                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-sm"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Users2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate">HRM - module</span>
                        </div>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                            isActive && currentTab === "hrm"
                              ? "bg-blue-500/30 text-white font-bold"
                              : "bg-slate-800 text-slate-400"
                          )}
                        >
                          {dtrCounts.hrm}
                        </span>
                      </Link>

                      {/* Sub-module 3: TOD - module */}
                      <Link
                        to="/dtr?tab=tod"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                          isActive && currentTab === "tod"
                            ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-sm"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">TOD - module</span>
                        </div>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                            isActive && currentTab === "tod"
                              ? "bg-purple-500/30 text-white font-bold"
                              : "bg-slate-800 text-slate-400"
                          )}
                        >
                          {dtrCounts.tod}
                        </span>
                      </Link>

                      {/* Sub-module 4: Provincial - module */}
                      <Link
                        to="/dtr?tab=provincial"
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none",
                          isActive && currentTab === "provincial"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">Provincial</span>
                        </div>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                            isActive && currentTab === "provincial"
                              ? "bg-amber-500/30 text-white font-bold"
                              : "bg-slate-800 text-slate-400"
                          )}
                        >
                          {dtrCounts.provincial}
                        </span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.name}
                to={hasAccess ? item.path : "#"}
                onClick={(e) => {
                  if (!hasAccess) {
                    e.preventDefault();
                    return;
                  }
                  setIsOpen(false);
                }}
                title={hasAccess ? item.name : `Locked: No access to ${item.name} (${item.code})`}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 relative select-none",
                  !hasAccess
                    ? "text-slate-500/60 opacity-50 cursor-not-allowed hover:bg-transparent border border-transparent"
                    : isActive
                    ? "bg-gradient-to-r from-blue-600/20 to-transparent text-blue-400 border border-blue-500/30 cursor-pointer"
                    : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent cursor-pointer"
                )}
              >
                {isActive && hasAccess && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.name}</span>
                {!hasAccess && (
                  <Lock className="w-3.5 h-3.5 ml-auto text-amber-500/80 shrink-0" />
                )}
              </Link>
            );
          })}
        </div>

        <div>
          <h4 className="px-4 text-[10px] font-semibold text-slate-500 tracking-wider mb-2">PROJECTS</h4>
          <div className="space-y-0.5">
            {projectsNav.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const hasAccess = hasModuleAccess(currentUser, item.code);
              return (
                <Link
                  key={item.name}
                  to={hasAccess ? item.path : "#"}
                  onClick={(e) => {
                    if (!hasAccess) {
                      e.preventDefault();
                      return;
                    }
                    setIsOpen(false);
                  }}
                  title={hasAccess ? item.name : `Locked: No access to ${item.name} (${item.code})`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200 relative select-none",
                    !hasAccess
                      ? "text-slate-500/60 opacity-50 cursor-not-allowed hover:bg-transparent border border-transparent"
                      : isActive
                      ? "bg-gradient-to-r from-emerald-600/20 to-transparent text-emerald-400 border border-emerald-500/30 cursor-pointer"
                      : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent cursor-pointer"
                  )}
                >
                  {isActive && hasAccess && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />}
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                  {!hasAccess && (
                    <Lock className="w-3 h-3 ml-auto text-amber-500/80 shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="px-4 text-[10px] font-semibold text-slate-500 tracking-wider mb-2">SETTINGS</h4>
          <div className="space-y-0.5">
            {settingsNav.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              const hasAccess = hasModuleAccess(currentUser, item.code);
              return (
                <Link
                  key={item.name}
                  to={hasAccess ? item.path : "#"}
                  onClick={(e) => {
                    if (!hasAccess) {
                      e.preventDefault();
                      return;
                    }
                    setIsOpen(false);
                  }}
                  title={hasAccess ? item.name : `Locked: No access to ${item.name} (${item.code})`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 relative select-none",
                    !hasAccess
                      ? "text-slate-500/60 opacity-50 cursor-not-allowed hover:bg-transparent border border-transparent"
                      : isActive
                      ? "bg-gradient-to-r from-purple-600/20 to-transparent text-purple-400 border border-purple-500/30 cursor-pointer"
                      : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent cursor-pointer"
                  )}
                >
                  {isActive && hasAccess && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.name}</span>
                  {!hasAccess && (
                    <Lock className="w-3.5 h-3.5 ml-auto text-amber-500/80 shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-3 shrink-0 mt-auto border-t border-[#1A2235]/70 bg-[#07090E]/90 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-[#0F1422] hover:bg-red-500/10 border border-[#1A2235] hover:border-red-500/30 text-slate-400 hover:text-red-400 text-xs font-semibold transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors" />
            <span>Sign Out</span>
          </div>
          <span className="text-[10px] font-mono text-slate-600 group-hover:text-red-400/80 uppercase">Log out</span>
        </button>
      </div>
    </aside>
  );
}
