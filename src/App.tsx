import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Snowfall } from "falling-snow/react";
import { isSnowEnabled, SNOW_EVENT } from "./services/snowStore";
import { Shell } from "./components/layout/Shell";
import { Dashboard } from "./pages/Dashboard";
import { Monitoring } from "./pages/Monitoring";
import { ProjectDetail } from "./pages/ProjectDetail";
import { DataExplorer } from "./pages/DataExplorer";
import { Login } from "./pages/Login";
import { RegionalCalendar } from "./pages/RegionalCalendar";
import { DtrGenerator } from "./pages/DtrGenerator";
import { SigningWorkspace } from "./pages/SigningWorkspace";
import { AceDtrCombiner } from "./pages/AceDtrCombiner";

import { ProjectConfig } from "./pages/settings/ProjectConfig";
import { UserAccess } from "./pages/settings/UserAccess";
import { SystemSettings } from "./pages/settings/SystemSettings";
import { OnlineUsersModule } from "./pages/settings/OnlineUsersModule";
import { ModuleGuard } from "./components/auth/ModuleGuard";
import { getCurrentUser } from "./services/authStore";

function OnlineUsersGuard({ children }: { children: React.ReactNode }) {
  const currentUser = getCurrentUser();
  const email = (currentUser?.email || "").toLowerCase().trim();
  const isAce = email === "ace.malto@dict.gov.ph" || email === "acemm.1599@gmail.com";

  if (!isAce) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-[#0C101D] border border-red-500/30 p-8 rounded-2xl max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">ACCESS RESTRICTED</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            The Online Users &amp; Live Presence module is strictly restricted to Super Admin (<span className="text-emerald-400 font-mono font-semibold">ace.malto@dict.gov.ph</span>).
          </p>
          <Link
            to="/settings/profile"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/30"
          >
            Return to My Profile
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  const [snowActive, setSnowActive] = useState<boolean>(() => isSnowEnabled());

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEv = e as CustomEvent<boolean>;
      setSnowActive(customEv.detail ?? isSnowEnabled());
    };
    window.addEventListener(SNOW_EVENT, handleToggle);
    return () => window.removeEventListener(SNOW_EVENT, handleToggle);
  }, []);

  return (
    <BrowserRouter>
      {snowActive && (
        <Snowfall
          fullScreen
          respectReducedMotion={false}
          count={180}
          speed={1.0}
          wind={0.25}
          size={[6, 26]}
          opacity={[0.65, 1.0]}
          colors={["#ffffff", "#e0f2fe", "#93c5fd", "#60a5fa", "#ffffff"]}
          flake="mixed"
          depth={1}
          zIndex={99999}
        />
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Main Application Routes */}
        <Route
          path="/"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_OVERVIEW" moduleName="Executive Overview">
                <Dashboard />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/dtr"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_DTR" moduleName="DTR Generator & PNPKI Signing">
                <DtrGenerator />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/gatepass"
          element={<Navigate to="/dtr?tab=gatepass" replace />}
        />
        <Route
          path="/calendar"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_CALENDAR" moduleName="Regional Calendar">
                <RegionalCalendar />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/signing-workspace"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_SIGNING" moduleName="Signing Workspace">
                <SigningWorkspace />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/dtr-combiner"
          element={
            <Shell>
              <AceDtrCombiner />
            </Shell>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <Shell>
              <ModuleGuard moduleCode="DYNAMIC_PROJECT">
                <ProjectDetail />
              </ModuleGuard>
            </Shell>
          }
        />
        
        {/* Settings & Administration Routes */}
        <Route
          path="/settings/projects"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_PROJECT_DATA" moduleName="Project Data Management">
                <ProjectConfig />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/settings/users"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_ADMIN" moduleName="User Directory & Access">
                <UserAccess />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/settings/system"
          element={
            <Shell>
              <ModuleGuard moduleCode="MOD_ADMIN" moduleName="Administration Module">
                <SystemSettings />
              </ModuleGuard>
            </Shell>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <Shell>
              <SystemSettings defaultTab="profile" />
            </Shell>
          }
        />
        <Route
          path="/settings/online-users"
          element={
            <Shell>
              <OnlineUsersGuard>
                <OnlineUsersModule isAceUser={true} />
              </OnlineUsersGuard>
            </Shell>
          }
        />

        {/* Fallbacks for other routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
