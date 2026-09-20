import { db } from "./db.js";
import { PROJECTS } from "../src/config/projects.js";

async function main() {
  console.log("Checking administration table...");
  const tableCheck = await db.execute(`
    CREATE TABLE IF NOT EXISTS administration (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      region TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      isFocal INTEGER DEFAULT 0,
      focalProject TEXT,
      phone TEXT,
      access TEXT NOT NULL,
      canEdit INTEGER DEFAULT 1,
      canDelete INTEGER DEFAULT 0,
      lastLogin TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Table verified.");

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
    console.log(`Inserted / updated: ${u.name}`);
  }

  const result = await db.execute("SELECT COUNT(*) as count FROM administration");
  console.log("Total administration records in Turso:", result.rows[0].count);
}

main().catch(console.error);
