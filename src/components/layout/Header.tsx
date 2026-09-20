import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, ChevronDown, Download, LogOut } from "lucide-react";
import { getCurrentUser, setCurrentUser, AUTH_EVENT, getAllUsers } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { signOutGoogle } from "@/services/firebaseAuth";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(() => getCurrentUser());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("dict_users_updated", handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("dict_users_updated", handleAuthChange);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOutGoogle();
    } catch {}
    setCurrentUser(null);
    setIsDropdownOpen(false);
    navigate("/login");
  };

  const grantedModules = Object.entries(currentUser?.access || {})
    .filter(([_, granted]) => Boolean(granted))
    .map(([key]) => key);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 bg-[#07090E] px-6 border-b border-[#1A2235]">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden text-slate-400 hover:text-white">
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold text-white tracking-tight">DICT Monitoring</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-400">Region 5</span>
            <span className="flex h-2 w-2 relative ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-6 max-w-2xl">
        <button
          onClick={() => window.print()}
          className="hidden md:flex text-xs items-center gap-2 border border-[#1A2235] bg-[#111520] px-4 py-2 rounded-lg hover:bg-white/5 transition-colors font-medium text-slate-200 cursor-pointer"
        >
          <Download className="w-4 h-4 text-blue-400"/> Export Report
        </button>

        {/* User Profile & Account Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-3 pl-4 border-l border-[#1A2235] hover:opacity-90 transition-opacity cursor-pointer text-left"
          >
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-white leading-tight truncate max-w-[170px]">
                {currentUser?.name || "Select Account"}
              </p>
              <p className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                <span>{currentUser?.role || "Personnel"}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </p>
            </div>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xs border border-blue-500/30 shadow-md">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-[#0C101D] border border-[#18233C] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              
              {/* Current User Header */}
              <div className="p-4 bg-[#080B14] border-b border-[#18233C]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    Active Personnel
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="font-bold text-white text-sm mt-1">{currentUser?.name || "Not Logged In"}</div>
                <div className="text-xs text-slate-400 truncate">{currentUser?.email}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{currentUser?.region}</div>

                {/* Granted modules pill preview */}
                <div className="mt-3 pt-2.5 border-t border-[#18233C]/60 space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Authorized Modules:</span>
                    <span className="text-emerald-400 font-mono">{grantedModules.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar pt-0.5">
                    {grantedModules.length > 0 ? (
                      grantedModules.slice(0, 6).map((m) => (
                        <span key={m} className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/40">
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">No specific modules assigned</span>
                    )}
                    {grantedModules.length > 6 && (
                      <span className="text-[9px] text-slate-400 font-bold self-center">
                        +{grantedModules.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              </div>



              {/* Logout action */}
              <div className="p-2 bg-[#080B14]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Session</span>
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </header>
  );
}
