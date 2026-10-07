import * as XLSX from "xlsx";
import { FreeWifiSite, SITE_TYPE_CONFIG, getSiteTypeConfig, isSupplier1Site, isSupplier2Site } from "@/data/freewifiData";

export interface ReportConfig {
  reportTitle: string;
  reportSubtitle: string;
  preparedBy: string;
  designation: string;
  approvedBy: string;
  approvedDesignation: string;
  supplier1Name?: string;
  supplier2Name?: string;
  provinceFilter: string;
  municipalityFilter: string;
  supplierFilter: string;
  siteTypeFilter: string;
  linkTypeFilter: string;
  statusFilter: string;
  includeHardwareDetails: boolean;
  includeMunicipalMatrix: boolean;
  includeOmadaSummary: boolean;
  includeCharts: boolean;
  reportDate: string;
}

// Helper to determine exact online status
export function getSiteOperationalStatus(site: any): "Online" | "Degraded" | "Offline" {
  if (site.siteOnlineStatus) return site.siteOnlineStatus;
  if (site.status === "Offline") return "Offline";
  const offlineCount = site.offlineDevicesCount ?? 0;
  const onlineCount = site.onlineDevicesCount ?? 1;
  if (offlineCount === 0 && onlineCount > 0) return "Online";
  if (onlineCount > 0 && offlineCount > 0) return "Degraded";
  return "Offline";
}

export function exportFreeWifiToExcel(
  sites: FreeWifiSite[],
  config: Partial<ReportConfig> = {}
) {
  const wb = XLSX.utils.book_new();
  const dateStr = config.reportDate || new Date().toISOString().split("T")[0];

  // -------------------------------------------------------------
  // Sheet 1: Master Site Telemetry Roster
  // -------------------------------------------------------------
  const siteRows = sites.map((s, idx) => {
    const sAny = s as any;
    const typeCfg = getSiteTypeConfig(s.siteType);
    const opStatus = getSiteOperationalStatus(s);
    const supplier = sAny.omadaSupplier || (isSupplier1Site(s, config.supplier2Name) ? (config.supplier1Name || "Supplier 1") : (config.supplier2Name || "Supplier 2"));
    
    return {
      "No.": idx + 1,
      "Nationwide ID": s.nationwideId ? `#${s.nationwideId}` : "—",
      "Location Name / Facility": s.locationName || sAny.siteName || "—",
      "City / Municipality": s.municipality || "—",
      "Barangay": s.barangay || "—",
      "Province": s.province || "Albay",
      "Facility Category": typeCfg.label || s.siteType,
      "Facility Code": typeCfg.shortLabel || s.siteType,
      "Backhaul Technology": s.linkType || "Fiber",
      "Access Points (APs)": s.apCount || 2,
      "Operational Health": opStatus,
      "Omada Controller": supplier,
      "Online Devices": sAny.onlineDevicesCount ?? (opStatus === "Online" ? s.apCount || 2 : 0),
      "Offline Devices": sAny.offlineDevicesCount ?? (opStatus === "Offline" ? s.apCount || 2 : 0),
      "Router Hardware Model": sAny.omadaRouterModel || "ER605",
      "AP Hardware Model": sAny.omadaApModels || "EAP225-Outdoor",
      "Public WAN IP": sAny.omadaPublicIp || "—",
      "Funding Initiative": s.fundSource || "DICT Free Wi-Fi 4 All",
      "Location Code": s.locationCode || "—",
      "Contact Person": s.contact || "—",
      "Last Omada API Sync": sAny.lastOmadaSync ? new Date(sAny.lastOmadaSync).toLocaleString() : "Live Sync",
    };
  });

  const wsSites = XLSX.utils.json_to_sheet(siteRows);
  wsSites["!cols"] = [
    { wch: 6 },  // No
    { wch: 15 }, // Nationwide ID
    { wch: 42 }, // Location Name
    { wch: 20 }, // Municipality
    { wch: 20 }, // Barangay
    { wch: 14 }, // Province
    { wch: 30 }, // Facility Category
    { wch: 14 }, // Facility Code
    { wch: 20 }, // Backhaul
    { wch: 18 }, // APs
    { wch: 18 }, // Operational Health
    { wch: 18 }, // Controller
    { wch: 15 }, // Online Devices
    { wch: 15 }, // Offline Devices
    { wch: 22 }, // Router Model
    { wch: 22 }, // AP Model
    { wch: 18 }, // Public WAN IP
    { wch: 24 }, // Funding
    { wch: 18 }, // Location Code
    { wch: 22 }, // Contact
    { wch: 24 }, // Last Sync
  ];
  XLSX.utils.book_append_sheet(wb, wsSites, "Site Telemetry Roster");

  // -------------------------------------------------------------
  // Sheet 2: Executive Summary & Operational Metrics
  // -------------------------------------------------------------
  const totalSites = sites.length;
  const totalAps = sites.reduce((sum, s) => sum + (s.apCount || 0), 0);
  
  const onlineSites = sites.filter((s) => getSiteOperationalStatus(s) === "Online").length;
  const degradedSites = sites.filter((s) => getSiteOperationalStatus(s) === "Degraded").length;
  const offlineSites = sites.filter((s) => getSiteOperationalStatus(s) === "Offline").length;
  const healthIndex = totalSites > 0 ? `${Math.round(((onlineSites + degradedSites * 0.5) / totalSites) * 100)}%` : "100%";

  const fiberCount = sites.filter((s) => (s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC").length;
  const satelliteCount = sites.filter((s) => (s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO").length;
  
  const s1Name = config.supplier1Name || "Supplier 1";
  const s2Name = config.supplier2Name || "Supplier 2";
  const s1Sites = sites.filter((s) => isSupplier1Site(s, s2Name));
  const s2Sites = sites.filter((s) => isSupplier2Site(s, s2Name));

  const elemCount = sites.filter((s) => s.siteType === "PES").length;
  const hsCount = sites.filter((s) => s.siteType === "PHS").length;
  const heiCount = sites.filter((s) => s.siteType === "HEI-LUC").length;
  const totalEducation = elemCount + hsCount + heiCount;
  
  const lguHallCount = sites.filter((s) => s.siteType === "LGU-HALL").length;
  const pcCount = sites.filter((s) => s.siteType === "PC").length;
  const pfoCount = sites.filter((s) => s.siteType === "PFO").length;
  const totalGovernance = lguHallCount + pcCount + pfoCount;
  const otherCount = sites.length - (totalEducation + totalGovernance);

  const avgAps = totalSites > 0 ? (totalAps / totalSites).toFixed(2) : "0";
  const estConcurrentReach = totalAps * 45;
  const estDailyReach = sites.reduce((sum, s) => sum + (s.estimatedDailyUsers || (s.apCount || 2) * 120), 0);

  const kpiData = [
    { Section: "DOCUMENT CONTROL", Metric: "Report Title", Value: config.reportTitle || "FREE WIFI 4 ALL  OPERATIONAL REPORT" },
    { Section: "DOCUMENT CONTROL", Metric: "Subtitle / Scope", Value: config.reportSubtitle || "DICT Region V Monitoring & Telemetry" },
    { Section: "DOCUMENT CONTROL", Metric: "Generation Date", Value: dateStr },
    { Section: "DOCUMENT CONTROL", Metric: "Prepared By", Value: `${config.preparedBy || "DICT Technical Team"} (${config.designation || "Technical Operations Lead"})` },
    { Section: "DOCUMENT CONTROL", Metric: "Approved By", Value: `${config.approvedBy || "Regional Director"} (${config.approvedDesignation || "DICT Region V"})` },
    
    { Section: "FLEET OPERATIONAL HEALTH", Metric: "Total Monitored Sites", Value: totalSites },
    { Section: "FLEET OPERATIONAL HEALTH", Metric: "🟢 Online Sites", Value: `${onlineSites} (${totalSites > 0 ? Math.round((onlineSites / totalSites) * 100) : 0}%)` },
    { Section: "FLEET OPERATIONAL HEALTH", Metric: "🟡 Degraded Sites", Value: `${degradedSites} (${totalSites > 0 ? Math.round((degradedSites / totalSites) * 100) : 0}%)` },
    { Section: "FLEET OPERATIONAL HEALTH", Metric: "🔴 Offline Sites", Value: `${offlineSites} (${totalSites > 0 ? Math.round((offlineSites / totalSites) * 100) : 0}%)` },
    { Section: "FLEET OPERATIONAL HEALTH", Metric: "Fleet Availability & Health Index", Value: healthIndex },
    
    { Section: "CAPACITY & REACH METRICS", Metric: "Total Deployed Access Points (APs)", Value: totalAps },
    { Section: "CAPACITY & REACH METRICS", Metric: "Average AP Density per Site", Value: `${avgAps} APs/Site` },
    { Section: "CAPACITY & REACH METRICS", Metric: "Estimated Concurrent Citizen Capacity", Value: `~${estConcurrentReach.toLocaleString()} users` },
    { Section: "CAPACITY & REACH METRICS", Metric: "Estimated Daily Public Citizen Reach", Value: `~${estDailyReach.toLocaleString()} citizens/day` },
    
    { Section: "SECTORAL DISTRIBUTION", Metric: "🎓 Educational Facilities (Total)", Value: `${totalEducation} sites (${totalSites > 0 ? Math.round((totalEducation / totalSites) * 100) : 0}%)` },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Public Elementary Schools (PES)", Value: elemCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Public High Schools (PHS)", Value: hsCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Higher Education / Colleges (HEI-LUC)", Value: heiCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "🏛️ Local Governance & Field Offices", Value: `${totalGovernance} sites (${totalSites > 0 ? Math.round((totalGovernance / totalSites) * 100) : 0}%)` },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Municipal / City Halls (LGU-HALL)", Value: lguHallCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Provincial Capitols (PC)", Value: pcCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— DICT Regional / Field Offices (PFO)", Value: pfoCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "🌳 Public Plazas, Parks & Health Units", Value: `${otherCount} sites` },
    
    { Section: "BACKHAUL INFRASTRUCTURE", Metric: "Fiber Optic (FOC) Sites", Value: `${fiberCount} sites (${totalSites > 0 ? Math.round((fiberCount / totalSites) * 100) : 0}%)` },
    { Section: "BACKHAUL INFRASTRUCTURE", Metric: "Satellite (LEO / VSAT) Sites", Value: `${satelliteCount} sites (${totalSites > 0 ? Math.round((satelliteCount / totalSites) * 100) : 0}%)` },
    
    { Section: "FLEET CONTROLLERS", Metric: `${s1Name} Fleet`, Value: `${s1Sites.length} sites (${s1Sites.filter(s => getSiteOperationalStatus(s) === 'Online').length} Online, ${s1Sites.filter(s => getSiteOperationalStatus(s) === 'Offline').length} Offline)` },
    { Section: "FLEET CONTROLLERS", Metric: `${s2Name} Fleet`, Value: `${s2Sites.length} sites (${s2Sites.filter(s => getSiteOperationalStatus(s) === 'Online').length} Online, ${s2Sites.filter(s => getSiteOperationalStatus(s) === 'Offline').length} Offline)` },
    { Section: "GEOGRAPHIC COVERAGE", Metric: "Total Municipalities Covered", Value: new Set(sites.map((s) => s.municipality).filter(Boolean)).size },
  ];

  const wsKpi = XLSX.utils.json_to_sheet(kpiData);
  wsKpi["!cols"] = [{ wch: 30 }, { wch: 45 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "Executive KPIs & Health");

  // -------------------------------------------------------------
  // Sheet 3: Analytics & Chart Datasets
  // -------------------------------------------------------------
  const analyticsRows = [
    { Category: "Operational Status", Metric: "Online", Count: onlineSites, Percentage: `${totalSites > 0 ? Math.round((onlineSites / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => getSiteOperationalStatus(s) === "Online").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Operational Status", Metric: "Degraded", Count: degradedSites, Percentage: `${totalSites > 0 ? Math.round((degradedSites / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => getSiteOperationalStatus(s) === "Degraded").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Operational Status", Metric: "Offline", Count: offlineSites, Percentage: `${totalSites > 0 ? Math.round((offlineSites / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => getSiteOperationalStatus(s) === "Offline").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    
    { Category: "Supplier Fleet Comparison", Metric: s1Name, Count: s1Sites.length, Percentage: `${totalSites > 0 ? Math.round((s1Sites.length / totalSites) * 100) : 0}%`, TotalAPs: s1Sites.reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Supplier Fleet Comparison", Metric: s2Name, Count: s2Sites.length, Percentage: `${totalSites > 0 ? Math.round((s2Sites.length / totalSites) * 100) : 0}%`, TotalAPs: s2Sites.reduce((acc, s) => acc + (s.apCount || 0), 0) },
    
    { Category: "Sectoral Allocation", Metric: "Public Elementary Schools", Count: elemCount, Percentage: `${totalSites > 0 ? Math.round((elemCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => s.siteType === "PES").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Sectoral Allocation", Metric: "Public High Schools", Count: hsCount, Percentage: `${totalSites > 0 ? Math.round((hsCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => s.siteType === "PHS").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Sectoral Allocation", Metric: "Higher Education / Colleges", Count: heiCount, Percentage: `${totalSites > 0 ? Math.round((heiCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => s.siteType === "HEI-LUC").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Sectoral Allocation", Metric: "Local Government Units (LGU)", Count: lguHallCount, Percentage: `${totalSites > 0 ? Math.round((lguHallCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => s.siteType === "LGU-HALL").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Sectoral Allocation", Metric: "Provincial Capitols", Count: pcCount, Percentage: `${totalSites > 0 ? Math.round((pcCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => s.siteType === "PC").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Sectoral Allocation", Metric: "DICT Field Offices", Count: pfoCount, Percentage: `${totalSites > 0 ? Math.round((pfoCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => s.siteType === "PFO").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    
    { Category: "Backhaul Medium", Metric: "Fiber Optic (FOC)", Count: fiberCount, Percentage: `${totalSites > 0 ? Math.round((fiberCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => (s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC").reduce((acc, s) => acc + (s.apCount || 0), 0) },
    { Category: "Backhaul Medium", Metric: "Satellite (LEO)", Count: satelliteCount, Percentage: `${totalSites > 0 ? Math.round((satelliteCount / totalSites) * 100) : 0}%`, TotalAPs: sites.filter(s => (s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO").reduce((acc, s) => acc + (s.apCount || 0), 0) },
  ];

  const wsAnalytics = XLSX.utils.json_to_sheet(analyticsRows);
  wsAnalytics["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 12 }, { wch: 15 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsAnalytics, "Charts & Analytics Data");

  // -------------------------------------------------------------
  // Sheet 4: Municipal Density Breakdown
  // -------------------------------------------------------------
  const munMap = new Map<string, { totalSites: number; totalAps: number; online: number; offline: number; fiber: number; sat: number; schools: number; lgus: number }>();
  for (const s of sites) {
    const mun = s.municipality || "Unknown";
    const cur = munMap.get(mun) || { totalSites: 0, totalAps: 0, online: 0, offline: 0, fiber: 0, sat: 0, schools: 0, lgus: 0 };
    cur.totalSites += 1;
    cur.totalAps += s.apCount || 0;
    
    const op = getSiteOperationalStatus(s);
    if (op === "Online") cur.online += 1;
    else if (op === "Offline") cur.offline += 1;

    if ((s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC") cur.fiber += 1;
    if ((s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO") cur.sat += 1;
    if (s.siteType === "PES" || s.siteType === "PHS" || s.siteType === "HEI-LUC") cur.schools += 1;
    if (s.siteType === "LGU-HALL" || s.siteType === "PC" || s.siteType === "PFO") cur.lgus += 1;
    munMap.set(mun, cur);
  }

  const munRows = Array.from(munMap.entries())
    .sort((a, b) => b[1].totalSites - a[1].totalSites)
    .map(([mun, stat], i) => ({
      "No.": i + 1,
      "City / Municipality": mun,
      "Total Public Sites": stat.totalSites,
      "Total Access Points (APs)": stat.totalAps,
      "Online Sites": stat.online,
      "Offline Sites": stat.offline,
      "Availability Rate": `${stat.totalSites > 0 ? Math.round((stat.online / stat.totalSites) * 100) : 0}%`,
      "Fiber (FOC)": stat.fiber,
      "Satellite (LEO)": stat.sat,
      "Schools & Colleges": stat.schools,
      "LGU Halls & Capitols": stat.lgus,
    }));

  const wsMun = XLSX.utils.json_to_sheet(munRows);
  wsMun["!cols"] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 18 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMun, "Municipal Breakdown");

  // Save Excel file
  const filename = `DICT_FreeWiFi_Operational_Report_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function printFreeWifiReport(printHtml: string, title = "FREE WIFI 4 ALL  OPERATIONAL REPORT") {
  const printWindow = window.open("", "_blank", "width=1050,height=1300");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 6mm;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .page-break-inside-avoid {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .page-break-after {
              break-after: page;
              page-break-after: always;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #0f172a;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th, td {
            border: 1px solid #cbd5e1;
          }
        </style>
      </head>
      <body class="bg-white p-6 text-slate-900">
        ${printHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
