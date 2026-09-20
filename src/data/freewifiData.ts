export type SiteType = "LGU-HALL" | "PC" | "PFO" | "PES" | "PHS" | "HEI-LUC";
export type LinkType = "FOC" | "LEO";
export type FundSource = "PICS-MUN" | "CA";

export interface FreeWifiSite {
  id: string;
  siteType: SiteType;
  siteTypeLabel: string;
  locationName: string;
  fundSource: FundSource;
  projectName: string;
  contact: string;
  linkType: LinkType;
  apCount: number;
  locationCode: string;
  barangay: string;
  municipality: string;
  province: string;
  nationwideId: number;
  remarks?: number | string | null;
  status: "Operational" | "Maintenance" | "Standby";
  estimatedDailyUsers: number;
  averageBandwidthMbps: number;
}

export const SITE_TYPE_CONFIG: Record<SiteType, { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string; textColor: string; icon: string }> = {
  "LGU-HALL": {
    label: "City / Municipal Hall",
    shortLabel: "LGU Hall",
    color: "#3B82F6", // Blue
    bgColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.35)",
    textColor: "#60A5FA",
    icon: "Building2",
  },
  "PC": {
    label: "Provincial Capitol",
    shortLabel: "Prov. Capitol",
    color: "#8B5CF6", // Purple
    bgColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.35)",
    textColor: "#A78BFA",
    icon: "Landmark",
  },
  "PFO": {
    label: "DICT Regional / Field Office",
    shortLabel: "DICT Office",
    color: "#10B981", // Emerald
    bgColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.35)",
    textColor: "#34D399",
    icon: "ShieldCheck",
  },
  "PES": {
    label: "Public Elementary School",
    shortLabel: "Elem. School",
    color: "#F59E0B", // Amber
    bgColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    textColor: "#FBBF24",
    icon: "GraduationCap",
  },
  "PHS": {
    label: "Public High School",
    shortLabel: "High School",
    color: "#EC4899", // Pink
    bgColor: "rgba(236, 72, 153, 0.15)",
    borderColor: "rgba(236, 72, 153, 0.35)",
    textColor: "#F472B6",
    icon: "BookOpen",
  },
  "HEI-LUC": {
    label: "Higher Education / Community College",
    shortLabel: "College / HEI",
    color: "#06B6D4", // Cyan
    bgColor: "rgba(6, 182, 212, 0.15)",
    borderColor: "rgba(6, 182, 212, 0.35)",
    textColor: "#22D3EE",
    icon: "School",
  },
};

export const LINK_TYPE_CONFIG: Record<string, { label: string; desc: string; color: string; badgeBg: string; badgeBorder: string; badgeText: string }> = {
  "FOC": {
    label: "Fiber Optic Cable (FOC)",
    desc: "Direct terrestrial fiber optic drop providing gigabit backhaul capacity.",
    color: "#10B981",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeBorder: "rgba(16, 185, 129, 0.35)",
    badgeText: "#34D399",
  },
  "Fiber Optic": {
    label: "Fiber Optic Cable (FOC)",
    desc: "Direct terrestrial fiber optic drop providing gigabit backhaul capacity.",
    color: "#10B981",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeBorder: "rgba(16, 185, 129, 0.35)",
    badgeText: "#34D399",
  },
  "LEO": {
    label: "Low Earth Orbit Satellite (LEO)",
    desc: "High-speed low-latency satellite dish connectivity (Starlink / LEO constellation).",
    color: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.15)",
    badgeBorder: "rgba(56, 189, 248, 0.35)",
    badgeText: "#7DD3FC",
  },
  "VSAT Satellite": {
    label: "Satellite Connection (VSAT / LEO)",
    desc: "High-speed satellite connectivity for public schools and rural facilities.",
    color: "#38BDF8",
    badgeBg: "rgba(56, 189, 248, 0.15)",
    badgeBorder: "rgba(56, 189, 248, 0.35)",
    badgeText: "#7DD3FC",
  },
};

export function getSiteTypeConfig(type?: string) {
  if (!type) return SITE_TYPE_CONFIG["LGU-HALL"];
  if ((SITE_TYPE_CONFIG as any)[type]) return (SITE_TYPE_CONFIG as any)[type];

  const t = type.toLowerCase();
  if (t.includes("college") || t.includes("hei") || t.includes("university") || t.includes("higher education")) {
    return SITE_TYPE_CONFIG["HEI-LUC"];
  }
  if (t.includes("high school") || t.includes("phs")) {
    return SITE_TYPE_CONFIG["PHS"];
  }
  if (t.includes("elementary") || t.includes("pes") || t.includes("school")) {
    return SITE_TYPE_CONFIG["PES"];
  }
  if (t.includes("provincial") || t.includes("capitol") || t.includes("pc")) {
    return SITE_TYPE_CONFIG["PC"];
  }
  if (t.includes("field office") || t.includes("regional office") || t.includes("dict") || t.includes("pfo")) {
    return SITE_TYPE_CONFIG["PFO"];
  }
  return SITE_TYPE_CONFIG["LGU-HALL"];
}

export function getLinkTypeConfig(link?: string) {
  if (!link) return LINK_TYPE_CONFIG["FOC"];
  if ((LINK_TYPE_CONFIG as any)[link]) return (LINK_TYPE_CONFIG as any)[link];

  const l = link.toLowerCase();
  if (l.includes("sat") || l.includes("leo") || l.includes("vsat") || l.includes("dish") || l.includes("starlink")) {
    return LINK_TYPE_CONFIG["VSAT Satellite"];
  }
  return LINK_TYPE_CONFIG["Fiber Optic"];
}

/**
 * Raw data provided by user with test entries removed and formatted cleanly.
 */
export const FREE_WIFI_SITES: FreeWifiSite[] = [];

export interface FreeWifiAnalyticsSummary {
  totalSites: number;
  totalAccessPoints: number;
  totalMunicipalities: number;
  totalDailyUsers: number;
  focSitesCount: number;
  leoSitesCount: number;
  picsMunCount: number;
  pfiapsCount: number;
}

export function getFreeWifiSummary(sites: FreeWifiSite[] = FREE_WIFI_SITES): FreeWifiAnalyticsSummary {
  const totalSites = sites.length;
  const totalAccessPoints = sites.reduce((sum, s) => sum + (Number(s.apCount) || 0), 0);
  const municipalities = new Set(sites.map((s) => s.municipality).filter(Boolean));
  const totalMunicipalities = municipalities.size;
  const totalDailyUsers = sites.reduce((sum, s) => sum + (Number(s.estimatedDailyUsers) || 0), 0);
  const focSitesCount = sites.filter((s) => {
    const l = (s.linkType || "").toLowerCase();
    return l.includes("fiber") || l === "foc";
  }).length;
  const leoSitesCount = sites.filter((s) => {
    const l = (s.linkType || "").toLowerCase();
    return l.includes("sat") || l.includes("leo") || l.includes("vsat");
  }).length;
  const picsMunCount = sites.filter((s) => {
    const f = (s.fundSource || "").toLowerCase();
    return f.includes("pics") || f.includes("lgu");
  }).length;
  const pfiapsCount = sites.filter((s) => {
    const f = (s.fundSource || "").toLowerCase();
    return f.includes("ca") || f.includes("centrally") || f.includes("pfiaps");
  }).length;

  return {
    totalSites,
    totalAccessPoints,
    totalMunicipalities,
    totalDailyUsers,
    focSitesCount,
    leoSitesCount,
    picsMunCount,
    pfiapsCount,
  };
}

export function getSiteTypeDistribution(sites: FreeWifiSite[] = FREE_WIFI_SITES) {
  const types: SiteType[] = ["LGU-HALL", "PES", "PHS", "HEI-LUC", "PC", "PFO"];
  const total = sites.length;

  return types.map((type) => {
    const targetCfg = SITE_TYPE_CONFIG[type];
    const subset = sites.filter((s) => {
      const cfg = getSiteTypeConfig(s.siteType);
      return cfg.shortLabel === targetCfg.shortLabel;
    });
    const count = subset.length;
    const apTotal = subset.reduce((sum, s) => sum + (Number(s.apCount) || 0), 0);

    return {
      type,
      name: targetCfg.shortLabel,
      fullName: targetCfg.label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      apTotal,
      color: targetCfg.color,
      bgColor: targetCfg.bgColor,
      borderColor: targetCfg.borderColor,
      textColor: targetCfg.textColor,
    };
  });
}

export function getMunicipalityDistribution(sites: FreeWifiSite[] = FREE_WIFI_SITES) {
  const map: Record<string, { municipality: string; totalSites: number; totalAps: number; focCount: number; leoCount: number; schoolCount: number; lguCount: number; collegeCount: number }> = {};

  sites.forEach((site) => {
    const mun = site.municipality || "Other";
    if (!map[mun]) {
      map[mun] = {
        municipality: mun,
        totalSites: 0,
        totalAps: 0,
        focCount: 0,
        leoCount: 0,
        schoolCount: 0,
        lguCount: 0,
        collegeCount: 0,
      };
    }
    map[mun].totalSites += 1;
    map[mun].totalAps += Number(site.apCount) || 0;
    
    const linkStr = (site.linkType || "").toLowerCase();
    if (linkStr.includes("fiber") || linkStr === "foc") map[mun].focCount += 1;
    if (linkStr.includes("sat") || linkStr.includes("leo") || linkStr.includes("vsat")) map[mun].leoCount += 1;

    const typeCfg = getSiteTypeConfig(site.siteType);
    if (typeCfg.shortLabel === "Elem. School" || typeCfg.shortLabel === "High School") {
      map[mun].schoolCount += 1;
    } else if (typeCfg.shortLabel === "College / HEI") {
      map[mun].collegeCount += 1;
    } else {
      map[mun].lguCount += 1;
    }
  });

  return Object.values(map).sort((a, b) => b.totalSites - a.totalSites);
}
