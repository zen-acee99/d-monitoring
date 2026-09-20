import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Wifi, Search, FileX, Share2, Download, CheckCircle2,
  ChevronDown, Expand, Activity, Users, Database,
  Server, HardDrive, ShieldAlert, Settings, Radio, CheckSquare, Calendar,
  FileText
} from "lucide-react";
import { ProjectBarChart, ProjectAreaChart, ProjectDonutChart } from "@/components/charts";
import { BicolMap } from "@/components/BicolMap";
import { PROJECTS } from "@/config/projects";
import { DashboardProjectsTabs } from "@/components/dashboard/DashboardProjectsTabs";
import { projectApi, OverviewStats } from "@/services/api";
import { UniversalReportModal } from "@/components/reports/UniversalReportModal";

const KPICard = ({ title, value, trend, icon: Icon, imgSrc, color, bgHover, trendUp, href, badge }: any) => (
  <Link to={href || "#"} className={`relative flex items-center justify-between p-4 sm:p-5 rounded-xl border ${color} bg-[#0C101A] overflow-hidden group hover:bg-[#111520] transition-colors cursor-pointer block`}>
    {/* Colored Top Border Indicator matching the image */}
    <div className={`absolute top-0 left-0 w-full h-0.5 ${bgHover}`} />
    
    {/* Subtle Background Glow */}
    <div className={`absolute -left-4 -top-4 w-20 h-20 rounded-full blur-3xl ${bgHover} opacity-10 group-hover:opacity-20 transition-opacity`} />
    
    <div className="flex items-center gap-3.5 z-10 w-full">
      <div className={`p-3 rounded-xl border ${color} bg-[#07090E] flex items-center justify-center shrink-0`}>
         {imgSrc ? (
           <img src={imgSrc} alt={`${title} logo`} className="w-6 h-6 object-contain" />
         ) : (
           <Icon className={`w-6 h-6 ${color.replace('border-', 'text-').split(' ')[1] || 'text-blue-400'}`} />
         )}
      </div>
      <div className="flex-1 min-w-0">
         <div className="flex items-center justify-between gap-1">
           <p className="text-[11px] text-slate-300 font-bold uppercase tracking-wider truncate">{title}</p>
           {badge && (
             <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/50 text-slate-300 border border-slate-700/60 shrink-0">
               {badge}
             </span>
           )}
         </div>
         <div className="text-xl font-bold text-white mt-0.5 tracking-tight truncate">{value}</div>
         <p className="text-[10px] mt-1 font-medium truncate">
           <span className={trendUp ? "text-emerald-400" : "text-amber-400"}>{trend}</span>
         </p>
      </div>
    </div>
  </Link>
);

export function Dashboard() {
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(null);
  const [barChartView, setBarChartView] = useState<"projects" | "provinces">("projects");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchStats = () => {
    projectApi.getOverviewStats().then((data) => {
      if (data) setOverviewStats(data);
    });
  };

  useEffect(() => {
    fetchStats();
    window.addEventListener("dict_records_updated", fetchStats);
    window.addEventListener("dict_project_data_updated", fetchStats);
    window.addEventListener("dict_freewifi_updated", fetchStats);
    window.addEventListener("dict_projects_meta_updated", fetchStats);
    return () => {
      window.removeEventListener("dict_records_updated", fetchStats);
      window.removeEventListener("dict_project_data_updated", fetchStats);
      window.removeEventListener("dict_freewifi_updated", fetchStats);
      window.removeEventListener("dict_projects_meta_updated", fetchStats);
    };
  }, []);

  const deploymentChartData = React.useMemo(() => {
    if (barChartView === "provinces") {
      return overviewStats?.provincialDeployments || [];
    }
    return overviewStats?.projectDeployments || [];
  }, [overviewStats, barChartView]);

  const totalBeneficiaries = React.useMemo(() => {
    if (overviewStats?.beneficiaries?.total !== undefined) {
      return overviewStats.beneficiaries.total;
    }
    return 0;
  }, [overviewStats]);

  const totalTransactions = React.useMemo(() => {
    if (overviewStats?.transactions?.total !== undefined) {
      return overviewStats.transactions.total;
    }
    return 0;
  }, [overviewStats]);

  const transactionsList = React.useMemo(() => {
    if (overviewStats?.transactions?.breakdown) {
      return overviewStats.transactions.breakdown.map((t) => ({
        name: t.name,
        val: t.val.toLocaleString(),
        color: t.color,
      }));
    }
    return [];
  }, [overviewStats]);

  return (
    <div className="space-y-4 max-w-[1920px] mx-auto text-slate-200">
      
      {/* Overview Top Command Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1A2235]">
        <div>
          <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2.5">
            <span>DICT Region V Command Center</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Operations
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time provincial telemetry, project deployments, digital services & cybersecurity monitoring
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all cursor-pointer border border-blue-400/30 hover:scale-[1.02]"
            title="Generate Consolidated DICT Region V Operations & Telemetry Report"
          >
            <FileText className="w-4 h-4" />
            <span>Generate Regional Report</span>
          </button>
        </div>
      </div>

      {/* Top Row: KPIs */}
      <div className="flex flex-col xl:flex-row gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {PROJECTS.map((project) => {
            const stat = overviewStats?.projectStats?.[project.id];
            let icon = Activity;
            
            // Assign icons based on project ID
            if (project.id === "gecs") icon = Radio;
            else if (project.id === "freewifi") icon = Wifi;
            else if (project.id === "egovph") icon = CheckSquare;
            else if (project.id === "elgu") icon = Activity;
            else if (project.id === "nbp" || project.id === "govnet") icon = Server;
            else if (project.id === "pnpki" || project.id === "cybersecurity") icon = ShieldAlert;
            else if (project.id === "ilcdb" || project.id === "iidb") icon = Database;
            else if (project.id === "miss") icon = Activity;

            const effectiveStatus = stat?.status || project.status;
            let color = "border-emerald-500/30 text-emerald-400";
            let bgHover = "bg-emerald-500";
            
            if (effectiveStatus === "warning") {
              color = "border-amber-500/30 text-amber-400";
              bgHover = "bg-amber-500";
            } else if (effectiveStatus === "critical") {
              color = "border-red-500/30 text-red-400";
              bgHover = "bg-red-500";
            } else if (effectiveStatus === "inactive") {
              color = "border-slate-500/30 text-slate-400";
              bgHover = "bg-slate-500";
            }

            const value = stat?.primaryMetric || (stat ? `${stat.operational}/${stat.total}` : "...");
            const trend = stat?.subMetric || (stat ? `${stat.healthPct}% Health` : "Syncing...");
            const badge = stat ? `${stat.healthPct}%` : undefined;

            return (
              <KPICard 
                key={project.id}
                title={project.shortName} 
                href={`/projects/${project.id}`}
                value={value} 
                trend={trend} 
                badge={badge}
                icon={icon}
                imgSrc={project.id === "ilcdb" ? "/image.png" : undefined}
                color={color} 
                bgHover={bgHover} 
                trendUp={effectiveStatus === "operational"} 
              />
            );
          })}
        </div>
      </div>

      {/* Main Grid Layout - 12 columns, specific matching row spans */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* LEFT COL: Map / Ecosystem (Spans 2 rows ~600px) */}
        <div className="col-span-12 lg:col-span-5 row-span-2 bg-[#0C101A] border border-[#1A2235] rounded-xl flex flex-col h-[650px] relative overflow-hidden">
           <div className="p-4 pb-2 z-10 relative flex items-center justify-between border-b border-[#1A2235]/60 bg-[#07090E]">
             <div>
               <h3 className="text-[13px] font-bold text-blue-400">Project Ecosystem Overview</h3>
               <p className="text-[10px] text-slate-400 mt-0.5">Bicol Region Provincial Mapping & Deployment Status</p>
             </div>
           </div>
           
           {/* Interactive Bicol Map */}
           <div className="flex-1 relative overflow-hidden">
             <BicolMap />
           </div>
        </div>

        {/* MIDDLE COL TOP: Bar Chart (Regional Project Deployments & Operations) */}
        <div className="col-span-12 lg:col-span-4 bg-[#0C101A] border border-[#1A2235] rounded-xl flex flex-col h-[317px] p-5">
           <div className="flex justify-between items-start mb-2">
             <div>
               <h3 className="text-[13px] font-bold text-blue-400">Regional Deployments & Operations</h3>
               <p className="text-[10px] text-slate-400">Verified project assets across 6 Bicol provinces</p>
             </div>
             <div className="flex items-center gap-1 bg-[#07090E] p-0.5 rounded-lg border border-[#1A2235]">
               <button
                 type="button"
                 onClick={() => setBarChartView("projects")}
                 className={`text-[9px] font-semibold px-2 py-0.5 rounded transition-colors ${
                   barChartView === "projects"
                     ? "bg-blue-600 text-white shadow-sm"
                     : "text-slate-400 hover:text-white"
                 }`}
               >
                 By Project
               </button>
               <button
                 type="button"
                 onClick={() => setBarChartView("provinces")}
                 className={`text-[9px] font-semibold px-2 py-0.5 rounded transition-colors ${
                   barChartView === "provinces"
                     ? "bg-blue-600 text-white shadow-sm"
                     : "text-slate-400 hover:text-white"
                 }`}
               >
                 By Province
               </button>
             </div>
           </div>
           <div className="mt-1">
             <div className="flex items-baseline gap-2">
               <span className="text-2xl font-bold text-white tracking-tight">
                 {overviewStats?.totalRecords ?? 0}
               </span>
               <span className="text-[10px] font-medium text-emerald-400">
                 {overviewStats ? `${overviewStats.totalOperational} Operational / Live` : "Syncing..."}
               </span>
             </div>
             <p className="text-[10px] text-slate-400 font-medium">
               {barChartView === "projects" ? "Active Deployments by Project Module" : "Total Operations across 6 Provinces"}
             </p>
           </div>
           <div className="flex-1 mt-2 -ml-3">
             <ProjectBarChart 
               data={deploymentChartData} 
               dataKey="count" 
               metricLabel={barChartView === "projects" ? "Deployments" : "Provincial Operations"} 
             />
           </div>
        </div>

        {/* RIGHT COL TOP: Area Chart + List (Digital Transactions & System Traffic) */}
        <div className="col-span-12 lg:col-span-3 bg-[#0C101A] border border-[#1A2235] rounded-xl flex flex-col h-[317px] p-5">
           <div className="flex justify-between items-start mb-1">
             <div>
               <h3 className="text-[13px] font-bold text-purple-400">Digital Transactions & Traffic</h3>
               <p className="text-[10px] text-slate-400">Processed e-Services & System Volume</p>
             </div>
             <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-medium">
               Active
             </span>
           </div>
           <div className="my-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-300 tracking-tight">
                  {totalTransactions.toLocaleString()}
                </span>
                <span className="text-[10px] font-medium text-emerald-400">Monthly Volume</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Aggregated Monthly Platform Transactions</p>
            </div>
            <div className="h-14 w-full -ml-3 mb-2">
              <ProjectAreaChart currentMonthly={totalTransactions} />
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
              {transactionsList.length > 0 ? (
                transactionsList.map((p) => (
                  <div key={p.name} className="flex justify-between items-center text-[11px] border-b border-[#1A2235]/60 pb-1.5 last:border-0">
                    <span className="text-slate-300 font-medium truncate pr-2">{p.name}</span>
                    <span className={`font-mono font-bold ${p.color}`}>{p.val}</span>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No transaction records recorded
                </div>
              )}
            </div>
        </div>

        {/* MIDDLE COL BOTTOM: Donut Chart (Resource & Service Distribution) */}
        <div className="col-span-12 lg:col-span-4 bg-[#0C101A] border border-[#1A2235] rounded-xl flex flex-col h-[317px] p-5">
           <div className="flex justify-between items-start mb-2">
             <div>
               <h3 className="text-[13px] font-bold text-white">Resource & Service Distribution</h3>
               <p className="text-[10px] text-slate-400">Share of Regional DICT Operations</p>
             </div>
           </div>
           <div className="flex-1 flex items-center">
             <div className="w-1/2 h-full relative">
               <ProjectDonutChart 
                 data={overviewStats?.distribution?.map(d => ({
                   name: d.name,
                   short: d.short,
                   value: d.pct,
                   count: d.count,
                   color: d.color
                 })) || []} 
               />
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                 <span className="text-white font-bold text-lg">
                   {overviewStats?.totalRecords ?? 0}
                 </span>
                 <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Total Records</span>
               </div>
             </div>
             <div className="w-1/2 flex flex-col justify-center space-y-2.5 pl-3">
               {(overviewStats?.distribution || []).map((item: any) => (
                 <div key={item.name} className="flex items-center justify-between text-[11px]">
                   <div className="flex items-center gap-2 min-w-0">
                     <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                     <div className="truncate">
                       <p className="text-slate-200 text-[11px] leading-none truncate">{item.name}</p>
                       <p className="text-[9px] text-slate-500 leading-tight truncate">{item.desc || item.short}</p>
                     </div>
                   </div>
                   <div className="text-right shrink-0 ml-2">
                     <span className="text-white font-mono font-semibold">{item.pct}%</span>
                     <span className="text-[9px] text-slate-400 font-mono block -mt-0.5">{item.count}</span>
                   </div>
                 </div>
               ))}
             </div>
           </div>
        </div>

        {/* RIGHT COL BOTTOM: Deployment Milestones & Field Operations */}
        <div className="col-span-12 lg:col-span-3 bg-[#0C101A] border border-[#1A2235] rounded-xl flex flex-col h-[317px] p-5">
           <div className="flex justify-between items-start mb-3">
             <div>
               <h3 className="text-[13px] font-bold text-emerald-400">Deployment & Field Operations</h3>
               <p className="text-[10px] text-slate-400">Regional Milestone Execution</p>
             </div>
             <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-medium">
               Region V
             </span>
           </div>
           
           <div className="flex-1 grid grid-cols-2 gap-2.5">
             <div className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] flex flex-col justify-between">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Live Sites</span>
                 <Wifi className="w-3.5 h-3.5 text-cyan-400" />
               </div>
               <div>
                 <div className="text-xl font-bold text-white font-mono">
                   {overviewStats?.liveSites ?? 0}
                 </div>
                 <p className="text-[9px] text-cyan-400 font-medium mt-0.5">Free Wi-Fi & Nodes</p>
               </div>
             </div>

             <div className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] flex flex-col justify-between">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Trainings</span>
                 <Users className="w-3.5 h-3.5 text-amber-400" />
               </div>
               <div>
                 <div className="text-xl font-bold text-white font-mono">
                   {overviewStats?.trainings ?? 0}
                 </div>
                 <p className="text-[9px] text-amber-400 font-medium mt-0.5">ILCDB Active Batches</p>
               </div>
             </div>

             <div className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] flex flex-col justify-between">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Monitored</span>
                 <Activity className="w-3.5 h-3.5 text-blue-400" />
               </div>
               <div>
                 <div className="text-xl font-bold text-white font-mono">
                   {overviewStats?.itAssist ?? 0}
                 </div>
                 <p className="text-[9px] text-blue-400 font-medium mt-0.5">Cybersec & Sat Terminals</p>
               </div>
             </div>

             <div className="p-3 bg-[#07090E] rounded-lg border border-[#1A2235] flex flex-col justify-between">
               <div className="flex items-center justify-between">
                 <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Regional SLA</span>
                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
               </div>
               <div>
                 <div className="text-xl font-bold text-white font-mono">
                   {overviewStats?.regionalSLA !== undefined ? `${overviewStats.regionalSLA}%` : "0%"}
                 </div>
                 <p className="text-[9px] text-emerald-400 font-medium mt-0.5">
                   {overviewStats ? `${overviewStats.totalRecords} Active Records` : "Syncing Records..."}
                 </p>
               </div>
             </div>
           </div>
        </div>

        {/* BOTTOM PANELS */}
      </div>

      {/* Project Tabs & Data Operations Section */}
      <DashboardProjectsTabs />

      {/* Universal Executive Operational Report Modal */}
      <UniversalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialProjectId="ALL"
      />
    </div>
  );
}
