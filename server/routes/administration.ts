import { Router, Request, Response } from "express";
import { db } from "../db.js";

export const administrationRouter = Router();

// Ensure focalProvince column exists in administration and users tables
db.execute("ALTER TABLE administration ADD COLUMN focalProvince TEXT").catch(() => {});
db.execute("ALTER TABLE users ADD COLUMN focalProvince TEXT").catch(() => {});

// Helper to format an administration row
function formatAdminRow(row: any) {
  let access: Record<string, boolean> = {};
  try {
    access = typeof row.access === "string" ? JSON.parse(row.access) : row.access || {};
  } catch {
    access = {};
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password || undefined,
    role: row.role,
    region: row.region,
    status: row.status,
    isFocal: Boolean(row.isFocal),
    focalProject: row.focalProject || undefined,
    focalProvince: row.focalProvince || undefined,
    phone: row.phone || undefined,
    access,
    canEdit: Boolean(row.canEdit === 1 || row.canEdit === true),
    canDelete: Boolean(row.canDelete === 1 || row.canDelete === true),
    lastLogin: row.lastLogin || "Never",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// POST /api/administration/login - authenticate user via email & password
administrationRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const result = await db.execute({
      sql: "SELECT * FROM administration WHERE LOWER(email) = ? OR LOWER(name) = ?",
      args: [cleanEmail, cleanEmail],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: `User "${email}" is not registered in the system. Please ask an administrator to add you.` 
      });
    }

    const row: any = result.rows[0];
    if (row.status === "inactive") {
      return res.status(403).json({ success: false, error: `Account for ${row.name} is currently inactive.` });
    }

    // Verify password if set on user
    if (!row.password || !String(row.password).trim()) {
      return res.status(400).json({
        success: false,
        error: `Account "${row.email}" is registered for GovMail Google SSO. Please click "Sign in with Google / Gmail" to log in.`,
      });
    }

    if (String(row.password).trim() !== String(password).trim()) {
      return res.status(401).json({ success: false, error: "Incorrect password. Please try again." });
    }

    // Update lastLogin
    await db.execute({
      sql: "UPDATE administration SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?",
      args: [row.id],
    });

    const user = formatAdminRow({ ...row, lastLogin: "Just now" });
    return res.json({ success: true, user });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/administration - list all administrators and their permissions
administrationRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(
      "SELECT * FROM administration ORDER BY createdAt ASC"
    );
    const users = result.rows.map(formatAdminRow);
    return res.json({ success: true, users });
  } catch (error: any) {
    console.error("Error fetching administration users:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/administration/:id - get single user
administrationRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ? OR email = ?",
      args: [id, id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, user: formatAdminRow(result.rows[0]) });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/administration - add new administrator
administrationRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const id = body.id || `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ? String(body.password).trim() : null;
    const role = body.role || "Viewer";
    const region = body.region || "Region V (Bicol)";
    const status = body.status || "active";
    const isFocal = body.isFocal ? 1 : 0;
    const focalProject = body.focalProject || null;
    const focalProvince = body.focalProvince || null;
    const phone = body.phone || null;
    const access = JSON.stringify(body.access || {});
    
    // Default canEdit based on role if not provided:
    let canEdit = 1;
    if (body.canEdit !== undefined) {
      canEdit = body.canEdit ? 1 : 0;
    } else if (role === "Viewer") {
      canEdit = 0;
    }

    const canDelete = body.canDelete !== undefined ? (body.canDelete ? 1 : 0) : (role === "Super Admin" || role === "Regional Director" ? 1 : 0);
    const lastLogin = body.lastLogin || "Just added";

    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }

    // Check if email already exists in administration
    const existingEmail = await db.execute({
      sql: "SELECT id FROM administration WHERE LOWER(email) = LOWER(?) LIMIT 1",
      args: [email],
    });

    if (existingEmail.rows.length > 0) {
      const existingId = existingEmail.rows[0].id as string;
      await db.execute({
        sql: `UPDATE administration 
              SET name = ?, password = ?, role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          name,
          password,
          role,
          region,
          status,
          isFocal,
          focalProject,
          focalProvince,
          phone,
          access,
          canEdit,
          canDelete,
          existingId,
        ],
      });

      await db.execute({
        sql: `UPDATE users 
              SET name = ?, password = ?, role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? OR LOWER(email) = LOWER(?)`,
        args: [
          name,
          password,
          role,
          region,
          status,
          isFocal,
          focalProject,
          focalProvince,
          phone,
          access,
          canEdit,
          canDelete,
          existingId,
          email,
        ],
      }).catch(() => {});

      const updated = await db.execute({
        sql: "SELECT * FROM administration WHERE id = ?",
        args: [existingId],
      });

      return res.status(200).json({ success: true, user: formatAdminRow(updated.rows[0]) });
    }

    await db.execute({
      sql: `INSERT INTO administration 
            (id, name, email, password, role, region, status, isFocal, focalProject, focalProvince, phone, access, canEdit, canDelete, lastLogin, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        id,
        name,
        email,
        password,
        role,
        region,
        status,
        isFocal,
        focalProject,
        focalProvince,
        phone,
        access,
        canEdit,
        canDelete,
        lastLogin,
      ],
    });

    // Mirror to users table as well
    await db.execute({
      sql: `INSERT OR REPLACE INTO users 
            (id, name, email, password, auth_provider, role, region, status, isFocal, focalProject, focalProvince, phone, access, canEdit, canDelete, lastLogin, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        id,
        name,
        email,
        password,
        password ? "local" : "google",
        role,
        region,
        status,
        isFocal,
        focalProject,
        focalProvince,
        phone,
        access,
        canEdit,
        canDelete,
        lastLogin,
      ],
    }).catch(() => {});

    const created = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ?",
      args: [id],
    });

    return res.status(201).json({ success: true, user: formatAdminRow(created.rows[0]) });
  } catch (error: any) {
    console.error("Error creating administration user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/administration/:id - update user, permissions, and project edit privileges
administrationRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const callerId = req.headers["x-user-id"] || body.callerId;

    if (callerId && String(callerId) !== String(id)) {
      const callerRes = await db.execute({
        sql: "SELECT * FROM administration WHERE id = ? OR email = ?",
        args: [String(callerId), String(callerId)],
      });
      if (callerRes.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: Caller account not recognized or unauthorized.",
        });
      }
      const caller: any = callerRes.rows[0];
      const isSuperAdminOrDirector =
        caller.role === "Super Admin" ||
        caller.role === "Regional Director" ||
        caller.role === "Assistant Regional Director" ||
        caller.canEdit === 1;
      if (!isSuperAdminOrDirector) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: You do not have permission to modify other personnel accounts.",
        });
      }
    }

    const existing = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const current: any = existing.rows[0];
    const name = body.name ?? current.name;
    const email = body.email ? String(body.email).trim().toLowerCase() : current.email;
    const password = body.password !== undefined ? body.password : current.password;
    const role = body.role ?? current.role;
    const region = body.region ?? current.region;
    const status = body.status ?? current.status;
    const isFocal = body.isFocal !== undefined ? (body.isFocal ? 1 : 0) : current.isFocal;
    const focalProject = body.focalProject !== undefined ? body.focalProject : current.focalProject;
    const focalProvince = body.focalProvince !== undefined ? body.focalProvince : (current.focalProvince || null);
    const phone = body.phone !== undefined ? body.phone : current.phone;
    const access = body.access !== undefined ? JSON.stringify(body.access) : current.access;
    const canEdit = body.canEdit !== undefined ? (body.canEdit ? 1 : 0) : current.canEdit;
    const canDelete = body.canDelete !== undefined ? (body.canDelete ? 1 : 0) : current.canDelete;

    await db.execute({
      sql: `UPDATE administration 
            SET name = ?, email = ?, password = ?, role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        name,
        email,
        password,
        role,
        region,
        status,
        isFocal,
        focalProject,
        focalProvince,
        phone,
        access,
        canEdit,
        canDelete,
        id,
      ],
    });

    // Mirror update to users table
    await db.execute({
      sql: `UPDATE users 
            SET name = ?, email = ?, password = ?, role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        name,
        email,
        password,
        role,
        region,
        status,
        isFocal,
        focalProject,
        focalProvince,
        phone,
        access,
        canEdit,
        canDelete,
        id,
      ],
    }).catch(() => {});

    const updated = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ?",
      args: [id],
    });

    return res.json({ success: true, user: formatAdminRow(updated.rows[0]) });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/administration/:id - delete user
administrationRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const callerId = req.headers["x-user-id"] || req.query.callerId;

    if (callerId) {
      const callerRes = await db.execute({
        sql: "SELECT * FROM administration WHERE id = ? OR email = ?",
        args: [String(callerId), String(callerId)],
      });
      if (callerRes.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: Caller account not recognized or unauthorized.",
        });
      }
      const caller: any = callerRes.rows[0];
      const canDelete =
        caller.role === "Super Admin" ||
        caller.role === "Regional Director" ||
        caller.canDelete === 1;
      if (!canDelete) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: Deletion requires Super Admin or Regional Director privileges.",
        });
      }
    }

    const checkTarget = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ?",
      args: [id],
    });
    if (checkTarget.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const result = await db.execute({
      sql: "DELETE FROM administration WHERE id = ?",
      args: [id],
    });

    return res.json({ success: true, id, rowsAffected: result.rowsAffected });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/administration/permissions/check - checks if user has permission to view & modify a project
administrationRouter.get("/permissions/check", async (req: Request, res: Response) => {
  try {
    const { userId, projectId } = req.query;
    if (!userId || !projectId) {
      return res.status(400).json({ success: false, error: "userId and projectId are required" });
    }

    const result = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ? OR email = ?",
      args: [String(userId), String(userId)],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const user = formatAdminRow(result.rows[0]);
    const isSuperAdmin = user.role === "Super Admin" || user.role === "Regional Director";
    const hasAccess = isSuperAdmin || Boolean(user.access?.[String(projectId)]);
    const canModify = hasAccess && user.canEdit && user.status === "active";

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      projectId,
      hasAccess,
      canModify,
      canDelete: isSuperAdmin && user.canDelete,
    });
  } catch (error: any) {
    console.error("Error checking permissions:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/administration/reset-defaults - restore default DICT personnel
administrationRouter.post("/reset-defaults", async (_req: Request, res: Response) => {
  try {
    const defaultAdmins = [
      {
        id: "usr-001",
        name: "Engr. Maria Clara",
        email: "maria.clara@dict.gov.ph",
        role: "Regional Director",
        region: "Region V (Bicol)",
        status: "active",
        isFocal: 0,
        access: JSON.stringify({ freewifi: true, elgu: true, pnpki: true, ilcdb: true, cybersecurity: true, miss: true, gecs: true, egovph: true, nbp: true, govnet: true, iidb: true }),
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
        access: JSON.stringify({ freewifi: true, elgu: true, pnpki: true, ilcdb: true, cybersecurity: true, miss: true, gecs: true, egovph: true, nbp: true, govnet: true, iidb: true }),
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
        access: JSON.stringify({ freewifi: true, elgu: true, pnpki: true, ilcdb: true, cybersecurity: true, miss: true, gecs: true, egovph: true, nbp: true, govnet: true, iidb: true }),
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
        access: JSON.stringify({ freewifi: true, govnet: true }),
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
        access: JSON.stringify({ cybersecurity: true, pnpki: true, miss: true }),
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
        access: JSON.stringify({}),
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
          u.access,
          u.canEdit,
          u.canDelete,
          u.lastLogin,
        ],
      });
    }

    const result = await db.execute("SELECT * FROM administration ORDER BY createdAt ASC");
    return res.json({ success: true, users: result.rows.map(formatAdminRow) });
  } catch (error: any) {
    console.error("Error resetting default admins:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
