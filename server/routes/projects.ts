import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { isProjectTable, PROJECT_TABLES } from "../schema.js";

export const projectsRouter = Router();

// Helper to format table row into frontend record object
function formatRecord(row: any) {
  try {
    const parsed = JSON.parse(row.data);
    return {
      ...parsed,
      id: row.id,
      status: row.status || parsed.status,
      province: row.province || parsed.province,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch {
    return {
      id: row.id,
      status: row.status,
      province: row.province,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

// -------------------------------------------------------------
// 1. PROJECT METADATA ROUTES
// -------------------------------------------------------------

// GET /api/projects - list all projects metadata
projectsRouter.get("/projects", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute("SELECT * FROM projects ORDER BY name ASC");
    const projects = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      shortName: row.shortName,
      description: row.description,
      status: row.status,
      category: row.category,
      enabledAnalytics: row.enabledAnalytics ? JSON.parse(row.enabledAnalytics) : [],
      updated_at: row.updated_at,
    }));
    return res.json({ success: true, projects });
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/tables - list available project tables
projectsRouter.get("/projects/tables", async (_req: Request, res: Response) => {
  return res.json({ success: true, tables: PROJECT_TABLES });
});

// GET /api/projects/map-sites - all project sites with geographical locations
projectsRouter.get("/projects/map-sites", async (req: Request, res: Response) => {
  try {
    const filterMun = req.query.municipality ? String(req.query.municipality).toLowerCase().trim() : null;
    const sites: any[] = [];

    // 1. freewifi
    const fwRes = await db.execute('SELECT data, status, province FROM "freewifi"');
    for (const row of fwRes.rows) {
      const item = formatRecord(row);
      const mun = item.municipality || "Other";
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "freewifi",
          projectName: "Free Wi-Fi 4 All",
          siteName: item.locationName || item.siteName || "Free Wi-Fi Hotspot",
          type: item.siteTypeLabel || item.siteType || "Public Hotspot",
          municipality: item.municipality || "Legazpi City",
          province: item.province || "Albay",
          barangay: item.barangay || "",
          status: item.status || "Active",
          contact: item.contact,
          details: `${item.apCount || 1} APs • ${item.linkType || "Broadband"}`,
          bandwidth: item.bandwidth || item.averageBandwidthMbps || "30 Mbps",
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 2. govnet
    const gnRes = await db.execute('SELECT data, status, province FROM "govnet"');
    for (const row of gnRes.rows) {
      const item = formatRecord(row);
      const mun = item.municipality || "Legazpi City";
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "govnet",
          projectName: "GovNet Fiber Network",
          siteName: item.nodeName || "GovNet Backbone Hub",
          type: item.nodeType || "Backbone Node",
          municipality: mun,
          province: item.province || "Albay",
          barangay: item.barangay || "City Center",
          status: item.status || "Operational",
          details: `${item.portSpeed || "10 Gbps Core"} • Uptime: ${item.uptimePercent || 99.9}%`,
          bandwidth: item.portSpeed || "10 Gbps",
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 3. nbp
    const nbpRes = await db.execute('SELECT data, status, province FROM "nbp"');
    for (const row of nbpRes.rows) {
      const item = formatRecord(row);
      const pName = (item.popName || "").toLowerCase();
      let mun = item.municipality || "";
      if (!mun) {
        if (pName.includes("legazpi")) mun = "Legazpi City";
        else if (pName.includes("daet")) mun = "Daet";
        else if (pName.includes("naga")) mun = "Naga City";
        else if (pName.includes("sorsogon")) mun = "Sorsogon City";
        else if (pName.includes("virac")) mun = "Virac";
        else mun = item.province || "Regional Hub";
      }
      if (!filterMun || mun.toLowerCase().includes(filterMun) || pName.includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "nbp",
          projectName: "National Broadband Plan",
          siteName: item.popName || "NBP Point of Presence",
          type: item.infrastructureType || "Fiber Backbone (FOB)",
          municipality: mun,
          province: item.province || "Albay",
          barangay: "Regional Point of Presence",
          status: item.status || "Operational",
          details: `${item.capacityGbps || 100} Gbps Capacity • ${item.connectedAgenciesCount || 24} Agencies`,
          bandwidth: `${item.capacityGbps || 100} Gbps`,
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 4. elgu
    const elguRes = await db.execute('SELECT data, status, province FROM "elgu"');
    for (const row of elguRes.rows) {
      const item = formatRecord(row);
      const mun = item.name || item.lguName || "";
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "elgu",
          projectName: "eLGU Digital Governance",
          siteName: `LGU ${mun} (City/Municipal Hall)`,
          type: `eLGU System (${item.status || "Live"})`,
          municipality: mun,
          province: item.province,
          barangay: "Poblacion / Municipal Hall",
          status: item.status || "Live",
          details: `Version: ${item.version || "eLGU v2"} • ${item.registeredUsers || 0} Citizens Reached`,
          bandwidth: `${item.monthlyTransactions || 0} monthly txns`,
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 5. cybersecurity
    const cyberRes = await db.execute('SELECT data, status, province FROM "cybersecurity"');
    for (const row of cyberRes.rows) {
      const item = formatRecord(row);
      let mun = item.municipality || item.city || "";
      if (!mun && item.location) {
        if (item.location.toLowerCase().includes("legazpi")) mun = "Legazpi City";
        else if (item.location.toLowerCase().includes("naga")) mun = "Naga City";
        else if (item.location.toLowerCase().includes("virac")) mun = "Virac";
        else if (item.location.toLowerCase().includes("sorsogon")) mun = "Sorsogon City";
        else if (item.location.toLowerCase().includes("daet")) mun = "Daet";
        else if (item.location.toLowerCase().includes("ligao")) mun = "Ligao City";
        else if (item.location.toLowerCase().includes("tabaco")) mun = "Tabaco City";
        else if (item.location.toLowerCase().includes("malilipot")) mun = "Malilipot";
      }
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "cybersecurity",
          projectName: "Cybersecurity Bureau",
          siteName: item.title || item.incidentTitle || "Cyber Assessment/Awareness",
          type: item.activityType || item.threatCategory || "Awareness & Operations",
          municipality: mun || "Legazpi City",
          province: item.province || "Albay",
          barangay: item.location || item.barangay || "",
          status: item.status || "Active",
          details: `${item.location || item.affectedEntity || "DICT"} • ${item.totalParticipants || 0} Participants`,
          bandwidth: item.mode || "Field Operation",
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 6. gecs
    const gecsRes = await db.execute('SELECT data, status, province FROM "gecs"');
    for (const row of gecsRes.rows) {
      const item = formatRecord(row);
      let mun = item.location || "";
      if (mun.toLowerCase().includes("rawis") || mun.toLowerCase().includes("legazpi")) {
        mun = "Legazpi City";
      } else if (mun.toLowerCase().includes("virac")) {
        mun = "Virac";
      } else if (mun.toLowerCase().includes("masbate")) {
        mun = "Masbate City";
      } else if (mun.toLowerCase().includes("pili") || mun.toLowerCase().includes("camarines sur")) {
        mun = "Pili";
      }
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "gecs",
          projectName: "GECS Emergency Comms",
          siteName: item.hubName || "Emergency Comms Hub",
          type: item.equipmentType || "Disaster Node",
          municipality: mun,
          province: item.province || "Albay",
          barangay: item.location || "Operations Center",
          status: item.status || "Operational",
          details: `Freq: ${item.frequencyBand || "VHF/UHF"} • Readiness: ${item.readinessScore || 90}%`,
          bandwidth: "RF Repeater",
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 7. ilcdb
    const ilcRes = await db.execute('SELECT data, status, province FROM "ilcdb"');
    for (const row of ilcRes.rows) {
      const item = formatRecord(row);
      const prov = item.province || "Albay";
      let mun = prov === "Albay" ? "Legazpi City" : prov === "Camarines Sur" ? "Naga City" : prov === "Sorsogon" ? "Sorsogon City" : prov === "Catanduanes" ? "Virac" : prov === "Camarines Norte" ? "Daet" : "Masbate City";
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: item.id,
          projectId: "ilcdb",
          projectName: "ILCDB Skills Development",
          siteName: item.courseTitle || item.activity || "ICT Capacity Building",
          type: item.track || "Digital Upskilling",
          municipality: mun,
          province: prov,
          barangay: item.division ? `Division: ${item.division}` : "Provincial Center",
          status: item.status || "Ongoing",
          details: `${item.enrolledCount || 0}/${item.targetQuota || 50} Trainees • Modality: ${item.modality || "Classroom"}`,
          bandwidth: item.saroNo ? `SARO: ${item.saroNo}` : "Skills Training",
          latitude: item.latitude ? Number(item.latitude) : null,
          longitude: item.longitude ? Number(item.longitude) : null,
        });
      }
    }

    // 8. pnpki
    const pnpkiRes = await db.execute('SELECT data, status, province FROM "pnpki"');
    const pnpkiByProv: Record<string, any[]> = {};
    for (const row of pnpkiRes.rows) {
      const item = formatRecord(row);
      const prov = item.province || "Albay";
      pnpkiByProv[prov] = pnpkiByProv[prov] || [];
      pnpkiByProv[prov].push(item);
    }
    for (const [prov, certs] of Object.entries(pnpkiByProv)) {
      const mun = prov === "Albay" ? "Legazpi City" : prov === "Camarines Norte" ? "Daet" : prov === "Camarines Sur" ? "Naga City" : prov === "Catanduanes" ? "Virac" : prov === "Sorsogon" ? "Sorsogon City" : "Masbate City";
      if (!filterMun || mun.toLowerCase().includes(filterMun)) {
        sites.push({
          id: `pnpki-ra-${prov.toLowerCase().replace(/\s+/g, '-')}`,
          projectId: "pnpki",
          projectName: "PNPKI Digital Signatures",
          siteName: `DICT ${prov} PNPKI Registration Authority Office`,
          type: "Registration Authority (RA) Hub",
          municipality: mun,
          province: prov,
          barangay: "DICT Provincial Field Office",
          status: "Active",
          details: `${certs.length} Active Certificates Issued • Registration Center`,
          bandwidth: "Encrypted PKI Infrastructure",
          latitude: null,
          longitude: null,
        });
      }
    }

    return res.json({
      success: true,
      total: sites.length,
      sites,
    });
  } catch (err: any) {
    console.error("Error fetching map sites:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/overview/stats - live operational statistics across all projects
projectsRouter.get("/overview/stats", async (_req: Request, res: Response) => {
  try {
    let totalRecords = 0;
    let totalOperational = 0;
    const projectStats: Record<string, any> = {};

    let elguUsers = 0;
    let elguTxn = 0;
    let fwDailyUsers = 0;
    let egovTxn = 0;
    let cyberPart = 0;
    let ilcdbEnrolled = 0;
    let iidbBeneficiaries = 0;

    const provMap: Record<string, number> = {
      Albay: 0,
      "Camarines Sur": 0,
      "Camarines Norte": 0,
      Catanduanes: 0,
      Masbate: 0,
      Sorsogon: 0,
    };

    for (const tbl of PROJECT_TABLES) {
      try {
        const result = await db.execute(`SELECT data, status, province FROM "${tbl}"`);
        let count = 0;
        let op = 0;
        const breakdown: Record<string, number> = {};

        for (const row of result.rows) {
          count++;
          const st = String(row.status || "Unknown");
          breakdown[st] = (breakdown[st] || 0) + 1;
          const lower = st.toLowerCase();
          if (
            lower === "operational" ||
            lower === "active" ||
            lower === "live" ||
            lower === "completed" ||
            lower === "deployed" ||
            lower === "monitoring" ||
            lower === "ongoing"
          ) {
            op++;
          }

          // Parse data object for exact column aggregates
          let item: any = {};
          if (row.data) {
            try {
              item = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
            } catch {}
          }

          const prov = row.province || item.province;
          if (prov && provMap[prov] !== undefined) {
            provMap[prov]++;
          }

          if (tbl === "elgu") {
            elguUsers += Number(item.registeredUsers) || Number(item.beneficiaries) || Number(item.citizens) || 0;
            elguTxn += Number(item.monthlyTransactions) || Number(item.transactions) || 0;
          } else if (tbl === "freewifi") {
            fwDailyUsers += Number(item.estimatedDailyUsers) || Number(item.dailyUsers) || Number(item.activeUsers) || 0;
          } else if (tbl === "egovph") {
            egovTxn += Number(item.monthlyTxn) || Number(item.transactions) || 0;
          } else if (tbl === "cybersecurity") {
            cyberPart += Number(item.totalParticipants) || Number(item.participants) || Number(item.attendees) || 0;
          } else if (tbl === "ilcdb") {
            ilcdbEnrolled += Number(item.enrolledCount) || Number(item.graduates) || Number(item.trainees) || 0;
          } else if (tbl === "iidb") {
            iidbBeneficiaries += Number(item.targetBeneficiaries) || Number(item.beneficiaries) || 0;
          }
        }

        totalRecords += count;
        totalOperational += op;

        const healthPct = count > 0 ? Math.round((op / count) * 100) : 0;
        let status: "operational" | "warning" | "critical" | "inactive" = "operational";
        if (count === 0) status = "inactive";
        else if (healthPct < 50) status = "critical";
        else if (healthPct < 85) status = "warning";

        // Generate tailored, precise primary metric and sub-metric for this project
        let primaryMetric = `${op}/${count}`;
        let subMetric = `${healthPct}% operational`;

        switch (tbl) {
          case "freewifi":
            primaryMetric = `${op} Sites`;
            subMetric = `${healthPct}% Active APs`;
            break;
          case "elgu":
            primaryMetric = `${op} Live LGUs`;
            subMetric = `${count} Municipalities`;
            break;
          case "pnpki":
            primaryMetric = `${op} Issued`;
            subMetric = `100% Validated`;
            break;
          case "cybersecurity":
            primaryMetric = `${op} Feeds`;
            subMetric = `Active Defense`;
            break;
          case "ilcdb":
            const ongoing = breakdown["Ongoing"] || 0;
            const completed = breakdown["Completed"] || 0;
            primaryMetric = `${count} Batches`;
            subMetric = `${ongoing} Ongoing • ${completed} Done`;
            break;
          case "govnet":
            primaryMetric = `${op} Nodes`;
            subMetric = `100% Agency Fiber`;
            break;
          case "nbp":
            primaryMetric = `${op} PoPs`;
            subMetric = `${breakdown["Under Expansion"] || 0} In Expansion`;
            break;
          case "gecs":
            primaryMetric = `${op} Terminals`;
            subMetric = `${breakdown["Standby"] || 0} Standby Ready`;
            break;
          case "egovph":
            primaryMetric = `${op} Modules`;
            subMetric = `SuperApp Active`;
            break;
          case "miss":
            primaryMetric = `${op} Deployed`;
            subMetric = `${breakdown["For Testing"] || 0} Under Testing`;
            break;
          case "iidb":
            primaryMetric = `${op} Active`;
            subMetric = `${count} Programs`;
            break;
        }

        projectStats[tbl] = {
          total: count,
          operational: op,
          healthPct,
          status,
          primaryMetric,
          subMetric,
          breakdown,
        };
      } catch (err: any) {
        projectStats[tbl] = {
          total: 0,
          operational: 0,
          healthPct: 0,
          status: "inactive",
          primaryMetric: "0 Units",
          subMetric: "Offline",
          breakdown: {},
        };
      }
    }

    const regionalSLA = totalRecords > 0 ? (totalOperational / totalRecords) * 100 : 0;

    // Service distribution categories calculated directly from real records
    const distribution = [
      {
        name: "Security & Trust",
        short: "PNPKI / Cyber",
        count: (projectStats.cybersecurity?.total || 0) + (projectStats.pnpki?.total || 0),
        pct: totalRecords > 0 ? Math.round((((projectStats.cybersecurity?.total || 0) + (projectStats.pnpki?.total || 0)) / totalRecords) * 100) : 0,
        color: "#10B981",
        desc: "Cybersecurity & PNPKI",
      },
      {
        name: "Digital Governance",
        short: "eLGU / eGov",
        count: (projectStats.elgu?.total || 0) + (projectStats.egovph?.total || 0),
        pct: totalRecords > 0 ? Math.round((((projectStats.elgu?.total || 0) + (projectStats.egovph?.total || 0)) / totalRecords) * 100) : 0,
        color: "#6366F1",
        desc: "eLGU & eGov PH",
      },
      {
        name: "Public Connectivity",
        short: "Free Wi-Fi",
        count: projectStats.freewifi?.total || 0,
        pct: totalRecords > 0 ? Math.round(((projectStats.freewifi?.total || 0) / totalRecords) * 100) : 0,
        color: "#06B6D4",
        desc: "Free Wi-Fi for All",
      },
      {
        name: "Capacity & Industry",
        short: "ILCDB / IIDB",
        count: (projectStats.ilcdb?.total || 0) + (projectStats.iidb?.total || 0),
        pct: totalRecords > 0 ? Math.round((((projectStats.ilcdb?.total || 0) + (projectStats.iidb?.total || 0)) / totalRecords) * 100) : 0,
        color: "#F59E0B",
        desc: "Training & Startups",
      },
      {
        name: "Network Infrastructure",
        short: "GovNet / NBP / Sat",
        count: (projectStats.govnet?.total || 0) + (projectStats.nbp?.total || 0) + (projectStats.gecs?.total || 0) + (projectStats.miss?.total || 0),
        pct: totalRecords > 0 ? Math.round((((projectStats.govnet?.total || 0) + (projectStats.nbp?.total || 0) + (projectStats.gecs?.total || 0) + (projectStats.miss?.total || 0)) / totalRecords) * 100) : 0,
        color: "#3B82F6",
        desc: "GovNet, NBP, GECS, MISS",
      },
    ];

    // Field operations metrics
    const liveSites = (projectStats.freewifi?.operational || 0) + (projectStats.govnet?.operational || 0) + (projectStats.nbp?.operational || 0) + (projectStats.gecs?.operational || 0) + (projectStats.miss?.operational || 0);
    const trainings = projectStats.ilcdb?.total || 0;
    const itAssist = (projectStats.cybersecurity?.total || 0) + (projectStats.miss?.total || 0) + (projectStats.gecs?.total || 0);

    const pnpkiCount = projectStats.pnpki?.operational || 0;
    const totalBeneficiaries = elguUsers + fwDailyUsers + cyberPart + ilcdbEnrolled + iidbBeneficiaries + pnpkiCount;
    const totalTransactions = elguTxn + egovTxn;

    const projectDeployments = [
      { name: "Free Wi-Fi for All Sites", shortName: "Free WiFi", count: projectStats.freewifi?.total || 0, operational: projectStats.freewifi?.operational || 0, category: "Connectivity", color: "#06B6D4" },
      { name: "eLGU Digital Governance", shortName: "eLGU", count: projectStats.elgu?.total || 0, operational: projectStats.elgu?.operational || 0, category: "Governance", color: "#6366F1" },
      { name: "Cybersecurity CERT Ops", shortName: "Cybersec", count: projectStats.cybersecurity?.total || 0, operational: projectStats.cybersecurity?.operational || 0, category: "Security", color: "#EF4444" },
      { name: "PNPKI Digital Certificates", shortName: "PNPKI", count: projectStats.pnpki?.total || 0, operational: projectStats.pnpki?.operational || 0, category: "Security", color: "#10B981" },
      { name: "ILCDB Training Batches", shortName: "ILCDB", count: projectStats.ilcdb?.total || 0, operational: projectStats.ilcdb?.operational || 0, category: "Capacity", color: "#F59E0B" },
      { name: "Network & Core Systems", shortName: "Infra/MIS", count: (projectStats.govnet?.total || 0) + (projectStats.nbp?.total || 0) + (projectStats.gecs?.total || 0) + (projectStats.miss?.total || 0) + (projectStats.iidb?.total || 0) + (projectStats.egovph?.total || 0), operational: (projectStats.govnet?.operational || 0) + (projectStats.nbp?.operational || 0) + (projectStats.gecs?.operational || 0) + (projectStats.miss?.operational || 0), category: "Infrastructure", color: "#8B5CF6" },
    ];

    const provincialDeployments = [
      { name: "Province of Albay", shortName: "Albay", count: provMap["Albay"] || 0, color: "#3B82F6" },
      { name: "Province of Camarines Sur", shortName: "Cam Sur", count: provMap["Camarines Sur"] || 0, color: "#6366F1" },
      { name: "Province of Sorsogon", shortName: "Sorsogon", count: provMap["Sorsogon"] || 0, color: "#10B981" },
      { name: "Province of Catanduanes", shortName: "Catanduanes", count: provMap["Catanduanes"] || 0, color: "#06B6D4" },
      { name: "Province of Camarines Norte", shortName: "Cam Norte", count: provMap["Camarines Norte"] || 0, color: "#F59E0B" },
      { name: "Province of Masbate", shortName: "Masbate", count: provMap["Masbate"] || 0, color: "#EC4899" },
    ];

    return res.json({
      success: true,
      stats: {
        totalRecords,
        totalOperational,
        regionalSLA: Math.round(regionalSLA * 10) / 10,
        liveSites,
        trainings,
        itAssist,
        projectStats,
        distribution,
        projectDeployments,
        provincialDeployments,
        beneficiaries: {
          total: totalBeneficiaries,
          breakdown: [
            { name: "eLGU Registered Citizens", shortName: "eLGU", users: elguUsers, category: "Governance", color: "#6366F1" },
            { name: "Free Wi-Fi Daily Users", shortName: "Free WiFi", users: fwDailyUsers, category: "Connectivity", color: "#06B6D4" },
            { name: "Cybersecurity Participants", shortName: "Cybersec", users: cyberPart, category: "Security", color: "#EF4444" },
            { name: "ILCDB Enrolled Trainees", shortName: "ILCDB", users: ilcdbEnrolled, category: "Capacity", color: "#F59E0B" },
            { name: "IIDB Startup Beneficiaries", shortName: "IIDB", users: iidbBeneficiaries, category: "Industry", color: "#8B5CF6" },
            { name: "PNPKI Digital Signatures", shortName: "PNPKI", users: pnpkiCount, category: "Security", color: "#10B981" },
          ],
        },
        transactions: {
          total: totalTransactions,
          breakdown: [
            { name: "eLGU Online Permits & Tax", val: elguTxn, color: "text-indigo-400" },
            { name: "eGov PH Verification API", val: egovTxn, color: "text-purple-400" },
            { name: "Free Wi-Fi Daily Active Users", val: fwDailyUsers, color: "text-cyan-400" },
            { name: "Cybersecurity Activity Attendance", val: cyberPart, color: "text-red-400" },
            { name: "ILCDB ICT Batch Enrollees", val: ilcdbEnrolled, color: "text-amber-400" },
            { name: "PNPKI Validated Signatures", val: pnpkiCount, color: "text-emerald-400" },
          ],
        },
      },
    });
  } catch (error: any) {
    console.error("Error computing overview stats:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:id - get single project metadata
projectsRouter.get("/projects/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const row: any = result.rows[0];
    const project = {
      id: row.id,
      name: row.name,
      shortName: row.shortName,
      description: row.description,
      status: row.status,
      category: row.category,
      enabledAnalytics: row.enabledAnalytics ? JSON.parse(row.enabledAnalytics) : [],
      updated_at: row.updated_at,
    };
    return res.json({ success: true, project });
  } catch (error: any) {
    console.error("Error fetching project:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/projects/:id - update project metadata
projectsRouter.put("/projects/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, shortName, description, status, category, enabledAnalytics } = req.body;

    const existing = await db.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const current: any = existing.rows[0];
    const updatedName = name ?? current.name;
    const updatedShortName = shortName ?? current.shortName;
    const updatedDescription = description ?? current.description;
    const updatedStatus = status ?? current.status;
    const updatedCategory = category ?? current.category;
    const updatedAnalytics = enabledAnalytics !== undefined
      ? JSON.stringify(enabledAnalytics)
      : current.enabledAnalytics;

    await db.execute({
      sql: `UPDATE projects 
            SET name = ?, shortName = ?, description = ?, status = ?, category = ?, enabledAnalytics = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [updatedName, updatedShortName, updatedDescription, updatedStatus, updatedCategory, updatedAnalytics, id],
    });

    return res.json({
      success: true,
      project: {
        id,
        name: updatedName,
        shortName: updatedShortName,
        description: updatedDescription,
        status: updatedStatus,
        category: updatedCategory,
        enabledAnalytics: JSON.parse(updatedAnalytics || "[]"),
      },
    });
  } catch (error: any) {
    console.error("Error updating project:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// -------------------------------------------------------------
// 2. PROJECT TABLE DATA CRUD HANDLERS
// -------------------------------------------------------------

// Handler for fetching records from project table
export async function handleGetProjectRecords(req: Request, res: Response) {
  try {
    const table = req.params.table || req.params.project;
    if (!isProjectTable(table)) {
      return res.status(400).json({ success: false, error: `Invalid project table: "${table}"` });
    }

    const { status, province, search } = req.query;

    let sql = `SELECT * FROM "${table}"`;
    const whereClauses: string[] = [];
    const args: any[] = [];

    if (status && status !== "ALL") {
      whereClauses.push("status = ?");
      args.push(String(status));
    }
    if (province && province !== "ALL") {
      whereClauses.push("province = ?");
      args.push(String(province));
    }

    if (whereClauses.length > 0) {
      sql += " WHERE " + whereClauses.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });
    let records = result.rows.map(formatRecord);

    // If text search query is provided, filter records in memory across all fields
    if (search && typeof search === "string" && search.trim() !== "") {
      const q = search.toLowerCase();
      records = records.filter((r) =>
        Object.values(r).some((val) =>
          String(val).toLowerCase().includes(q)
        )
      );
    }

    return res.json({
      success: true,
      table,
      count: records.length,
      records,
    });
  } catch (error: any) {
    console.error("Error getting project records:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Handler for single record lookup
export async function handleGetSingleRecord(req: Request, res: Response) {
  try {
    const table = req.params.table || req.params.project;
    const { id } = req.params;

    if (!isProjectTable(table)) {
      return res.status(400).json({ success: false, error: `Invalid project table: "${table}"` });
    }

    const result = await db.execute({
      sql: `SELECT * FROM "${table}" WHERE id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    return res.json({ success: true, record: formatRecord(result.rows[0]) });
  } catch (error: any) {
    console.error("Error fetching single record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Handler for inserting a new record into project table
export async function handleCreateProjectRecord(req: Request, res: Response) {
  try {
    const table = req.params.table || req.params.project;
    if (!isProjectTable(table)) {
      return res.status(400).json({ success: false, error: `Invalid project table: "${table}"` });
    }

    const payload = req.body || {};
    const id =
      payload.id ||
      `${table}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const status = payload.status || null;
    const province = payload.province || null;

    const fullRecord = {
      ...payload,
      id,
      status: status || payload.status,
      province: province || payload.province,
    };

    await db.execute({
      sql: `INSERT INTO "${table}" (id, data, status, province, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [id, JSON.stringify(fullRecord), status, province],
    });

    return res.status(201).json({ success: true, record: fullRecord });
  } catch (error: any) {
    console.error("Error creating project record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Handler for updating a record in project table
export async function handleUpdateProjectRecord(req: Request, res: Response) {
  try {
    const table = req.params.table || req.params.project;
    const { id } = req.params;

    if (!isProjectTable(table)) {
      return res.status(400).json({ success: false, error: `Invalid project table: "${table}"` });
    }

    const existing = await db.execute({
      sql: `SELECT * FROM "${table}" WHERE id = ?`,
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    const currentFormatted = formatRecord(existing.rows[0]);
    const merged = { ...currentFormatted, ...req.body, id };
    const status = merged.status || null;
    const province = merged.province || null;

    await db.execute({
      sql: `UPDATE "${table}"
            SET data = ?, status = ?, province = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [JSON.stringify(merged), status, province, id],
    });

    return res.json({ success: true, record: merged });
  } catch (error: any) {
    console.error("Error updating project record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Handler for deleting a record from project table
export async function handleDeleteProjectRecord(req: Request, res: Response) {
  try {
    const table = req.params.table || req.params.project;
    const { id } = req.params;

    if (!isProjectTable(table)) {
      return res.status(400).json({ success: false, error: `Invalid project table: "${table}"` });
    }

    const result = await db.execute({
      sql: `DELETE FROM "${table}" WHERE id = ?`,
      args: [id],
    });

    return res.json({ success: true, id, rowsAffected: result.rowsAffected });
  } catch (error: any) {
    console.error("Error deleting project record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Handler for bulk importing records into project table
export async function handleBulkImportProjectRecords(req: Request, res: Response) {
  try {
    const table = req.params.table || req.params.project;
    if (!isProjectTable(table)) {
      return res.status(400).json({ success: false, error: `Invalid project table: "${table}"` });
    }

    const { records, replaceAll } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: "records must be an array" });
    }

    if (replaceAll) {
      await db.execute(`DELETE FROM "${table}"`);
    }

    for (const r of records) {
      const id = r.id || `${table}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const status = r.status || null;
      const province = r.province || null;
      const data = JSON.stringify({ ...r, id });

      await db.execute({
        sql: `INSERT OR REPLACE INTO "${table}" (id, data, status, province, created_at, updated_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [id, data, status, province],
      });
    }

    return res.json({ success: true, importedCount: records.length, table });
  } catch (error: any) {
    console.error("Error bulk importing records:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// Route binding for `/api/projects/:project/records`
projectsRouter.get("/projects/:project/records", handleGetProjectRecords);
projectsRouter.post("/projects/:project/records", handleCreateProjectRecord);
projectsRouter.get("/projects/:project/records/:id", handleGetSingleRecord);
projectsRouter.put("/projects/:project/records/:id", handleUpdateProjectRecord);
projectsRouter.delete("/projects/:project/records/:id", handleDeleteProjectRecord);
projectsRouter.post("/projects/:project/bulk", handleBulkImportProjectRecords);

// Route binding directly for table names: `/api/:table`
// Example: GET /api/freewifi, POST /api/elgu, DELETE /api/pnpki/:id
projectsRouter.get("/:table", handleGetProjectRecords);
projectsRouter.post("/:table", handleCreateProjectRecord);
projectsRouter.get("/:table/:id", handleGetSingleRecord);
projectsRouter.put("/:table/:id", handleUpdateProjectRecord);
projectsRouter.delete("/:table/:id", handleDeleteProjectRecord);
projectsRouter.post("/:table/bulk", handleBulkImportProjectRecords);
