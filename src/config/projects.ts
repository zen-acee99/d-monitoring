export type ProjectStatus = "operational" | "warning" | "critical" | "inactive";

export interface Project {
  id: string;
  name: string;
  shortName: string;
  description: string;
  status: ProjectStatus;
  category: string;
  enabledAnalytics: string[];
}

export const PROJECTS: Project[] = [
  {
    id: "gecs",
    name: "Government Emergency Communication System",
    shortName: "GECS",
    description: "Resilient communication network for emergency response",
    status: "operational",
    category: "Infrastructure",
    enabledAnalytics: ["incidentVolume", "responseTime", "regionalCoverage", "availability", "criticalAlerts"],
  },
  {
    id: "freewifi",
    name: "Free WiFi 4 All",
    shortName: "Free WiFi",
    description: "Regional and nationwide public internet access points across LGUs, schools, and public spaces",
    status: "operational",
    category: "Connectivity",
    enabledAnalytics: ["connectedUsers", "bandwidth", "activeSites", "coverage", "uptime"],
  },
  {
    id: "egovph",
    name: "eGOVPH",
    shortName: "eGOVPH",
    description: "Unified government services portal",
    status: "operational",
    category: "Digital Services",
    enabledAnalytics: ["transactions", "activeUsers", "serviceAvailability", "responseTime", "transactionVolume"],
  },
  {
    id: "elgu",
    name: "eLGU",
    shortName: "eLGU",
    description: "Local Government Unit digitalization program",
    status: "operational",
    category: "Digital Services",
    enabledAnalytics: ["activeUsers", "transactions", "availability", "regionalCoverage"],
  },
  {
    id: "nbp",
    name: "National Broadband Plan",
    shortName: "NBP",
    description: "National broadband infrastructure and backbone fiber routes across Region V",
    status: "operational",
    category: "Infrastructure",
    enabledAnalytics: ["bandwidth", "coverage", "uptime", "activeSites"],
  },
  {
    id: "govnet",
    name: "GovNet",
    shortName: "GovNet",
    description: "Government fiber optic network interconnecting regional agencies and state colleges",
    status: "critical",
    category: "Infrastructure",
    enabledAnalytics: ["bandwidth", "activeSites", "availability", "alerts"],
  },
  {
    id: "pnpki",
    name: "PNPKI",
    shortName: "PNPKI",
    description: "Philippine National Public Key Infrastructure for digital signatures and certificates",
    status: "operational",
    category: "Security",
    enabledAnalytics: ["transactions", "uptime", "activeUsers"],
  },
  {
    id: "ilcdb",
    name: "ILCDB",
    shortName: "ILCDB",
    description: "ICT Literacy and Competency Development Bureau training programs",
    status: "operational",
    category: "Education",
    enabledAnalytics: ["activeUsers", "regionalCoverage", "availability"],
  },
  {
    id: "cybersecurity",
    name: "Cybersecurity",
    shortName: "Cybersecurity",
    description: "Regional CSIRT threat detection, vulnerability remediation, and incident response",
    status: "operational",
    category: "Security",
    enabledAnalytics: ["threatsDetected", "incidents", "severity", "blockedEvents", "responseTime"],
  },
  {
    id: "miss",
    name: "Management Information Systems Service",
    shortName: "MISS",
    description: "Regional ICT helpdesk, enterprise internal systems, Forcepoint firewall security, and LGU technical support",
    status: "operational",
    category: "Services & Infrastructure",
    enabledAnalytics: ["incidentVolume", "responseTime", "availability"],
  },
  {
    id: "iidb",
    name: "ICT Industry Development Bureau",
    shortName: "IIDB",
    description: "Digital startups, digital careers, MSME e-commerce onboarding, and regional IT-BPM ecosystem development",
    status: "operational",
    category: "Services",
    enabledAnalytics: ["activeUsers", "availability"],
  }
];

export const STORAGE_KEY_PROJECT_SETTINGS = "dict_project_settings_v1";

export function getStoredProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECT_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure all default projects exist
        const map = new Map(parsed.map((p: Project) => [p.id, p]));
        return PROJECTS.map((def) => map.get(def.id) || def);
      }
    }
  } catch (e) {
    console.error("Failed to load stored project settings", e);
  }
  return PROJECTS;
}

export function saveStoredProjects(projects: Project[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECT_SETTINGS, JSON.stringify(projects));
    window.dispatchEvent(new CustomEvent("dict_projects_meta_updated", { detail: projects }));
  } catch (e) {
    console.error("Failed to save project settings", e);
  }
}

export function updateProjectSetting(projectId: string, updates: Partial<Project>): Project[] {
  const current = getStoredProjects();
  const updated = current.map((p) => (p.id === projectId ? { ...p, ...updates } : p));
  saveStoredProjects(updated);
  return updated;
}
