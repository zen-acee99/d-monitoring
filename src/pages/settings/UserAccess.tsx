import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  MoreHorizontal,
  Shield,
  X,
  UserCheck,
  Crown,
  Edit2,
  Trash2,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  LogIn,
  MapPin
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PROJECTS } from "@/config/projects";
import { getStoredUsers, saveStoredUsers, UserRecord } from "@/data/userStore";
import { UserModal, ROLE_OPTIONS, REGION_OPTIONS } from "@/components/users/UserModal";
import { administrationApi } from "@/services/api";
import { getCurrentUser, setCurrentUser, updateUserSession, syncCurrentUserIfUpdated, AUTH_EVENT, hasModuleAccess } from "@/services/authStore";

export function UserAccess() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [focalFilter, setFocalFilter] = useState<"All" | "Focal" | "NonFocal">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "active" | "inactive">("All");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentUser, setCurrentUserSession] = useState(() => getCurrentUser());

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadUsers = async () => {
    try {
      const dbUsers = await administrationApi.getAdministrators();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        setUsers(dbUsers as UserRecord[]);
        saveStoredUsers(dbUsers as UserRecord[]);
        return;
      }
    } catch {
      setUsers(getStoredUsers());
    }
  };

  useEffect(() => {
    loadUsers();
    const handleAuth = () => setCurrentUserSession(getCurrentUser());
    window.addEventListener(AUTH_EVENT, handleAuth);
    return () => window.removeEventListener(AUTH_EVENT, handleAuth);
  }, []);

  const isSuperAdminOrDirector =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Regional Director" ||
    currentUser?.role === "Assistant Regional Director";
  const canGlobalEditUsers = isSuperAdminOrDirector || (currentUser?.canEdit && hasModuleAccess(currentUser, "MOD_ADMIN"));

  const handleSaveUser = async (userData: UserRecord) => {
    // Strict Access Control: if user != user1, do not proceed unless Super Admin/Director
    const isOwnAccount =
      String(currentUser?.id) === String(userData.id) ||
      (currentUser?.email && userData.email && currentUser.email.toLowerCase() === userData.email.toLowerCase());
    
    if (!canGlobalEditUsers && !isOwnAccount) {
      showToast("Access Denied: You do not have permission to modify other personnel accounts.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const isExisting = users.some((u) => String(u.id) === String(userData.id));
      let resolved: UserRecord;
      if (isExisting) {
        const saved = await administrationApi.updateAdministrator(userData.id, userData as any);
        resolved = (saved as UserRecord) || userData;
        setUsers((prev) => {
          const updated = prev.map((u) => (String(u.id) === String(userData.id) ? resolved : u));
          saveStoredUsers(updated);
          return updated;
        });
        showToast(`Personnel "${userData.name}" successfully updated!`, "success");
      } else {
        if (!canGlobalEditUsers) {
          showToast("Access Denied: Only administrators can register new personnel accounts.", "error");
          return;
        }
        const saved = await administrationApi.createAdministrator(userData as any);
        resolved = (saved as UserRecord) || userData;
        setUsers((prev) => {
          const updated = [resolved, ...prev];
          saveStoredUsers(updated);
          return updated;
        });
        showToast(`Personnel "${userData.name}" successfully registered in Turso!`, "success");
      }

      // Seamless Instant Reaction (No page reload required):
      // If the modified user is currently logged in, update current session immediately
      const current = getCurrentUser();
      if (
        current &&
        (String(current.id) === String(resolved.id) ||
          (current.email && resolved.email && current.email.toLowerCase() === resolved.email.toLowerCase()))
      ) {
        setCurrentUser({ ...current, ...resolved });
      }

      // Dispatch global events so Sidebar, ModuleGuard, and Project Data Management update immediately:
      window.dispatchEvent(new CustomEvent("dict_users_updated", { detail: resolved }));
      window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: getCurrentUser() }));

      setIsModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error("Save personnel error:", err);
      showToast("Error saving personnel: " + (err.message || "Failed"), "error");
    } finally {
      setIsSubmitting(false);
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
        showToast("Personnel successfully deleted from Turso.", "success");
      } else {
        showToast("Failed to delete personnel.", "error");
      }
      setDeleteConfirmId(null);
    } catch (err: any) {
      console.error("Delete personnel error:", err);
      showToast("Error deleting personnel: " + (err.message || "Failed"), "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleUserStatus = async (user: UserRecord) => {
    if (!canGlobalEditUsers) {
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

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "All" || user.role === roleFilter;
    const matchesRegion = regionFilter === "All" || user.region === regionFilter;
    const matchesFocal =
      focalFilter === "All" ||
      (focalFilter === "Focal" && user.isFocal) ||
      (focalFilter === "NonFocal" && !user.isFocal);
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "active" && user.status === "active") ||
      (statusFilter === "inactive" && user.status === "inactive");

    return matchesSearch && matchesRole && matchesRegion && matchesFocal && matchesStatus;
  });

  return (
    <div className="space-y-6 relative max-w-[1920px] mx-auto text-slate-200">
      
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/90 border-red-500/40 text-red-300"
          }`}
        >
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Access Control
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              DICT Personnel Directory
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-400" />
            Users & Regional Access
          </h2>
          <p className="text-xs text-slate-400">
            Manage authorized Regional Directors, Assistant Directors, Project Focal Persons, and technical staff
          </p>
        </div>

        <button
          onClick={() => {
            setEditingUser(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-blue-900/40 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" /> Add User / Director
        </button>
      </div>

      {/* Directory Card */}
      <div className="bg-[#0C101D] border border-[#18233C] rounded-2xl overflow-hidden shadow-xl">
        
        {/* Filters */}
        <div className="border-b border-[#18233C] p-4 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-[#080B14]">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="search"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-[#1C2844] bg-[#111728] pl-10 pr-4 py-2 text-xs text-slate-200 focus:border-blue-500 focus:outline-none placeholder:text-slate-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Deactivated Only</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Roles</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={focalFilter}
              onChange={(e) => setFocalFilter(e.target.value as any)}
              className="bg-[#111728] border border-[#1C2844] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="All">All Designations</option>
              <option value="Focal">Focal Persons Only</option>
              <option value="NonFocal">Non-Focal Only</option>
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
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

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-extrabold text-slate-400 uppercase bg-[#111728] border-b border-[#18233C] tracking-wider">
              <tr>
                <th className="px-6 py-4">User Profile</th>
                <th className="px-6 py-4">Role & Status</th>
                <th className="px-6 py-4">Focal Designation</th>
                <th className="px-6 py-4">Jurisdiction Scope</th>
                <th className="px-6 py-4">Accessible Projects</th>
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

                const accessCount = PROJECTS.filter((p) =>
                  Boolean(user.access?.[p.id] || user.access?.[`MOD_${p.id.toUpperCase()}`] || user.access?.[p.id.toLowerCase()])
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
                          <div className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span>{user.name}</span>
                            {(isDirector || isAsstDirector) && (
                              <Crown className="w-3.5 h-3.5 text-blue-400" />
                            )}
                            {currentUser && (String(currentUser.id) === String(user.id) || currentUser.email?.toLowerCase() === user.email?.toLowerCase()) && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                                Active Session
                              </span>
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

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Switch Active Session button (Available for Super Admin or Testing) */}
                        {isSuperAdminOrDirector && (
                          <button
                            type="button"
                            onClick={() => {
                              if (user.status === "inactive") {
                                showToast(`Cannot switch to ${user.name}: Account is deactivated.`, "error");
                                return;
                              }
                              setCurrentUser(user);
                              showToast(`Active session switched to ${user.name} (${user.role})!`, "success");
                              window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: user }));
                              window.dispatchEvent(new CustomEvent("dict_users_updated", { detail: user }));
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              user.status === "inactive"
                                ? "text-slate-600 hover:text-slate-500"
                                : "text-blue-400 hover:text-white hover:bg-blue-600/30"
                            }`}
                            title={
                              user.status === "inactive"
                                ? `Cannot switch: ${user.name} is deactivated`
                                : `Switch Active Session to ${user.name}`
                            }
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const isOwn =
                              String(currentUser?.id) === String(user.id) ||
                              (currentUser?.email && user.email && currentUser.email.toLowerCase() === user.email.toLowerCase());
                            if (!canGlobalEditUsers && !isOwn) {
                              showToast("Access Denied: You cannot modify other users' profiles.", "error");
                              return;
                            }
                            setEditingUser(user);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {((isSuperAdminOrDirector || currentUser?.canDelete) && String(currentUser?.id) !== String(user.id)) && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(user.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0C101D] border border-[#18233C] p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Delete Personnel Record</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to remove this user from the directory? This action immediately revokes access.
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
                <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
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
