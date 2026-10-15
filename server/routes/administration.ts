import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../services/pnpkiSigningService.js";

export const administrationRouter = Router();

// Ensure focalProvince, pnpkiRole, and theme columns exist in administration and users tables
db.execute("ALTER TABLE administration ADD COLUMN focalProvince TEXT").catch(() => {});
db.execute("ALTER TABLE users ADD COLUMN focalProvince TEXT").catch(() => {});
db.execute("ALTER TABLE administration ADD COLUMN pnpkiRole TEXT").catch(() => {});
db.execute("ALTER TABLE users ADD COLUMN pnpkiRole TEXT").catch(() => {});
db.execute("ALTER TABLE administration ADD COLUMN theme TEXT DEFAULT 'dark'").catch(() => {});
db.execute("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'dark'").catch(() => {});
db.execute(
  "CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"
).catch(() => {});

// Ensure default PO/TOD unit assignments in DB if not yet explicitly assigned
db.execute(
  "UPDATE administration SET focalProvince = 'Albay' WHERE (LOWER(email) LIKE '%renejane%' OR LOWER(name) LIKE '%rene jane%') AND (focalProvince IS NULL OR focalProvince = '')"
).catch(() => {});
db.execute(
  "UPDATE users SET focalProvince = 'Albay' WHERE (LOWER(email) LIKE '%renejane%' OR LOWER(name) LIKE '%rene jane%') AND (focalProvince IS NULL OR focalProvince = '')"
).catch(() => {});
db.execute(
  "UPDATE administration SET focalProvince = 'TOD' WHERE (LOWER(email) LIKE '%norly.tabo%' OR LOWER(name) LIKE '%norly%') AND (focalProvince IS NULL OR focalProvince = '')"
).catch(() => {});
db.execute(
  "UPDATE users SET focalProvince = 'TOD' WHERE (LOWER(email) LIKE '%norly.tabo%' OR LOWER(name) LIKE '%norly%') AND (focalProvince IS NULL OR focalProvince = '')"
).catch(() => {});

// Helper to format an administration row (never expose plaintext or hashed passwords)
function formatAdminRow(row: any) {
  let access: Record<string, boolean> = {};
  try {
    access = typeof row.access === "string" ? JSON.parse(row.access) : row.access || {};
  } catch {
    access = {};
  }

  let resolvedFocalProvince = row.focalProvince || undefined;
  const lowerName = String(row.name || "").toLowerCase();
  const lowerEmail = String(row.email || "").toLowerCase();
  if (!resolvedFocalProvince) {
    if (lowerName.includes("rene jane") || lowerEmail.includes("renejane")) {
      resolvedFocalProvince = "Albay";
    } else if (lowerName.includes("norly") && lowerName.includes("tabo")) {
      resolvedFocalProvince = "TOD";
    }
  }

  const isFocalBool = Boolean(row.isFocal === 1 || row.isFocal === true || row.isFocal === "1");

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: undefined,
    hasPassword: Boolean(row.password),
    role: row.role,
    region: row.region,
    status: row.status,
    isFocal: isFocalBool,
    focalProject: isFocalBool && row.focalProject ? row.focalProject : undefined,
    pnpkiRole: isFocalBool && row.pnpkiRole ? row.pnpkiRole : undefined,
    focalProvince: resolvedFocalProvince,
    phone: row.phone || undefined,
    theme: row.theme === "light" ? "light" : "dark",
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
    const cleanPassword = String(password).trim();
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

    // Verify password if set on user (check users table as fallback if administration.password is empty)
    let storedPassword = row.password ? String(row.password).trim() : "";
    if (!storedPassword) {
      const userFallback = await db.execute({
        sql: "SELECT password FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1",
        args: [row.id, row.email],
      });
      if (userFallback.rows.length > 0 && userFallback.rows[0].password) {
        storedPassword = String(userFallback.rows[0].password).trim();
      }
    }
    if (!storedPassword) {
      return res.status(400).json({
        success: false,
        error: `Account "${row.email}" is registered for GovMail Google SSO. Please click "Sign in with Google / Gmail" to log in.`,
      });
    }

    if (!verifyPassword(cleanPassword, storedPassword)) {
      return res.status(401).json({ success: false, error: "Incorrect password. Please try again." });
    }

    // Seamless auto-upgrade of legacy plaintext passwords to scrypt hash
    const finalPasswordHash = storedPassword.startsWith("scrypt:") ? storedPassword : hashPassword(cleanPassword);
    if (!storedPassword.startsWith("scrypt:") || !row.password) {
      await db.execute({
        sql: "UPDATE administration SET password = ? WHERE id = ? OR LOWER(email) = LOWER(?)",
        args: [finalPasswordHash, row.id, row.email],
      }).catch(() => {});
      await db.execute({
        sql: "UPDATE users SET password = ? WHERE id = ? OR LOWER(email) = LOWER(?)",
        args: [finalPasswordHash, row.id, row.email],
      }).catch(() => {});
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

// GET /api/administration/theme - get saved Dark / White theme from Turso DB
administrationRouter.get("/theme", async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || req.headers["x-user-id"] || "").trim();
    if (userId) {
      const userRes = await db.execute({
        sql: "SELECT theme FROM administration WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1",
        args: [userId, userId],
      });
      if (userRes.rows.length > 0 && userRes.rows[0].theme) {
        const userTheme = String(userRes.rows[0].theme).toLowerCase() === "light" ? "light" : "dark";
        return res.json({ success: true, theme: userTheme, source: "user_db" });
      }
    }

    const sysRes = await db.execute({
      sql: "SELECT value FROM system_settings WHERE key = 'theme' LIMIT 1",
      args: [],
    });
    if (sysRes.rows.length > 0 && sysRes.rows[0].value) {
      const sysTheme = String(sysRes.rows[0].value).toLowerCase() === "light" ? "light" : "dark";
      return res.json({ success: true, theme: sysTheme, source: "system_db" });
    }

    return res.json({ success: true, theme: "dark", source: "default" });
  } catch (error: any) {
    console.error("Error fetching theme from DB:", error);
    return res.json({ success: true, theme: "dark", source: "fallback" });
  }
});

// PUT /api/administration/theme - save Dark / White theme to Turso DB
administrationRouter.put("/theme", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const theme = String(body.theme || "dark").toLowerCase() === "light" ? "light" : "dark";
    const userId = String(body.userId || body.email || req.headers["x-user-id"] || "").trim();

    await db.execute({
      sql: `INSERT INTO system_settings (key, value, updated_at)
            VALUES ('theme', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      args: [theme],
    });

    if (userId) {
      await db.execute({
        sql: "UPDATE administration SET theme = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? OR LOWER(email) = LOWER(?)",
        args: [theme, userId, userId],
      }).catch(() => {});
      await db.execute({
        sql: "UPDATE users SET theme = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR LOWER(email) = LOWER(?)",
        args: [theme, userId, userId],
      }).catch(() => {});
    }

    return res.json({ success: true, theme, savedToDb: true });
  } catch (error: any) {
    console.error("Error saving theme to DB:", error);
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
    const rawPassword = body.password ? String(body.password).trim() : null;
    if (rawPassword) {
      const pwdVal = validatePasswordStrength(rawPassword);
      if (!pwdVal.valid) {
        return res.status(400).json({ success: false, error: pwdVal.message });
      }
    }
    const password = rawPassword ? hashPassword(rawPassword) : null;
    const role = body.role || "Viewer";
    const region = body.region || "Region V (Bicol)";
    const status = body.status || "active";
    const isFocal = body.isFocal ? 1 : 0;
    const focalProject = body.focalProject || null;
    const pnpkiRole = body.pnpkiRole || null;
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
              SET name = ?, password = COALESCE(NULLIF(?, ''), password), role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, pnpkiRole = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updatedAt = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          name,
          password,
          role,
          region,
          status,
          isFocal,
          focalProject,
          pnpkiRole,
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
              SET name = ?, password = COALESCE(NULLIF(?, ''), password), role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, pnpkiRole = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? OR LOWER(email) = LOWER(?)`,
        args: [
          name,
          password,
          role,
          region,
          status,
          isFocal,
          focalProject,
          pnpkiRole,
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
            (id, name, email, password, role, region, status, isFocal, focalProject, pnpkiRole, focalProvince, phone, access, canEdit, canDelete, lastLogin, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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
        pnpkiRole,
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
            (id, name, email, password, auth_provider, role, region, status, isFocal, focalProject, pnpkiRole, focalProvince, phone, access, canEdit, canDelete, lastLogin, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
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
        pnpkiRole,
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
        sql: "SELECT * FROM administration WHERE id = ? OR LOWER(email) = LOWER(?)",
        args: [String(callerId), String(callerId)],
      });
      if (callerRes.rows.length > 0) {
        const caller: any = callerRes.rows[0];
        const isSuperAdminOrDirector =
          caller.role === "Super Admin" ||
          caller.role === "Admin" ||
          caller.role === "Regional Director" ||
          caller.role === "OIC- Regional Director" ||
          caller.role === "Asst. Regional Director" ||
          caller.role === "Assistant Regional Director" ||
          caller.role === "OIC Chief - Technical Operations Division" ||
          caller.canEdit === 1 ||
          caller.canEdit === true;
        if (!isSuperAdminOrDirector && String(caller.id) !== String(id)) {
          return res.status(403).json({
            success: false,
            error: "Access Denied: You do not have permission to modify other personnel accounts.",
          });
        }
      }
    }

    const cleanEmailParam = body.email ? String(body.email).trim().toLowerCase() : String(id).trim().toLowerCase();
    const existing = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1",
      args: [String(id), cleanEmailParam],
    });

    if (existing.rows.length === 0) {
      // If user does not exist yet in administration table (e.g. from local defaults), insert them cleanly
      const newId = String(id).startsWith("usr-") ? String(id) : `usr-${Date.now().toString(36)}`;
      const insName = (body.name || "DICT Personnel").trim();
      const insEmail = (body.email || "").trim().toLowerCase();
      const insRole = body.role || "PDO I";
      const insRegion = body.region || "Region V (Bicol)";
      const insStatus = body.status || "active";
      const insFocal = body.isFocal ? 1 : 0;
      const insFocalProject = body.focalProject || null;
      const insPnpkiRole = body.pnpkiRole || null;
      const insFocalProvince = body.focalProvince || null;
      const insPhone = body.phone || null;
      const insAccess = JSON.stringify(body.access || {});
      const insCanEdit = body.canEdit !== undefined ? (body.canEdit ? 1 : 0) : 1;
      const insCanDelete = body.canDelete !== undefined ? (body.canDelete ? 1 : 0) : 0;

      await db.execute({
        sql: `INSERT INTO administration 
              (id, name, email, role, region, status, isFocal, focalProject, pnpkiRole, focalProvince, phone, access, canEdit, canDelete, lastLogin, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Just updated', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        args: [
          newId,
          insName,
          insEmail,
          insRole,
          insRegion,
          insStatus,
          insFocal,
          insFocalProject,
          insPnpkiRole,
          insFocalProvince,
          insPhone,
          insAccess,
          insCanEdit,
          insCanDelete,
        ],
      });

      const created = await db.execute({
        sql: "SELECT * FROM administration WHERE id = ?",
        args: [newId],
      });
      return res.json({ success: true, user: formatAdminRow(created.rows[0]) });
    }

    const current: any = existing.rows[0];
    const targetId = String(current.id);
    const name = body.name !== undefined ? String(body.name).trim() : current.name;
    const email = body.email ? String(body.email).trim().toLowerCase() : current.email;
    const rawNewPassword =
      body.password !== undefined && body.password !== null && String(body.password).trim() !== ""
        ? String(body.password).trim()
        : null;
    if (rawNewPassword) {
      const pwdVal = validatePasswordStrength(rawNewPassword);
      if (!pwdVal.valid) {
        return res.status(400).json({ success: false, error: pwdVal.message });
      }
    }
    const password = rawNewPassword ? hashPassword(rawNewPassword) : current.password;
    const role = body.role !== undefined ? body.role : current.role;
    const region = body.region !== undefined ? body.region : current.region;
    const status = body.status !== undefined ? body.status : current.status;
    const isFocal = body.isFocal !== undefined ? (body.isFocal ? 1 : 0) : current.isFocal;
    const focalProject =
      isFocal === 0
        ? null
        : "focalProject" in body
        ? body.focalProject && body.focalProject !== "all_projects" && body.focalProject !== "none"
          ? body.focalProject
          : null
        : current.focalProject;
    const pnpkiRole =
      isFocal === 0
        ? null
        : "pnpkiRole" in body
        ? body.pnpkiRole || null
        : focalProject === "pnpki"
        ? current.pnpkiRole || null
        : null;
    const focalProvince =
      "focalProvince" in body ? body.focalProvince || null : current.focalProvince || null;
    const phone = "phone" in body ? body.phone || null : current.phone;
    const access = body.access !== undefined ? JSON.stringify(body.access) : current.access;
    const canEdit = body.canEdit !== undefined ? (body.canEdit ? 1 : 0) : current.canEdit;
    const canDelete = body.canDelete !== undefined ? (body.canDelete ? 1 : 0) : current.canDelete;

    await db.execute({
      sql: `UPDATE administration 
            SET name = ?, email = ?, password = COALESCE(NULLIF(?, ''), password), role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, pnpkiRole = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updatedAt = CURRENT_TIMESTAMP
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
        pnpkiRole,
        focalProvince,
        phone,
        access,
        canEdit,
        canDelete,
        targetId,
      ],
    });

    // Mirror update to users table without wiping existing password if omitted
    await db.execute({
      sql: `UPDATE users 
            SET name = ?, email = ?, password = COALESCE(NULLIF(?, ''), password), role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, pnpkiRole = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? OR LOWER(email) = LOWER(?)`,
      args: [
        name,
        email,
        password,
        role,
        region,
        status,
        isFocal,
        focalProject,
        pnpkiRole,
        focalProvince,
        phone,
        access,
        canEdit,
        canDelete,
        targetId,
        email,
      ],
    }).catch(() => {});

    const updated = await db.execute({
      sql: "SELECT * FROM administration WHERE id = ?",
      args: [targetId],
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
    const targetProj = String(projectId || "")
      .trim()
      .toLowerCase()
      .replace(/^mod_/, "")
      .replace(/^mod-/, "");
    const userProj = String(user.focalProject || "")
      .trim()
      .toLowerCase()
      .replace(/^mod_/, "")
      .replace(/^mod-/, "");
    const isExecutive =
      user.role === "Super Admin" ||
      user.role === "Admin" ||
      user.role === "Regional Director" ||
      user.role === "Asst. Regional Director" ||
      user.role === "Assistant Regional Director";
    const hasAccess = isExecutive || Boolean(user.access?.[targetProj] || user.access?.[`MOD_${targetProj.toUpperCase()}`]);
    const matchesSelectedProject =
      userProj && userProj !== "all_projects"
        ? userProj === targetProj
        : userProj === "all_projects" || isExecutive;
    const canModify = hasAccess && user.canEdit && user.status === "active" && matchesSelectedProject;

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
        focalProject: user.focalProject,
        pnpkiRole: user.pnpkiRole,
      },
      projectId,
      hasAccess,
      canModify,
      canDelete: canModify && (isExecutive || user.canDelete),
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
