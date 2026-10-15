import { PROJECTS } from "@/config/projects";

export type UserRole = 
  | "Super Admin"
  | "Admin"
  | "Regional Director"
  | "Asst. Regional Director"
  | "Technical Operations Division"
  | "OIC Chief - Technical Operations Division"
  | "Provincial Officer"
  | "Engr. I"
  | "Engr. II"
  | "Engr. III"
  | "PDO I"
  | "PDO II"
  | "PDO III"
  | "PLO I"
  | "PLO II"
  | "PLO III"
  | "ISA I"
  | "ISA II"
  | "ISA III"
  | "ITO I"
  | "ITO II"
  | "ADMIN I"
  | "ADMIN II"
  | "ADMIN III"
  | "ADMIN IV"
  | "ADMIN V"
  | "ACCOUNTANT I"
  | "ACCOUNTANT II"
  | "ACCOUNTANT III"
  | "ACCOUNTANT IV"
  | "ACCOUNTANT V"
  | "CLERK"
  | "DRIVER"
  | "Assistant Regional Director"
  | "Analyst"
  | "Field Engineer"
  | "Viewer"
  | string;

export interface UserRecord {
  id: string | number;
  name: string;
  email: string;
  password?: string;
  role: UserRole | string;
  region: string;
  status: "active" | "inactive";
  isFocal: boolean;
  focalProject?: string;
  pnpkiRole?: "RAO" | "RAA" | string;
  focalProvince?: string;
  phone?: string;
  access: Record<string, boolean>;
  canEdit?: boolean;
  canDelete?: boolean;
  authProvider?: "google" | "local";
  lastLogin: string;
  createdAt: string;
}

const STORAGE_KEY = "dict_r5_users_db";

const DEFAULT_USERS: UserRecord[] = [
  {
    id: 1,
    name: "Engr. Maria Clara",
    email: "maria.clara@dict.gov.ph",
    role: "Regional Director",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "10 mins ago",
    createdAt: "2024-01-15",
  },
  {
    id: 2,
    name: "Atty. Jose Rizal",
    email: "jose.rizal@dict.gov.ph",
    role: "Assistant Regional Director",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "45 mins ago",
    createdAt: "2024-01-15",
  },
  {
    id: 3,
    name: "Juan Dela Cruz",
    email: "juan.dela.cruz@dict.gov.ph",
    role: "Super Admin",
    region: "National",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "Just now",
    createdAt: "2024-01-01",
  },
  {
    id: 4,
    name: "Andres Bonifacio",
    email: "andres.bonifacio@dict.gov.ph",
    role: "Field Engineer",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: true,
    focalProject: "freewifi",
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: p.id === "freewifi" || p.id === "govnet" }), {}),
    lastLogin: "2 days ago",
    createdAt: "2024-02-10",
  },
  {
    id: 5,
    name: "Gabriela Silang",
    email: "gabriela.silang@dict.gov.ph",
    role: "Analyst",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: true,
    focalProject: "cybersecurity",
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: p.id === "cybersecurity" || p.id === "pnpki" || p.id === "miss" }), {}),
    lastLogin: "3 hrs ago",
    createdAt: "2024-02-20",
  },
  {
    id: 6,
    name: "Emilio Aguinaldo",
    email: "emilio.aguinaldo@dict.gov.ph",
    role: "Viewer",
    region: "Region V (Bicol)",
    status: "inactive",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: false }), {}),
    lastLogin: "5 days ago",
    createdAt: "2024-03-01",
  },
  {
    id: 7,
    name: "Annabel C. Odoño-Calimpong",
    email: "annabel.calimpong@dict.gov.ph",
    role: "Regional Director",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "1 hr ago",
    createdAt: "2024-01-15",
  },
  {
    id: 8,
    name: "Rene Jane R. Buena",
    email: "renejane.buena@dict.gov.ph",
    role: "Provincial Officer",
    region: "Region V (Bicol)",
    focalProvince: "Albay",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "30 mins ago",
    createdAt: "2024-01-15",
  },
  {
    id: 9,
    name: "Ace M. Malto",
    email: "ace.malto@dict.gov.ph",
    role: "PDO II",
    region: "Region V (Bicol)",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "Just now",
    createdAt: "2024-01-15",
  },
  {
    id: 10,
    name: "Norly A. Tabo",
    email: "norly.tabo@dict.gov.ph",
    role: "OIC Chief - Technical Operations Division",
    region: "Region V (Bicol)",
    focalProvince: "TOD",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "2 hrs ago",
    createdAt: "2024-01-15",
  },
  {
    id: 11,
    name: "Christian Roy N. Melad",
    email: "christian.melad@dict.gov.ph",
    role: "OIC- Regional Director",
    region: "Region V (Bicol)",
    focalProvince: "Regional Off",
    status: "active",
    isFocal: false,
    access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    lastLogin: "1 day ago",
    createdAt: "2024-01-15",
  },
];

export function normalizeUserAssignment(u: UserRecord): UserRecord {
  if (!u) return u;
  const lowerName = (u.name || "").toLowerCase();
  const lowerEmail = (u.email || "").toLowerCase();
  const fp = (u.focalProvince || "").trim();

  if (!fp) {
    if (lowerName.includes("rene jane") || lowerEmail.includes("renejane.buena")) {
      return { ...u, focalProvince: "Albay" };
    }
    if (lowerName.includes("norly") && lowerName.includes("tabo")) {
      return { ...u, focalProvince: "TOD" };
    }
  }
  return u;
}

export function getStoredUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed
        .filter((u: any) => u && !String(u.id || "").startsWith("g-"))
        .map((u: UserRecord) => normalizeUserAssignment(u));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      }
      if (cleaned.length > 0) {
        return cleaned;
      }
    }
    return DEFAULT_USERS;
  } catch (e) {
    console.error("Error reading users from storage:", e);
    return DEFAULT_USERS;
  }
}

export function saveStoredUsers(users: UserRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event("dict_users_updated"));
  } catch (e) {
    console.error("Error saving users to storage:", e);
  }
}

/**
 * Dynamically resolves the designated DICT Focal Person for a project and optional province
 * directly from the User Directory (`administration` / `users`), strictly honoring `isFocal === true`
 * and `focalProvince` scope without falling back to unrelated provinces or hardcoded dummy names.
 */
export function resolveProjectFocalPerson(
  projectId: string,
  province?: string,
  usersList?: any[]
): string {
  const projId = String(projectId || "")
    .trim()
    .toLowerCase()
    .replace(/^mod[_-]/, "");
  if (!projId) return "Unassigned";

  const sourceUsers: any[] =
    Array.isArray(usersList) && usersList.length > 0 ? usersList : getStoredUsers();

  const isTrueFocal = (u: any): boolean => {
    if (!u || u.status === "inactive") return false;
    const focalFlag = u.isFocal === true || u.isFocal === 1 || u.isFocal === "1";
    if (!focalFlag) return false;
    const uProj = String(u.focalProject || "")
      .trim()
      .toLowerCase()
      .replace(/^mod[_-]/, "");
    return uProj === projId;
  };

  const isRegionalScope = (fProvRaw?: string): boolean => {
    const fp = String(fProvRaw || "").trim().toLowerCase();
    return (
      !fp ||
      fp === "all provinces / regional" ||
      fp === "all provinces" ||
      fp === "regional" ||
      fp === "region v (bicol)" ||
      fp === "all"
    );
  };

  const activeProjectFocals = sourceUsers.filter(isTrueFocal);
  if (activeProjectFocals.length === 0) {
    return "Unassigned";
  }

  const targetProv = String(province || "").trim().toLowerCase();
  if (targetProv && targetProv !== "all") {
    // 1. Exact province focal match
    const provMatches = activeProjectFocals.filter((u) => {
      const fp = String(u.focalProvince || "").trim().toLowerCase();
      return fp === targetProv || (fp && !isRegionalScope(fp) && fp.includes(targetProv));
    });
    if (provMatches.length > 0) {
      return Array.from(new Set(provMatches.map((u) => String(u.name).trim()))).join(" / ");
    }

    // 2. Fallback ONLY to Regional / All-Provinces focal for this project (never another specific province!)
    const regionalMatches = activeProjectFocals.filter((u) => isRegionalScope(u.focalProvince));
    if (regionalMatches.length > 0) {
      return Array.from(new Set(regionalMatches.map((u) => String(u.name).trim()))).join(" / ");
    }

    return "Unassigned";
  }

  // No specific province requested: prefer regional focal(s), otherwise list all active focals for this project
  const regionalMatches = activeProjectFocals.filter((u) => isRegionalScope(u.focalProvince));
  if (regionalMatches.length > 0) {
    return Array.from(new Set(regionalMatches.map((u) => String(u.name).trim()))).join(" / ");
  }

  return Array.from(new Set(activeProjectFocals.map((u) => String(u.name).trim()))).join(" / ");
}

