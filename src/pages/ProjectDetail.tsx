import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldAlert, ShieldCheck, Lock, ArrowLeft, Download, Upload, Settings, FileText, FileSpreadsheet, FileJson, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, BarChart } from "@/components/charts";
import { PROJECTS } from "@/config/projects";
import { PROJECT_SCHEMAS } from "@/data/projectDataStore";
import { projectApi } from "@/services/api";
import { Modal } from "@/components/ui/modal";
import { ElguAnalytics } from "@/components/elgu/ElguAnalytics";
import { normalizeElguRecord, mergeElguRecords } from "@/data/elguData";
import { FreeWifiAnalytics } from "@/components/freewifi/FreeWifiAnalytics";
import { PnpkiAnalytics } from "@/components/pnpki/PnpkiAnalytics";
import { CybersecurityAnalytics } from "@/components/cybersecurity/CybersecurityAnalytics";
import { IlcdbAnalytics } from "@/components/ilcdb/IlcdbAnalytics";
import { MissAnalytics } from "@/components/miss/MissAnalytics";
import { EgovphAnalytics } from "@/components/egovph/EgovphAnalytics";
import { getCurrentUser, hasModuleAccess, canUserEditProject, AUTH_EVENT } from "@/services/authStore";
import { UserRecord } from "@/data/userStore";
import { UniversalReportModal } from "@/components/reports/UniversalReportModal";
import { exportProjectRecordsToPdf, parsePdfFileToRecords } from "@/utils/projectPdfExportImport";

export function ProjectDetail() {
  const { projectId } = useParams();
  const project = PROJECTS.find(p => p.id === projectId);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(() => getCurrentUser());

  useEffect(() => {
    const handleAuth = () => setCurrentUser(getCurrentUser());
    window.addEventListener(AUTH_EVENT, handleAuth);
    window.addEventListener("dict_users_updated", handleAuth);
    return () => {
      window.removeEventListener(AUTH_EVENT, handleAuth);
      window.removeEventListener("dict_users_updated", handleAuth);
    };
  }, []);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx" | "csv" | "json">("pdf");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [projectRecords, setProjectRecords] = useState<Record<string, any>[]>([]);
  const [importPreviewRecords, setImportPreviewRecords] = useState<Record<string, any>[]>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSchema = PROJECT_SCHEMAS[projectId || "freewifi"] || PROJECT_SCHEMAS.freewifi;
  const userCanEditThisProject = canUserEditProject(currentUser, projectId || "");

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load current project records for Export / Import
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    projectApi.getTableRecords(projectId).then((rows) => {
      if (active && Array.isArray(rows) && rows.length > 0) {
        setProjectRecords(rows);
      } else if (active) {
        try {
          const saved = localStorage.getItem("dict_project_data_store_v1");
          if (saved) {
            const store = JSON.parse(saved);
            if (Array.isArray(store[projectId]) && store[projectId].length > 0) {
              setProjectRecords(store[projectId]);
              return;
            }
          }
        } catch {
          // ignore
        }
        setProjectRecords(activeSchema?.defaultRecords || []);
      }
    });
    return () => {
      active = false;
    };
  }, [projectId, activeSchema]);

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

  const getSanitizedExportRecords = () => {
    const source = projectRecords.length > 0 ? projectRecords : activeSchema?.defaultRecords || [];
    return source.map((row) => {
      if (projectId === "pnpki") {
        const copy = { ...row };
        ["applicantName", "fullName", "subscriber"].forEach((k) => {
          if (copy[k] !== undefined) {
            copy[k] = String(copy[k] || "").trim().replace(/[A-Za-z0-9]/g, "*") || "********";
          }
        });
        return copy;
      }
      return row;
    });
  };

  const handleExport = (forcedFormat?: "pdf" | "xlsx" | "csv" | "json") => {
    const fmt = forcedFormat || exportFormat;
    setIsGenerating(true);
    try {
      const records = getSanitizedExportRecords();
      if (fmt === "pdf") {
        exportProjectRecordsToPdf({
          projectId: project.id,
          projectName: project.name,
          shortName: project.shortName,
          fields: activeSchema?.fields || [],
          records,
        });
        showToast(`Exported ${records.length} ${project.shortName} record(s) to PDF.`);
      } else if (fmt === "xlsx") {
        const ws = XLSX.utils.json_to_sheet(records);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, project.shortName.slice(0, 31));
        XLSX.writeFile(wb, `DICT_${project.id}_records_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast(`Exported ${records.length} ${project.shortName} record(s) to Excel (.xlsx).`);
      } else if (fmt === "json") {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", `DICT_${project.id}_records_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast(`Exported ${records.length} ${project.shortName} record(s) to JSON.`);
      } else {
        const keys = records.length > 0 ? Object.keys(records[0]) : (activeSchema?.fields || []).map((f) => f.key);
        const csvRows = [
          keys.join(","),
          ...records.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
        ];
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `DICT_${project.id}_records_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${records.length} ${project.shortName} record(s) to CSV.`);
      }
      setIsExportOpen(false);
    } catch (err: any) {
      showToast(`Export failed: ${err.message || "Error"}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTemplate = (fmt: "pdf" | "xlsx" | "csv") => {
    const sampleRecord: Record<string, any> = { id: `${project.id}-001` };
    (activeSchema?.fields || []).forEach((f) => {
      sampleRecord[f.key] = f.defaultValue ?? (f.options ? f.options[0] : f.type === "number" ? 0 : "Sample Value");
    });

    if (fmt === "pdf") {
      exportProjectRecordsToPdf({
        projectId: project.id,
        projectName: project.name,
        shortName: project.shortName,
        fields: activeSchema?.fields || [],
        records: [sampleRecord],
      });
    } else if (fmt === "xlsx") {
      const ws = XLSX.utils.json_to_sheet([sampleRecord]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.writeFile(wb, `Template_${project.id}.xlsx`);
    } else {
      const keys = Object.keys(sampleRecord);
      const csvRows = [
        keys.join(","),
        keys.map((k) => `"${String(sampleRecord[k] ?? "").replace(/"/g, '""')}"`).join(","),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Template_${project.id}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportFileName(file.name);

    const lower = file.name.toLowerCase();
    const finalizePreview = (rows: Record<string, any>[]) => {
      if (project.id === "elgu") {
        return rows.map((r, i) => normalizeElguRecord(r, i));
      }
      return rows.map((r, i) => ({
        id: r.id || `${project.id}-imp-${Date.now()}-${i}`,
        ...r,
      }));
    };

    try {
      if (lower.endsWith(".pdf") || file.type === "application/pdf") {
        const { records } = await parsePdfFileToRecords(file, project.id, activeSchema?.fields || []);
        if (records.length === 0) {
          setImportError("Could not extract table rows from this PDF. Please upload a valid project PDF report or CSV/Excel file.");
          setImportPreviewRecords([]);
        } else {
          setImportPreviewRecords(finalizePreview(records));
        }
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const firstSheet = wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet], { defval: "" });
        setImportPreviewRecords(finalizePreview(rows));
      } else if (lower.endsWith(".json")) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          setImportError("JSON file must contain an array of records.");
          setImportPreviewRecords([]);
        } else {
          setImportPreviewRecords(finalizePreview(parsed));
        }
      } else {
        // CSV (use XLSX parser so quoted commas like "V1 BPBC, V1 BPCO" are preserved)
        const text = await file.text();
        const wb = XLSX.read(text, { type: "string" });
        const firstSheet = wb.SheetNames[0];
        const rows = firstSheet
          ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheet], { defval: "" })
          : [];
        if (rows.length === 0) {
          setImportError("CSV file must have a header line and at least 1 data row.");
          setImportPreviewRecords([]);
          return;
        }
        setImportPreviewRecords(finalizePreview(rows));
      }
    } catch (err: any) {
      setImportError(`Failed to parse file: ${err.message || "Invalid format"}`);
      setImportPreviewRecords([]);
    }
  };

  const handleConfirmImport = async () => {
    if (!userCanEditThisProject) {
      setImportError(`Permission Denied: Only the personnel assigned to ${project.shortName} can import or modify data.`);
      return;
    }
    if (importPreviewRecords.length === 0) {
      setImportError("Please upload a valid PDF, CSV, Excel, or JSON file with records first.");
      return;
    }

    const pId = project.id;
    const recordsToSave =
      pId === "elgu"
        ? importPreviewRecords.map((r, i) => normalizeElguRecord(r, i))
        : importPreviewRecords;

    const updatedList =
      pId === "elgu"
        ? mergeElguRecords(recordsToSave, projectRecords)
        : [...recordsToSave, ...projectRecords];

    setProjectRecords(updatedList);

    try {
      await projectApi.bulkImport(pId, recordsToSave, false);
    } catch {
      // fallback to local store if offline
    }

    try {
      const saved = localStorage.getItem("dict_project_data_store_v1");
      const store = saved ? JSON.parse(saved) : {};
      store[pId] = updatedList;
      localStorage.setItem("dict_project_data_store_v1", JSON.stringify(store));
      window.dispatchEvent(new CustomEvent("dict_project_data_updated", { detail: { recordsStore: store, projectId: pId } }));
      window.dispatchEvent(new CustomEvent("dict_records_updated", { detail: { projectId: pId, timestamp: Date.now() } }));
    } catch {
      // ignore storage quota errors
    }

    showToast(`Imported ${recordsToSave.length} record(s) into ${project.shortName}.`);
    setIsImportOpen(false);
    setImportPreviewRecords([]);
    setImportFileName("");
  };

  const isElgu = projectId === "elgu";
  const isFreeWifi = projectId === "freewifi";
  const isPnpki = projectId === "pnpki";
  const isCybersecurity = projectId === "cybersecurity";
  const isIlcdb = projectId === "ilcdb";
  const isMiss = projectId === "miss";
  const isEgovph = projectId === "egovph";

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold ${
            toastMessage.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/95 border-red-500/40 text-red-300"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
        <Link to="/" className="hover:text-white transition-colors">Overview</Link>
        <span>/</span>
        <span className="text-blue-400 font-medium">{project.shortName}</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h2 className="text-3xl font-bold tracking-tight text-white">{project.name}</h2>
            <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-[0_0_10px_rgba(0,0,0,0.2)] ${
              project.status === 'operational' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 
              project.status === 'warning' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {project.status}
            </div>
            {userCanEditThisProject ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Can Edit &amp; Modify ({project.shortName})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Lock className="w-3 h-3 text-amber-400" />
                Read-Only (Unselected Project)
              </span>
            )}
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

          <button
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-2 bg-rose-600/15 hover:bg-rose-600/25 text-rose-200 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-rose-500/40 cursor-pointer"
            title={`Export ${project.shortName} records to PDF, Excel, CSV, or JSON`}
          >
            <Download className="mr-1 h-4 w-4 text-rose-400" /> Export PDF / Data
          </button>

          <button
            onClick={() => {
              if (!userCanEditThisProject) {
                showToast(`Read-Only: Only personnel with ${project.shortName} selected can import or modify data.`, "error");
                return;
              }
              setIsImportOpen(true);
            }}
            disabled={!userCanEditThisProject}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${
              userCanEditThisProject
                ? "bg-[#1A2235] hover:bg-[#232D45] text-slate-200 border-[#2A3650] cursor-pointer"
                : "bg-[#0C101D] text-slate-500 border-slate-800 cursor-not-allowed opacity-60"
            }`}
            title={
              userCanEditThisProject
                ? `Import PDF, CSV, Excel, or JSON data into ${project.shortName}`
                : `Restricted: Your account is not assigned to ${project.shortName}`
            }
          >
            {userCanEditThisProject ? <Upload className="mr-1 h-4 w-4" /> : <Lock className="mr-1 h-4 w-4" />}
            Import PDF / Data
          </button>

          {userCanEditThisProject ? (
            <Link
              to="/settings/projects"
              className="flex items-center gap-2 bg-[#1A2235] hover:bg-[#232D45] text-slate-200 px-4 py-2 rounded-lg text-sm transition-colors border border-[#2A3650]"
            >
              <Settings className="mr-1 h-4 w-4" /> Manage Data
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="flex items-center gap-2 bg-[#0C101D] text-slate-500 px-4 py-2 rounded-lg text-sm border border-slate-800 cursor-not-allowed opacity-60"
              title={`Read-Only: Only personnel with ${project.shortName} selected as their Project Handled can edit this project`}
            >
              <Lock className="mr-1 h-4 w-4" /> Manage Data (Locked)
            </button>
          )}
        </div>
      </div>

      {/* Render dedicated deep analytics for eLGU, Free WiFi 4 All, PNPKI, Cybersecurity, ILCDB, MISS, & eGovPH */}
      {isElgu ? (
        <ElguAnalytics records={projectRecords as any} />
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
      ) : isEgovph ? (
        <EgovphAnalytics records={projectRecords as any} />
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
          <p className="text-sm text-text-muted">Select the format to export your {project.name} dataset ({projectRecords.length} records).</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => setExportFormat("pdf")}
              className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-colors cursor-pointer ${
                exportFormat === "pdf"
                  ? "border-rose-500 bg-rose-500/15 text-rose-300"
                  : "border-border-primary hover:border-border-secondary bg-background-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <FileText className="h-6 w-6 mb-2" />
              <span className="text-xs font-bold">PDF (.pdf)</span>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat("xlsx")}
              className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-colors cursor-pointer ${
                exportFormat === "xlsx"
                  ? "border-brand-500 bg-brand-500/10 text-brand-400"
                  : "border-border-primary hover:border-border-secondary bg-background-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <FileSpreadsheet className="h-6 w-6 mb-2" />
              <span className="text-xs font-medium">Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat("csv")}
              className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-colors cursor-pointer ${
                exportFormat === "csv"
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                  : "border-border-primary hover:border-border-secondary bg-background-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <FileText className="h-6 w-6 mb-2" />
              <span className="text-xs font-medium">CSV (.csv)</span>
            </button>
            <button
              type="button"
              onClick={() => setExportFormat("json")}
              className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-colors cursor-pointer ${
                exportFormat === "json"
                  ? "border-purple-500 bg-purple-500/15 text-purple-300"
                  : "border-border-primary hover:border-border-secondary bg-background-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <FileJson className="h-6 w-6 mb-2" />
              <span className="text-xs font-medium">JSON (.json)</span>
            </button>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsExportOpen(false)}>Cancel</Button>
            <Button onClick={() => handleExport()} disabled={isGenerating}>
              {isGenerating ? "Generating..." : `Download ${exportFormat.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title={`Import Data: ${project.shortName}`}>
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Upload project records into <span className="text-white font-semibold">{project.name}</span>. Supported formats: <strong className="text-white">.pdf, .csv, .xlsx, .json</strong>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,.json,application/pdf,text/csv,application/json"
            onChange={handleImportFileChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border-secondary rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-background-tertiary/50 transition-colors cursor-pointer"
          >
            <div className="h-12 w-12 bg-background-tertiary rounded-full flex items-center justify-center mb-4 text-text-muted">
              <Upload className="h-6 w-6" />
            </div>
            <h4 className="font-medium text-text-primary mb-1">
              {importFileName ? `Selected: ${importFileName}` : "Click to upload PDF, Excel, CSV, or JSON"}
            </h4>
            <p className="text-xs text-text-muted max-w-xs">
              {importPreviewRecords.length > 0
                ? `${importPreviewRecords.length} record(s) ready to import into ${project.shortName}.`
                : "PDF, Excel (.xlsx), CSV, or JSON files supported."}
            </p>
          </div>

          {importError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {importError}
            </div>
          )}

          <div className="bg-background-tertiary p-3 rounded-md border border-border-primary flex items-start gap-3">
            <FileSpreadsheet className="h-5 w-5 text-status-cyan shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Need a template?</p>
              <p className="text-xs text-text-muted mt-0.5 mb-2">Download the standard format for {project.shortName}:</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("pdf")}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer underline"
                >
                  Download Template.pdf
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("xlsx")}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 cursor-pointer underline"
                >
                  Download Template.xlsx
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("csv")}
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 cursor-pointer underline"
                >
                  Download Template.csv
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmImport} disabled={importPreviewRecords.length === 0 || !userCanEditThisProject}>
              Import {importPreviewRecords.length > 0 ? `(${importPreviewRecords.length})` : "Records"}
            </Button>
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
