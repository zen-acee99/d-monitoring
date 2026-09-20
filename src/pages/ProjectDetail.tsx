import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldAlert, Lock, ArrowLeft, Download, Upload, Settings, FileText, FileSpreadsheet, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, BarChart } from "@/components/charts";
import { PROJECTS } from "@/config/projects";
import { Modal } from "@/components/ui/modal";
import { ElguAnalytics } from "@/components/elgu/ElguAnalytics";
import { FreeWifiAnalytics } from "@/components/freewifi/FreeWifiAnalytics";
import { PnpkiAnalytics } from "@/components/pnpki/PnpkiAnalytics";
import { CybersecurityAnalytics } from "@/components/cybersecurity/CybersecurityAnalytics";
import { IlcdbAnalytics } from "@/components/ilcdb/IlcdbAnalytics";
import { MissAnalytics } from "@/components/miss/MissAnalytics";
import { getCurrentUser, hasModuleAccess, AUTH_EVENT } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { UniversalReportModal } from "@/components/reports/UniversalReportModal";

export function ProjectDetail() {
  const { projectId } = useParams();
  const project = PROJECTS.find(p => p.id === projectId);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());

  useEffect(() => {
    const handleAuth = () => setCurrentUser(getCurrentUser());
    window.addEventListener(AUTH_EVENT, handleAuth);
    return () => window.removeEventListener(AUTH_EVENT, handleAuth);
  }, []);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold text-white">Project Not Found</h2>
        <Link to="/">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // Global Access Control: Block unauthorized users from proceeding
  if (!hasModuleAccess(currentUser, projectId || "")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shadow-xl shadow-red-950/40">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-xl font-bold text-white tracking-tight">Access Restricted</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            You do not have permission to view or manage the <span className="text-white font-semibold">{project.name}</span> module. Only authorized project focal persons and administrators may access this area.
          </p>
        </div>
        <Link to="/">
          <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-xs">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const handleExport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsExportOpen(false);
    }, 1500);
  };

  const isElgu = projectId === "elgu";
  const isFreeWifi = projectId === "freewifi";
  const isPnpki = projectId === "pnpki";
  const isCybersecurity = projectId === "cybersecurity";
  const isIlcdb = projectId === "ilcdb";
  const isMiss = projectId === "miss";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link to="/" className="hover:text-white transition-colors">Overview</Link>
        <span>/</span>
        <span className="text-blue-400 font-medium">{project.shortName}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-bold tracking-tight text-white">{project.name}</h2>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-[0_0_10px_rgba(0,0,0,0.2)] ${
              project.status === 'operational' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
              project.status === 'warning' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {project.status}
            </div>
          </div>
          <p className="text-slate-400">{project.description}</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all border border-blue-400/30 shadow-md shadow-blue-900/30 cursor-pointer"
            title={`Generate official executive report for ${project.name}`}
          >
            <FileText className="mr-1 h-4 w-4" /> Generate Report
          </button>
          <button onClick={() => setIsImportOpen(true)} className="flex items-center gap-2 bg-[#1A2235] hover:bg-[#232D45] text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors border border-[#2A3650]">
            <Upload className="mr-2 h-4 w-4" /> Import Data
          </button>
          <Link to="/settings/projects" className="flex items-center gap-2 bg-[#1A2235] hover:bg-[#232D45] text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors border border-[#2A3650]">
            <Settings className="mr-2 h-4 w-4" /> Manage Data
          </Link>
        </div>
      </div>

      {/* Render dedicated deep analytics for eLGU, Free WiFi 4 All, PNPKI, Cybersecurity, ILCDB, & MISS */}
      {isElgu ? (
        <ElguAnalytics />
      ) : isFreeWifi ? (
        <FreeWifiAnalytics />
      ) : isPnpki ? (
        <PnpkiAnalytics />
      ) : isCybersecurity ? (
        <CybersecurityAnalytics />
      ) : isIlcdb ? (
        <IlcdbAnalytics />
      ) : isMiss ? (
        <MissAnalytics />
      ) : (
        <>
          {/* Dynamic Project KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0C101A] border-t-2 border-t-emerald-500 border-x border-b border-[#1A2235] rounded-xl p-5 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-opacity group-hover:opacity-100 opacity-0" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 relative z-10">Health Score</p>
              <p className="text-3xl font-bold font-mono text-white relative z-10">
                {project.status === 'operational' ? '98.5' : project.status === 'warning' ? '87.2' : '45.0'}
              </p>
            </div>
            {project.enabledAnalytics.includes('connectedUsers') && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-text-muted mb-2">Connected Users</p>
                  <p className="text-3xl font-bold font-mono">248,931</p>
                </CardContent>
              </Card>
            )}
            {project.enabledAnalytics.includes('activeSites') && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-text-muted mb-2">Active Sites</p>
                  <p className="text-3xl font-bold font-mono">842</p>
                </CardContent>
              </Card>
            )}
            {project.enabledAnalytics.includes('bandwidth') && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-text-muted mb-2">Total Bandwidth</p>
                  <p className="text-3xl font-bold font-mono">12.4 TB</p>
                </CardContent>
              </Card>
            )}
            {project.enabledAnalytics.includes('transactions') && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-text-muted mb-2">Daily Transactions</p>
                  <p className="text-3xl font-bold font-mono">142,891</p>
                </CardContent>
              </Card>
            )}
            {project.enabledAnalytics.includes('threatsDetected') && (
              <Card>
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-text-muted mb-2">Threats Detected</p>
                  <p className="text-3xl font-bold font-mono text-status-orange">2,481</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {project.enabledAnalytics.includes('bandwidth') || project.enabledAnalytics.includes('transactions') || project.enabledAnalytics.includes('incidentVolume') ? (
              <Card>
                <CardHeader>
                  <CardTitle>Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <AreaChart />
                </CardContent>
              </Card>
            ) : null}

            {project.enabledAnalytics.includes('regionalCoverage') || project.enabledAnalytics.includes('coverage') ? (
              <Card>
                <CardHeader>
                  <CardTitle>Regional Distribution</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <BarChart />
                </CardContent>
              </Card>
            ) : null}
          </div>
          
          {/* Raw Data Table Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Monitoring Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-text-muted uppercase bg-background-tertiary border-b border-border-primary">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Region</th>
                      <th className="px-4 py-3">Metric</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1,2,3,4,5].map((i) => (
                      <tr key={i} className="border-b border-border-secondary hover:bg-background-tertiary/50">
                        <td className="px-4 py-3 font-mono text-text-muted">2026-08-18 10:3{i}:00</td>
                        <td className="px-4 py-3">NCR</td>
                        <td className="px-4 py-3">availability</td>
                        <td className="px-4 py-3 text-right font-mono">99.{9 - i}%</td>
                        <td className="px-4 py-3">
                          <Badge variant="success">OK</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Export Modal */}
      <Modal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} title={`Export Report: ${project.shortName}`}>
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Select the format and data to include in your export.</p>
          
          <div className="grid grid-cols-3 gap-3">
            <button className="flex flex-col items-center justify-center p-4 border border-brand-500 bg-brand-500/10 rounded-lg text-brand-400">
              <FileSpreadsheet className="h-6 w-6 mb-2" />
              <span className="text-xs font-medium">Excel (.xlsx)</span>
            </button>
            <button className="flex flex-col items-center justify-center p-4 border border-border-primary hover:border-border-secondary bg-background-tertiary rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              <FileText className="h-6 w-6 mb-2" />
              <span className="text-xs font-medium">CSV (.csv)</span>
            </button>
            <button className="flex flex-col items-center justify-center p-4 border border-border-primary hover:border-border-secondary bg-background-tertiary rounded-lg text-text-secondary hover:text-text-primary transition-colors">
              <FileJson className="h-6 w-6 mb-2" />
              <span className="text-xs font-medium">JSON (.json)</span>
            </button>
          </div>

          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium">Include in Export:</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-border-primary text-brand-500 focus:ring-brand-500 bg-background-secondary" />
                Raw Monitoring Data
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-border-primary text-brand-500 focus:ring-brand-500 bg-background-secondary" />
                Aggregated Analytics
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={isGenerating}>
              {isGenerating ? "Generating..." : "Generate Export"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="Import Data">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Upload bulk monitoring data via spreadsheet. Supported formats: .csv, .xlsx</p>
          
          <div className="border-2 border-dashed border-border-secondary rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-background-tertiary/50 transition-colors cursor-pointer">
            <div className="h-12 w-12 bg-background-tertiary rounded-full flex items-center justify-center mb-4 text-text-muted">
              <Upload className="h-6 w-6" />
            </div>
            <h4 className="font-medium text-text-primary mb-1">Click to upload or drag and drop</h4>
            <p className="text-xs text-text-muted max-w-xs">Excel or CSV files up to 50MB. Ensure columns match the project template.</p>
          </div>

          <div className="bg-background-tertiary p-3 rounded-md border border-border-primary flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-status-cyan shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">Need the template?</p>
              <p className="text-xs text-text-muted mt-0.5 mb-2">Download the standard column format for {project.shortName}.</p>
              <a href="#" className="text-xs font-medium text-brand-400 hover:text-brand-300">Download Template.xlsx</a>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Configure Modal */}
      <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title={`${project.shortName} Configuration`}>
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Manage active analytics and metric thresholds for this project dashboard.</p>
          
          <div className="space-y-3">
            <h4 className="text-sm font-medium border-b border-border-primary pb-2">Enabled Analytics Components</h4>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {['connectedUsers', 'bandwidth', 'activeSites', 'transactions', 'threatsDetected'].map(analytic => (
                <label key={analytic} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input 
                    type="checkbox" 
                    defaultChecked={project.enabledAnalytics.includes(analytic)} 
                    className="rounded border-border-primary text-brand-500 focus:ring-brand-500 bg-background-secondary" 
                  />
                  {analytic.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancel</Button>
            <Button onClick={() => setIsConfigOpen(false)}>Save Configuration</Button>
          </div>
        </div>
      </Modal>

      {/* Official Project Operational Report Modal */}
      <UniversalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialProjectId={projectId || "ALL"}
      />
    </div>
  );
}
