import { db } from "./db.js";
import { PROJECTS } from "../src/config/projects.js";

export const PROJECT_TABLES = [
  "gecs",
  "freewifi",
  "egovph",
  "elgu",
  "nbp",
  "govnet",
  "pnpki",
  "ilcdb",
  "cybersecurity",
  "miss",
  "iidb",
] as const;

export type ProjectTableName = typeof PROJECT_TABLES[number];

export function isProjectTable(name: string): name is ProjectTableName {
  return (PROJECT_TABLES as readonly string[]).includes(name);
}

export const DEFAULT_MODULES = [
  // DICT Projects
  {
    id: "mod-gecs",
    code: "MOD_GECS",
    name: "Government Emergency Communications System",
    shortName: "GECS",
    category: "Project",
    description: "Disaster emergency response telecoms, deployable satellite terminals, and HF/VHF radio operations.",
    route_path: "/projects/gecs",
    is_active: 1,
  },
  {
    id: "mod-freewifi",
    code: "MOD_FREEWIFI",
    name: "Free Wi-Fi for All Program",
    shortName: "Free Wi-Fi",
    category: "Project",
    description: "Public Wi-Fi access points deployed across schools, RHUs, parks, and transportation terminals.",
    route_path: "/projects/freewifi",
    is_active: 1,
  },
  {
    id: "mod-egovph",
    code: "MOD_EGOVPH",
    name: "e-Gov Super App & Local Portal",
    shortName: "eGOVPH",
    category: "Project",
    description: "Unified government digital service portal, citizen onboarding, and LGU agency integration.",
    route_path: "/projects/egovph",
    is_active: 1,
  },
  {
    id: "mod-elgu",
    code: "MOD_ELGU",
    name: "Electronic Business Permits & Licensing (eLGU)",
    shortName: "eLGU",
    category: "Project",
    description: "Automated business permits, civil registry, and real property tax collection systems.",
    route_path: "/projects/elgu",
    is_active: 1,
  },
  {
    id: "mod-nbp",
    code: "MOD_NBP",
    name: "National Broadband Plan / Fiber Backbone",
    shortName: "NBP",
    category: "Project",
    description: "High-capacity national fiber-optic backbone nodes and microwave transmission links.",
    route_path: "/projects/nbp",
    is_active: 1,
  },
  {
    id: "mod-govnet",
    code: "MOD_GOVNET",
    name: "Government Integrated Network",
    shortName: "GovNet",
    category: "Project",
    description: "Inter-agency fiber connectivity connecting provincial, regional, and national offices.",
    route_path: "/projects/govnet",
    is_active: 1,
  },
  {
    id: "mod-pnpki",
    code: "MOD_PNPKI",
    name: "Philippine National Public Key Infrastructure",
    shortName: "PNPKI",
    category: "Project",
    description: "X.509 digital certificates, identity validation, and secure cryptographic signing services.",
    route_path: "/projects/pnpki",
    is_active: 1,
  },
  {
    id: "mod-ilcdb",
    code: "MOD_ILCDB",
    name: "ICT Literacy and Competency Development",
    shortName: "ILCDB",
    category: "Project",
    description: "Digital skills training, cybersecurity awareness courses, and workforce capacity development.",
    route_path: "/projects/ilcdb",
    is_active: 1,
  },
  {
    id: "mod-cybersecurity",
    code: "MOD_CYBERSECURITY",
    name: "Cybersecurity & Incident Response Team",
    shortName: "Cybersecurity",
    category: "Project",
    description: "Regional CERT monitoring, vulnerability assessments, threat intelligence, and defense advisory.",
    route_path: "/projects/cybersecurity",
    is_active: 1,
  },
  {
    id: "mod-miss",
    code: "MOD_MISS",
    name: "Maritime & Islands Satellite Services",
    shortName: "MISS",
    category: "Project",
    description: "Satellite connectivity and digital telemetry for isolated islands and coastal communities.",
    route_path: "/projects/miss",
    is_active: 1,
  },
  {
    id: "mod-iidb",
    code: "MOD_IIDB",
    name: "ICT Industry Development Bureau",
    shortName: "IIDB",
    category: "Project",
    description: "Digital jobs PH training, tech startup incubation, and regional IT-BPM industry growth.",
    route_path: "/projects/iidb",
    is_active: 1,
  },
  // Core System Tools
  {
    id: "mod-dtr",
    code: "MOD_DTR",
    name: "DTR Generator & PNPKI Digital Signature",
    shortName: "DTR Generator",
    category: "Core Tool",
    description: "Civil Service Form No. 48 generation, biometric time punch parsing, and PNPKI .p12 signing.",
    route_path: "/dtr",
    is_active: 1,
  },
  {
    id: "mod-calendar",
    code: "MOD_CALENDAR",
    name: "Regional Calendar & Events",
    shortName: "Calendar",
    category: "Core Tool",
    description: "Regional activities, project deployments, holidays, and training schedule planner.",
    route_path: "/calendar",
    is_active: 1,
  },
  // Management Modules
  {
    id: "mod-project-data",
    code: "MOD_PROJECT_DATA",
    name: "Project Data Management (Editing Data Center)",
    shortName: "Project Data",
    category: "Management",
    description: "Data entry, record modification, field schema editing, and raw telemetry storage.",
    route_path: "/settings/projects",
    is_active: 1,
  },
  {
    id: "mod-admin",
    code: "MOD_ADMIN",
    name: "Administration & User Access Control",
    shortName: "Administration",
    category: "Management",
    description: "Personnel directory, role definitions, module permissions, and system security controls.",
    route_path: "/settings/system",
    is_active: 1,
  },
];

export async function initDatabase() {
  console.log("Initializing Turso / libSQL Database...");

  // 1. Create projects metadata table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      shortName TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      category TEXT,
      enabledAnalytics TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed projects metadata if empty
  const existingProjects = await db.execute("SELECT COUNT(*) as count FROM projects");
  const projectsCount = Number(existingProjects.rows[0]?.count ?? 0);
  if (projectsCount === 0) {
    console.log("Seeding default projects metadata...");
    for (const p of PROJECTS) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO projects (id, name, shortName, description, status, category, enabledAnalytics)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          p.name,
          p.shortName,
          p.description,
          p.status,
          p.category,
          JSON.stringify(p.enabledAnalytics || []),
        ],
      });
    }
  }

  // 2. Create administration table (users, roles, and Project Data Management edit permissions)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS administration (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      role TEXT NOT NULL,
      region TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      isFocal INTEGER DEFAULT 0,
      focalProject TEXT,
      focalProvince TEXT,
      phone TEXT,
      access TEXT NOT NULL,
      canEdit INTEGER DEFAULT 1,
      canDelete INTEGER DEFAULT 0,
      lastLogin TEXT,
      auth_provider TEXT DEFAULT 'local',
      google_id TEXT,
      avatar_url TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure extra columns exist on administration table if created previously
  for (const col of [
    "ALTER TABLE administration ADD COLUMN password TEXT;",
    "ALTER TABLE administration ADD COLUMN focalProvince TEXT;",
    "ALTER TABLE administration ADD COLUMN auth_provider TEXT DEFAULT 'local';",
    "ALTER TABLE administration ADD COLUMN google_id TEXT;",
    "ALTER TABLE administration ADD COLUMN avatar_url TEXT;",
  ]) {
    try {
      await db.execute(col);
    } catch {}
  }

  // 2b. Create dedicated users table (for credential and session management across Google OAuth and local accounts)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      auth_provider TEXT DEFAULT 'local',
      google_id TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'Viewer',
      region TEXT DEFAULT 'Region V (Bicol)',
      status TEXT DEFAULT 'active',
      isFocal INTEGER DEFAULT 0,
      focalProject TEXT,
      focalProvince TEXT,
      phone TEXT,
      access TEXT NOT NULL,
      canEdit INTEGER DEFAULT 1,
      canDelete INTEGER DEFAULT 0,
      lastLogin TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Sync existing users from administration into users table
  try {
    const existingAdmins = await db.execute("SELECT * FROM administration");
    for (const row of existingAdmins.rows as any[]) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO users (id, name, email, password, auth_provider, google_id, avatar_url, role, region, status, isFocal, focalProject, focalProvince, phone, access, canEdit, canDelete, lastLogin, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`,
        args: [
          row.id,
          row.name,
          row.email,
          row.password || null,
          row.auth_provider || (row.email?.endsWith("@gmail.com") ? "google" : "local"),
          row.google_id || null,
          row.avatar_url || null,
          row.role || "Viewer",
          row.region || "Region V (Bicol)",
          row.status || "active",
          row.isFocal || 0,
          row.focalProject || null,
          row.focalProvince || null,
          row.phone || null,
          row.access || "{}",
          row.canEdit !== undefined ? row.canEdit : 1,
          row.canDelete !== undefined ? row.canDelete : 0,
          row.lastLogin || null,
          row.createdAt || null,
        ],
      });
    }
  } catch (e) {
    console.warn("Could not sync users from administration:", e);
  }

  // 3. Create dtr_generator table (for PNPKI .p12 digital signatures and signature image)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dtr_generator (
      id TEXT PRIMARY KEY,
      user_Id TEXT,
      Name TEXT NOT NULL,
      p12 TEXT,
      p12_filename TEXT,
      p12_filesize INTEGER,
      p12_password TEXT,
      image_digiSigned TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3b. Create dtr_storage table (for DTR documents moved to Provincial, HRM, or TOD archives with audit user_id tracking)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dtr_storage (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      employee_name TEXT NOT NULL,
      employee_id TEXT,
      position TEXT,
      employment_status TEXT DEFAULT 'Regular',
      module TEXT NOT NULL DEFAULT 'PROVINCIAL',
      province TEXT,
      section_division TEXT,
      period_text TEXT,
      month INTEGER,
      year INTEGER,
      scope TEXT DEFAULT 'full',
      regular_hours TEXT,
      saturday_hours TEXT,
      supervisor_name TEXT,
      supervisor_title TEXT,
      total_days_rendered INTEGER DEFAULT 0,
      total_hours_rendered INTEGER DEFAULT 0,
      undertime_hours INTEGER DEFAULT 0,
      undertime_minutes INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Submitted',
      submitted_date TEXT,
      pdf_filename TEXT,
      pdf_filesize TEXT,
      pdf_data TEXT,
      has_p12 INTEGER DEFAULT 0,
      signature_image TEXT,
      signer_name TEXT,
      employee_signature_image TEXT,
      employee_has_p12 INTEGER DEFAULT 0,
      employee_signer_name TEXT,
      supervisor_signature_image TEXT,
      supervisor_has_p12 INTEGER DEFAULT 0,
      rows_json TEXT,
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN signer_name TEXT;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN employee_signature_image TEXT;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN employee_has_p12 INTEGER DEFAULT 0;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN employee_signer_name TEXT;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN supervisor_signature_image TEXT;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN supervisor_has_p12 INTEGER DEFAULT 0;`);
  } catch {}
  try {
    await db.execute(`ALTER TABLE dtr_storage ADD COLUMN doc_type TEXT DEFAULT 'DTR';`);
  } catch {}

  // 4. Create module table (Module management, specific module codes, and active/deactive status)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS module (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      shortName TEXT,
      category TEXT NOT NULL DEFAULT 'Project',
      description TEXT,
      route_path TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default modules if module table is empty
  const existingModules = await db.execute("SELECT COUNT(*) as count FROM module");
  const modulesCount = Number(existingModules.rows[0]?.count ?? 0);
  if (modulesCount === 0) {
    console.log("Seeding default system modules into Turso module table...");
    for (const m of DEFAULT_MODULES) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO module (id, code, name, shortName, category, description, route_path, is_active)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          m.id,
          m.code,
          m.name,
          m.shortName,
          m.category,
          m.description,
          m.route_path,
          m.is_active,
        ],
      });
    }
  }

  // Cleanup deprecated modules
  try {
    await db.execute(`DELETE FROM module WHERE code = 'MOD_URL_SHORTENER' OR id = 'mod-url-shortener';`);
  } catch {}

  // Create app_metadata table to track system initialization state
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed administration table only on first-time setup (never overwrite user deletions)
  const metaCheck = await db.execute("SELECT value FROM app_metadata WHERE key = 'admin_initialized'");
  const isInitialized = metaCheck.rows.length > 0;
  if (!isInitialized) {
    console.log("First-time setup: Seeding default administrators into Turso...");
    const defaultAdmins = [
      {
        id: "usr-001",
        name: "Engr. Maria Clara",
        email: "maria.clara@dict.gov.ph",
        role: "Regional Director",
        region: "Region V (Bicol)",
        status: "active",
        isFocal: 0,
        access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
        canEdit: 1,
        canDelete: 1,
        lastLogin: "10 mins ago",
      },
      {
        id: "usr-002",
        name: "Atty. Jose Rizal",
        email: "jose.rizal@dict.gov.ph",
        role: "Assistant Regional Director",
        region: "Region V (Bicol)",
        status: "active",
        isFocal: 0,
        access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
        canEdit: 1,
        canDelete: 1,
        lastLogin: "45 mins ago",
      },
      {
        id: "usr-003",
        name: "Juan Dela Cruz",
        email: "juan.dela.cruz@dict.gov.ph",
        role: "Super Admin",
        region: "National",
        status: "active",
        isFocal: 0,
        access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
        canEdit: 1,
        canDelete: 1,
        lastLogin: "Just now",
      },
      {
        id: "usr-004",
        name: "Andres Bonifacio",
        email: "andres.bonifacio@dict.gov.ph",
        role: "Field Engineer",
        region: "Region V (Bicol)",
        status: "active",
        isFocal: 1,
        focalProject: "freewifi",
        access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: p.id === "freewifi" || p.id === "govnet" }), {}),
        canEdit: 1,
        canDelete: 0,
        lastLogin: "2 days ago",
      },
      {
        id: "usr-005",
        name: "Gabriela Silang",
        email: "gabriela.silang@dict.gov.ph",
        role: "Analyst",
        region: "Region V (Bicol)",
        status: "active",
        isFocal: 1,
        focalProject: "cybersecurity",
        access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: p.id === "cybersecurity" || p.id === "pnpki" || p.id === "miss" }), {}),
        canEdit: 1,
        canDelete: 0,
        lastLogin: "3 hrs ago",
      },
      {
        id: "usr-006",
        name: "Emilio Aguinaldo",
        email: "emilio.aguinaldo@dict.gov.ph",
        role: "Viewer",
        region: "Region V (Bicol)",
        status: "inactive",
        isFocal: 0,
        access: PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: false }), {}),
        canEdit: 0,
        canDelete: 0,
        lastLogin: "5 days ago",
      },
    ];

    for (const u of defaultAdmins) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO administration 
              (id, name, email, role, region, status, isFocal, focalProject, phone, access, canEdit, canDelete, lastLogin, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [
          u.id,
          u.name,
          u.email,
          u.role,
          u.region,
          u.status,
          u.isFocal,
          u.focalProject || null,
          null,
          JSON.stringify(u.access),
          u.canEdit,
          u.canDelete,
          u.lastLogin,
        ],
      });
    }
    await db.execute("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('admin_initialized', 'true')");
  }

  // 2. Create and seed each dedicated project table
  for (const tableName of PROJECT_TABLES) {
    // Create project table named directly after the project
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT,
        province TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indices
    await db.execute(`
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_status" ON "${tableName}"(status);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS "idx_${tableName}_province" ON "${tableName}"(province);
    `);
  }

  console.log("Turso Database initialized successfully with all project tables!");
}
