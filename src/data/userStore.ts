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
];

export function getStoredUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
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
