import React, { useState, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { getCurrentUser, setCurrentUser, hasModuleAccess, AUTH_EVENT } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";

interface ModuleGuardProps {
  moduleCode: string;
  moduleName?: string;
  children: React.ReactNode;
}

export function ModuleGuard({ moduleCode, children }: ModuleGuardProps) {
  const params = useParams();
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(() => getCurrentUser());

  // Dynamic project code resolution (e.g. /projects/:projectId -> MOD_FREEWIFI)
  const effectiveModuleCode = React.useMemo(() => {
    if (moduleCode === "DYNAMIC_PROJECT" && params.projectId) {
      return `MOD_${params.projectId.toUpperCase()}`;
    }
    return moduleCode;
  }, [moduleCode, params.projectId]);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUserState(getCurrentUser());
    };
    window.addEventListener(AUTH_EVENT, handleAuthChange);
    window.addEventListener("dict_users_updated", handleAuthChange);
    window.addEventListener("dict_modules_updated", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuthChange);
      window.removeEventListener("dict_users_updated", handleAuthChange);
      window.removeEventListener("dict_modules_updated", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  // If user is NOT logged in or account is deactivated/inactive, redirect to login immediately
  if (!currentUser || currentUser.status === "inactive") {
    if (currentUser && currentUser.status === "inactive") {
      setCurrentUser(null);
    }
    return <Navigate to="/login" replace />;
  }

  // Overview / Home is always accessible for authenticated active users
  if (effectiveModuleCode === "MOD_OVERVIEW" || effectiveModuleCode === "/" || effectiveModuleCode === "overview") {
    return <>{children}</>;
  }

  const hasAccess = hasModuleAccess(currentUser, effectiveModuleCode);

  // If user does not have module access, simply redirect back to Overview
  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
