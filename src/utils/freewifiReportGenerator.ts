import * as XLSX from "xlsx";
import { FreeWifiSite, SITE_TYPE_CONFIG, getSiteTypeConfig } from "@/data/freewifiData";

export interface ReportConfig {
  reportTitle: string;
  preparedBy: string;
  designation: string;
  approvedBy: string;
  approvedDesignation: string;
  provinceFilter: string;
  municipalityFilter: string;
  supplierFilter: string;
  siteTypeFilter: string;
  linkTypeFilter: string;
  statusFilter: string;
  includeHardwareDetails: boolean;
  includeMunicipalMatrix: boolean;
  includeOmadaSummary: boolean;
  reportDate: string;
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
      "Omada Controller": sAny.omadaSupplier || "—",
      "Router Hardware Model": sAny.omadaRouterModel || "ER605",
      "AP Hardware Model": sAny.omadaApModels || "EAP225-Outdoor",
      "Public WAN IP": sAny.omadaPublicIp || "—",
      "Operational Status": s.status || "Operational",
      "Funding Initiative": s.fundSource || "DICT Phase 1",
      "Location Code": s.locationCode || "—",
      "Contact Person": s.contact || "—",
      "Last Omada API Sync": sAny.lastOmadaSync ? new Date(sAny.lastOmadaSync).toLocaleString() : "—",
    };
  });

  const wsSites = XLSX.utils.json_to_sheet(siteRows);
  // Auto column widths
  wsSites["!cols"] = [
    { wch: 6 },  // No
    { wch: 15 }, // Nationwide ID
    { wch: 40 }, // Location Name
    { wch: 20 }, // Municipality
    { wch: 20 }, // Barangay
    { wch: 12 }, // Province
    { wch: 30 }, // Facility Category
    { wch: 14 }, // Facility Code
    { wch: 20 }, // Backhaul
    { wch: 18 }, // APs
    { wch: 16 }, // Controller
    { wch: 22 }, // Router Model
    { wch: 22 }, // AP Model
    { wch: 18 }, // Public WAN IP
    { wch: 18 }, // Status
    { wch: 24 }, // Funding
    { wch: 18 }, // Location Code
    { wch: 22 }, // Contact
    { wch: 24 }, // Last Sync
  ];
  XLSX.utils.book_append_sheet(wb, wsSites, "Site Roster");

  // -------------------------------------------------------------
  // Sheet 2: Executive Summary & Network Analytics
  // -------------------------------------------------------------
  const totalSites = sites.length;
  const totalAps = sites.reduce((sum, s) => sum + (s.apCount || 0), 0);
  const fiberCount = sites.filter((s) => (s.linkType || "").toLowerCase().includes("fiber") || s.linkType === "FOC").length;
  const satelliteCount = sites.filter((s) => (s.linkType || "").toLowerCase().includes("satellite") || s.linkType === "LEO").length;
  const supplier1Count = sites.filter((s) => ((s as any).omadaSupplier || "").includes("1")).length;
  const supplier2Count = sites.filter((s) => ((s as any).omadaSupplier || "").includes("2")).length;
  
  const elemCount = sites.filter((s) => s.siteType === "PES").length;
  const hsCount = sites.filter((s) => s.siteType === "PHS").length;
  const heiCount = sites.filter((s) => s.siteType === "HEI-LUC").length;
  const totalEducation = elemCount + hsCount + heiCount;
  
  const lguHallCount = sites.filter((s) => s.siteType === "LGU-HALL").length;
  const pcCount = sites.filter((s) => s.siteType === "PC").length;
  const pfoCount = sites.filter((s) => s.siteType === "PFO").length;
  const totalGovernance = lguHallCount + pcCount + pfoCount;

  const otherCount = sites.length - (totalEducation + totalGovernance);
  const operationalCount = sites.filter((s) => (s.status || "").toLowerCase() === "operational" || !s.status).length;
  const healthIndex = totalSites > 0 ? `${Math.round((operationalCount / totalSites) * 100)}%` : "100%";
  const avgAps = totalSites > 0 ? (totalAps / totalSites).toFixed(2) : "0";
  const estConcurrentReach = totalAps * 45;
  const estDailyReach = sites.reduce((sum, s) => sum + (s.estimatedDailyUsers || (s.apCount || 2) * 120), 0);

  const kpiData = [
    { Section: "DOCUMENT DETAILS", Metric: "Report Title", Value: config.reportTitle || "FREE WIFI 4 ALL  OPERATIONAL REPORT" },
    { Section: "DOCUMENT DETAILS", Metric: "Generation Date", Value: dateStr },
    { Section: "DOCUMENT DETAILS", Metric: "Prepared By", Value: `${config.preparedBy || "DICT Monitoring Team"} (${config.designation || "Technical Lead"})` },
    { Section: "DOCUMENT DETAILS", Metric: "Approved By", Value: `${config.approvedBy || "Regional Director"} (${config.approvedDesignation || "DICT Region V"})` },
    { Section: "OPERATIONAL METRICS", Metric: "Total Operational Sites", Value: totalSites },
    { Section: "OPERATIONAL METRICS", Metric: "Total Deployed Access Points (APs)", Value: totalAps },
    { Section: "OPERATIONAL METRICS", Metric: "Network Operational Health Index", Value: healthIndex },
    { Section: "OPERATIONAL METRICS", Metric: "Average AP Density per Site", Value: `${avgAps} APs/Site` },
    { Section: "OPERATIONAL METRICS", Metric: "Estimated Concurrent Citizen Capacity", Value: `~${estConcurrentReach.toLocaleString()} users` },
    { Section: "OPERATIONAL METRICS", Metric: "Estimated Daily Public Reach", Value: `~${estDailyReach.toLocaleString()} citizens/day` },
    { Section: "SECTORAL DISTRIBUTION", Metric: "Education Facilities (Total)", Value: `${totalEducation} sites (${totalSites > 0 ? Math.round((totalEducation / totalSites) * 100) : 0}%)` },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Public Elementary Schools (PES)", Value: elemCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Public High Schools (PHS)", Value: hsCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Higher Education / Colleges (HEI-LUC)", Value: heiCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "Local Governance & Admin (Total)", Value: `${totalGovernance} sites (${totalSites > 0 ? Math.round((totalGovernance / totalSites) * 100) : 0}%)` },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— City / Municipal Halls (LGU-HALL)", Value: lguHallCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— Provincial Capitols (PC)", Value: pcCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "— DICT Regional / Field Offices (PFO)", Value: pfoCount },
    { Section: "SECTORAL DISTRIBUTION", Metric: "Public Plazas & Health Facilities", Value: `${otherCount} sites` },
    { Section: "BACKHAUL TECHNOLOGY", Metric: "Fiber Optic (FOC) Sites", Value: `${fiberCount} sites (${totalSites > 0 ? Math.round((fiberCount / totalSites) * 100) : 0}%)` },
    { Section: "BACKHAUL TECHNOLOGY", Metric: "Satellite (LEO) Sites", Value: `${satelliteCount} sites (${totalSites > 0 ? Math.round((satelliteCount / totalSites) * 100) : 0}%)` },
    { Section: "FLEET CONTROLLER", Metric: "Supplier 1 Omada Managed Sites", Value: supplier1Count },
    { Section: "FLEET CONTROLLER", Metric: "Supplier 2 Omada Managed Sites", Value: supplier2Count },
    { Section: "GEOGRAPHIC REACH", Metric: "Total Municipalities / Cities Covered", Value: new Set(sites.map((s) => s.municipality)).size },
  ];

  const wsKpi = XLSX.utils.json_to_sheet(kpiData);
  wsKpi["!cols"] = [{ wch: 26 }, { wch: 42 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "Executive Summary & Analytics");

  // -------------------------------------------------------------
  // Sheet 3: Municipal Density Breakdown
  // -------------------------------------------------------------
  const munMap = new Map<string, { totalSites: number; totalAps: number; fiber: number; sat: number; schools: number; lgus: number }>();
  for (const s of sites) {
    const mun = s.municipality || "Unknown";
    const cur = munMap.get(mun) || { totalSites: 0, totalAps: 0, fiber: 0, sat: 0, schools: 0, lgus: 0 };
    cur.totalSites += 1;
    cur.totalAps += s.apCount || 0;
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
    { wch: 16 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMun, "Municipal Breakdown");

  // Save Excel file
  const filename = `DICT_FreeWiFi_Report_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function printFreeWifiReport(printHtml: string, title = "FREE WIFI 4 ALL  OPERATIONAL REPORT") {
  const printWindow = window.open("", "_blank", "width=1000,height=1200");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 8mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
