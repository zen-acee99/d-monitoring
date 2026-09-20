import * as XLSX from "xlsx";
import { PROJECTS, Project } from "@/config/projects";

export interface UniversalReportConfig {
  reportTitle: string;
  reportSubtitle: string;
  preparedBy: string;
  designation: string;
  approvedBy: string;
  approvedDesignation: string;
  projectFilter: string;
  provinceFilter: string;
  statusFilter: string;
  reportDate: string;
}

export function exportUniversalReportToExcel(
  records: Record<string, any>[],
  config: Partial<UniversalReportConfig> = {}
) {
  const wb = XLSX.utils.book_new();
  const dateStr = config.reportDate || new Date().toISOString().split("T")[0];
  const projectMap = new Map<string, Project>(PROJECTS.map((p) => [p.id, p]));

  // -------------------------------------------------------------
  // Sheet 1: Master Deployment / Asset Telemetry Roster
  // -------------------------------------------------------------
  const rosterRows = records.map((r, idx) => {
    const projId = r.projectId || r.project_id || config.projectFilter || "freewifi";
    const projMeta = projectMap.get(projId);
    const siteName = r.siteName || r.locationName || r.lguName || r.applicantName || r.trainingTitle || r.systemName || r.incidentTitle || r.name || "—";
    const facilityType = r.siteType || r.facilityType || r.classification || r.certificateType || r.trainingTrack || r.category || r.linkType || "—";
    const province = r.province || "Albay";
    const municipality = r.municipality || r.city || r.location || "—";
    const barangay = r.barangay || "—";
    const status = r.status || "Operational";
    const primaryMetric = r.apCount ? `${r.apCount} APs` : r.bandwidth ? `${r.bandwidth} Mbps` : r.participantsCount ? `${r.participantsCount} Trainees` : r.monthlyTransactions ? `${r.monthlyTransactions} Txns` : "—";
    const focalPerson = r.dictFocal || r.contact || r.focalPerson || r.leadTrainer || "—";
    const fundSource = r.fundSource || r.fundingInitiative || r.budgetSource || "DICT Regional Fund";

    return {
      "No.": idx + 1,
      "Project / Initiative": projMeta ? projMeta.name : String(projId).toUpperCase(),
      "Program Code": projMeta ? projMeta.shortName : String(projId).toUpperCase(),
      "Site / Asset Name": siteName,
      "Facility / Category": facilityType,
      "Province": province,
      "City / Municipality": municipality,
      "Barangay": barangay,
      "Operational Status": status,
      "Primary Metric / Capacity": primaryMetric,
      "DICT Focal Person": focalPerson,
      "Funding Source": fundSource,
      "Last Telemetry Sync": r.updated_at || r.lastOmadaSync || r.createdAt || dateStr,
    };
  });

  const wsRoster = XLSX.utils.json_to_sheet(rosterRows);
  wsRoster["!cols"] = [
    { wch: 6 },  // No
    { wch: 36 }, // Project Name
    { wch: 16 }, // Program Code
    { wch: 38 }, // Site / Asset Name
    { wch: 28 }, // Facility / Category
    { wch: 18 }, // Province
    { wch: 22 }, // Municipality
    { wch: 20 }, // Barangay
    { wch: 18 }, // Status
    { wch: 24 }, // Primary Metric
    { wch: 24 }, // Focal Person
    { wch: 26 }, // Funding Source
    { wch: 24 }, // Last Sync
  ];
  XLSX.utils.book_append_sheet(wb, wsRoster, "Master Asset Roster");

  // -------------------------------------------------------------
  // Sheet 2: Executive Summary & Domain Analytics
  // -------------------------------------------------------------
  const totalRecords = records.length;
  const operationalCount = records.filter((r) =>
    ["operational", "active", "live", "completed", "deployed", "processed"].includes(
      String(r.status || "operational").toLowerCase()
    )
  ).length;
  const healthPct = totalRecords > 0 ? Math.round((operationalCount / totalRecords) * 100) : 100;
  const provincesCovered = new Set(records.map((r) => r.province).filter(Boolean)).size;
  const municipalitiesCovered = new Set(records.map((r) => r.municipality || r.city).filter(Boolean)).size;

  // Categorical aggregation
  const catMap = new Map<string, number>();
  for (const r of records) {
    const projId = r.projectId || r.project_id || config.projectFilter || "freewifi";
    const projMeta = projectMap.get(projId);
    const cat = projMeta?.category || "Infrastructure & Services";
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  }

  const kpiData = [
    { Section: "DOCUMENT DETAILS", Metric: "Report Title", Value: config.reportTitle || "DICT REGION V OPERATIONAL REPORT" },
    { Section: "DOCUMENT DETAILS", Metric: "Report Subtitle", Value: config.reportSubtitle || "Consolidated Regional Operations & Telemetry" },
    { Section: "DOCUMENT DETAILS", Metric: "Generation Date", Value: dateStr },
    { Section: "DOCUMENT DETAILS", Metric: "Prepared By", Value: `${config.preparedBy || "DICT Regional Monitoring Team"} (${config.designation || "Technical Operations Lead"})` },
    { Section: "DOCUMENT DETAILS", Metric: "Approved By", Value: `${config.approvedBy || "Regional Director"} (${config.approvedDesignation || "DICT Region V"})` },
    { Section: "OPERATIONAL HEALTH", Metric: "Total Monitored Deployments & Assets", Value: totalRecords },
    { Section: "OPERATIONAL HEALTH", Metric: "Active / Live Assets", Value: operationalCount },
    { Section: "OPERATIONAL HEALTH", Metric: "Regional Operational Health Index", Value: `${healthPct}%` },
    { Section: "GEOGRAPHIC COVERAGE", Metric: "Provinces Covered (Bicol Region)", Value: `${provincesCovered} of 6 Provinces` },
    { Section: "GEOGRAPHIC COVERAGE", Metric: "Total Municipalities & Cities Covered", Value: municipalitiesCovered },
  ];

  // Add category breakdown to sheet
  for (const [cat, count] of Array.from(catMap.entries())) {
    const pct = totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0;
    kpiData.push({
      Section: "SECTORAL & PROGRAM BREAKDOWN",
      Metric: `${cat} Portfolio`,
      Value: `${count} Deployments (${pct}%)`,
    });
  }

  const wsKpi = XLSX.utils.json_to_sheet(kpiData);
  wsKpi["!cols"] = [{ wch: 28 }, { wch: 44 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "Executive Summary & Analytics");

  // -------------------------------------------------------------
  // Sheet 3: Provincial Distribution Breakdown
  // -------------------------------------------------------------
  const BICOL_PROVINCES = [
    "Albay",
    "Camarines Sur",
    "Camarines Norte",
    "Catanduanes",
    "Masbate",
    "Sorsogon",
  ];

  const provMap = new Map<string, { total: number; operational: number; muniSet: Set<string> }>();
  for (const prov of BICOL_PROVINCES) {
    provMap.set(prov, { total: 0, operational: 0, muniSet: new Set() });
  }

  for (const r of records) {
    const prov = r.province || "Albay";
    const cur = provMap.get(prov) || { total: 0, operational: 0, muniSet: new Set() };
    cur.total += 1;
    if (["operational", "active", "live", "completed", "deployed", "processed"].includes(String(r.status || "operational").toLowerCase())) {
      cur.operational += 1;
    }
    if (r.municipality || r.city) cur.muniSet.add(r.municipality || r.city);
    provMap.set(prov, cur);
  }

  const provRows = BICOL_PROVINCES.map((prov, i) => {
    const stat = provMap.get(prov) || { total: 0, operational: 0, muniSet: new Set() };
    const provHealth = stat.total > 0 ? Math.round((stat.operational / stat.total) * 100) : 100;
    return {
      "No.": i + 1,
      "Province": prov,
      "Total Deployments / Records": stat.total,
      "Operational / Active": stat.operational,
      "Health Score (%)": `${provHealth}%`,
      "LGUs & Municipalities Covered": stat.muniSet.size,
    };
  });

  const wsProv = XLSX.utils.json_to_sheet(provRows);
  wsProv["!cols"] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsProv, "Provincial Matrix");

  // Save Excel file
  const safeTitle = (config.reportTitle || "DICT_Regional_Report").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${safeTitle}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function printUniversalReport(printHtml: string, title = "DICT REGION V OPERATIONAL REPORT") {
  const printWindow = window.open("", "_blank", "width=1050,height=1200");
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
