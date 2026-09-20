import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import { Dashboard } from "./pages/Dashboard";
import { Monitoring } from "./pages/Monitoring";
import { ProjectDetail } from "./pages/ProjectDetail";
import { DataExplorer } from "./pages/DataExplorer";
import { Login } from "./pages/Login";
import { RegionalCalendar } from "./pages/RegionalCalendar";
import { DtrGenerator } from "./pages/DtrGenerator";

import { ProjectConfig } from "./pages/settings/ProjectConfig";
import { UserAccess } from "./pages/settings/UserAccess";
import { SystemSettings } from "./pages/settings/SystemSettings";
import { ModuleGuard } from "./components/auth/ModuleGuard";

function App() {
  return (
    <BrowserRouter>
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

        {/* Fallbacks for other routes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
