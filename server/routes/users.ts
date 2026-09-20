import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { PROJECTS } from "../../src/config/projects.js";

export const usersRouter = Router();

// Helper to format user record from Turso row
function formatUserRow(row: any) {
  let parsedAccess: Record<string, boolean> = {};
  try {
    parsedAccess = typeof row.access === "string" ? JSON.parse(row.access) : (row.access || {});
  } catch {
    parsedAccess = {};
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password ? String(row.password) : undefined,
    hasPassword: Boolean(row.password),
    auth_provider: row.auth_provider || (row.email?.toLowerCase().endsWith("@gmail.com") ? "google" : "local"),
    authProvider: row.auth_provider || (row.email?.toLowerCase().endsWith("@gmail.com") ? "google" : "local"),
    google_id: row.google_id || null,
    avatar_url: row.avatar_url || null,
    role: row.role || "Viewer",
    region: row.region || "Region V (Bicol)",
    status: row.status || "active",
    isFocal: Boolean(row.isFocal),
    focalProject: row.focalProject || null,
    focalProvince: row.focalProvince || null,
    phone: row.phone || null,
    access: parsedAccess,
    canEdit: Boolean(row.canEdit),
    canDelete: Boolean(row.canDelete),
    lastLogin: row.lastLogin || null,
    created_at: row.created_at || row.createdAt || null,
    updated_at: row.updated_at || row.updatedAt || null,
  };
}

// ----------------------------------------------------------------------------
// 1. AUTHENTICATION & CREDENTIAL PERSISTENCE ENDPOINTS
// ----------------------------------------------------------------------------

// POST /api/users/login (or /api/auth/login) - Authenticate local email + password
usersRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    if (!password || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ success: false, error: "Password is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // Check users table (or fallback to administration table)
    let userResult = await db.execute({
      sql: "SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
      args: [cleanEmail, cleanEmail],
    });

    if (userResult.rows.length === 0) {
      userResult = await db.execute({
        sql: "SELECT * FROM administration WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
        args: [cleanEmail, cleanEmail],
      });
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Access Denied: Account "${email}" is not registered in the system.`,
      });
    }

    const user: any = userResult.rows[0];

    if (user.status === "inactive") {
      return res.status(403).json({
        success: false,
        error: `Access Denied: The account for ${user.name} is currently deactivated.`,
      });
    }

    // Verify password if user has password set
    if (!user.password || !String(user.password).trim()) {
      return res.status(400).json({
        success: false,
        error: `Account "${user.email}" is registered for GovMail Google SSO. Please click "Sign in with Google / Gmail" to log in.`,
      });
    }

    if (String(user.password).trim() !== cleanPassword) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password. Please verify your credentials or sign in with Google.",
      });
    }

    // Update lastLogin timestamp in database
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    await db.execute({
      sql: "UPDATE users SET lastLogin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [`${nowStr} (Local Login)`, user.id],
    }).catch(() => {});

    await db.execute({
      sql: "UPDATE administration SET lastLogin = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      args: [`${nowStr} (Local Login)`, user.id],
    }).catch(() => {});

    return res.json({
      success: true,
      message: "Login successful",
      user: formatUserRow({ ...user, lastLogin: `${nowStr} (Local Login)` }),
    });
  } catch (error: any) {
    console.error("Error during user login:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users/register (or /api/auth/register) - Register a new account with email + password
usersRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, region } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Full Name is required" });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    if (!password || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ success: false, error: "Password is required" });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const cleanRole = role || "Viewer";
    const cleanRegion = region || "Region V (Bicol)";

    // Check if email already registered
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE LOWER(email) = LOWER(?)",
      args: [cleanEmail],
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: `An account with email "${cleanEmail}" already exists. Please log in instead.`,
      });
    }

    const userId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const defaultAccess = JSON.stringify(PROJECTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}));
    const canEdit = cleanRole === "Viewer" ? 0 : 1;
    const canDelete = cleanRole === "Super Admin" || cleanRole === "Regional Director" ? 1 : 0;
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    // Insert into users table
    await db.execute({
      sql: `INSERT INTO users (id, name, email, password, auth_provider, role, region, status, isFocal, access, canEdit, canDelete, lastLogin, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'local', ?, ?, 'active', 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        userId,
        cleanName,
        cleanEmail,
        cleanPassword,
        cleanRole,
        cleanRegion,
        defaultAccess,
        canEdit,
        canDelete,
        `Created on ${nowStr}`,
      ],
    });

    // Also mirror to administration table for backwards compatibility
    await db.execute({
      sql: `INSERT OR REPLACE INTO administration (id, name, email, password, auth_provider, role, region, status, isFocal, access, canEdit, canDelete, lastLogin, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'local', ?, ?, 'active', 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        userId,
        cleanName,
        cleanEmail,
        cleanPassword,
        cleanRole,
        cleanRegion,
        defaultAccess,
        canEdit,
        canDelete,
        `Created on ${nowStr}`,
      ],
    }).catch(() => {});

    const created = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userId],
    });

    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      user: formatUserRow(created.rows[0]),
    });
  } catch (error: any) {
    console.error("Error creating user account:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/users/google-sync (or /api/auth/google-sync) - Save / sync Google OAuth account credentials to DB
usersRouter.post("/google-sync", async (req: Request, res: Response) => {
  try {
    const { google_id, email, name, avatar_url } = req.body || {};
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ success: false, error: "GovMail / Google email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanGoogleId = google_id ? String(google_id).trim() : null;
    const cleanAvatar = avatar_url ? String(avatar_url).trim() : null;
    const nowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });

    // Look up existing user by exact email in users table or administration table
    let userRecord: any = null;

    const userRes = await db.execute({
      sql: "SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
      args: [cleanEmail],
    });

    if (userRes.rows.length > 0) {
      userRecord = userRes.rows[0];
    } else {
      const adminRes = await db.execute({
        sql: "SELECT * FROM administration WHERE LOWER(email) = LOWER(?) LIMIT 1",
        args: [cleanEmail],
      });
      if (adminRes.rows.length > 0) {
        userRecord = adminRes.rows[0];
      }
    }

    // Also check prefix matching if user logged in with @gmail.com or @dict.gov.ph alias
    if (!userRecord) {
      const usernamePrefix = cleanEmail.split("@")[0];
      const prefixRes = await db.execute({
        sql: "SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
        args: [`${usernamePrefix}@dict.gov.ph`, `${usernamePrefix}@gmail.com`],
      });
      if (prefixRes.rows.length > 0) {
        userRecord = prefixRes.rows[0];
      } else {
        const adminPrefixRes = await db.execute({
          sql: "SELECT * FROM administration WHERE LOWER(email) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
          args: [`${usernamePrefix}@dict.gov.ph`, `${usernamePrefix}@gmail.com`],
        });
        if (adminPrefixRes.rows.length > 0) {
          userRecord = adminPrefixRes.rows[0];
        }
      }
    }

    // STRICT ACCESS CONTROL: If the GovMail is NOT registered in the database, reject access!
    if (!userRecord) {
      return res.status(403).json({
        success: false,
        error: `Access Denied: The GovMail address "${cleanEmail}" is not registered in the system. Only authorized personnel registered by an administrator can log in.`,
      });
    }

    // Verify account status
    if (userRecord.status === "inactive") {
      return res.status(403).json({
        success: false,
        error: `Access Denied: The account for ${userRecord.name} (${cleanEmail}) is currently deactivated.`,
      });
    }

    // Update Google metadata and last login timestamp in DB
    await db.execute({
      sql: `UPDATE users 
            SET auth_provider = 'google',
                google_id = COALESCE(?, google_id),
                avatar_url = COALESCE(?, avatar_url),
                lastLogin = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [cleanGoogleId, cleanAvatar, `Just now (GovMail SSO - ${nowStr})`, userRecord.id],
    }).catch(() => {});

    await db.execute({
      sql: `UPDATE administration 
            SET auth_provider = 'google',
                google_id = COALESCE(?, google_id),
                avatar_url = COALESCE(?, avatar_url),
                lastLogin = ?,
                updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [cleanGoogleId, cleanAvatar, `Just now (GovMail SSO - ${nowStr})`, userRecord.id],
    }).catch(() => {});

    const updated = await db.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [userRecord.id],
    });

    const finalUser = updated.rows.length > 0 ? updated.rows[0] : userRecord;

    return res.json({
      success: true,
      isNewUser: false,
      message: "GovMail SSO session authenticated successfully",
      user: formatUserRow({ ...finalUser, lastLogin: `Just now (GovMail SSO - ${nowStr})` }),
    });
  } catch (error: any) {
    console.error("Error syncing Google user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 2. USER MANAGEMENT CRUD ENDPOINTS
// ----------------------------------------------------------------------------

// GET /api/users - List all users
usersRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute("SELECT * FROM users ORDER BY created_at DESC");
    const users = result.rows.map(formatUserRow);
    return res.json({ success: true, count: users.length, users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/users/:id - Get single user
usersRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM users WHERE id = ? OR LOWER(email) = LOWER(?)",
      args: [id, id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.json({ success: true, user: formatUserRow(result.rows[0]) });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/users/:id - Update user record and permissions
usersRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const callerId = req.headers["x-user-id"] || body.callerId;

    if (callerId && String(callerId) !== String(id)) {
      const callerRes = await db.execute({
        sql: "SELECT * FROM users WHERE id = ? OR LOWER(email) = LOWER(?)",
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
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const current: any = existing.rows[0];
    const name = body.name ?? current.name;
    const email = body.email ? String(body.email).trim().toLowerCase() : current.email;
    const password = body.password !== undefined ? body.password : current.password;
    const auth_provider = body.auth_provider || body.authProvider || current.auth_provider;
    const google_id = body.google_id !== undefined ? body.google_id : current.google_id;
    const avatar_url = body.avatar_url !== undefined ? body.avatar_url : current.avatar_url;
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
      sql: `UPDATE users 
            SET name = ?, email = ?, password = ?, auth_provider = ?, google_id = ?, avatar_url = ?, role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        name,
        email,
        password,
        auth_provider,
        google_id,
        avatar_url,
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

    // Also mirror to administration table
    await db.execute({
      sql: `UPDATE administration 
            SET name = ?, email = ?, password = ?, auth_provider = ?, google_id = ?, avatar_url = ?, role = ?, region = ?, status = ?, isFocal = ?, focalProject = ?, focalProvince = ?, phone = ?, access = ?, canEdit = ?, canDelete = ?, updatedAt = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        name,
        email,
        password,
        auth_provider,
        google_id,
        avatar_url,
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
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });

    return res.json({ success: true, user: formatUserRow(updated.rows[0]) });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/users/:id - Delete user record
usersRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const callerId = req.headers["x-user-id"] || req.query.callerId;

    if (callerId) {
      const callerRes = await db.execute({
        sql: "SELECT * FROM users WHERE id = ? OR LOWER(email) = LOWER(?)",
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
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id],
    });
    if (checkTarget.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM administration WHERE id = ?", args: [id] }).catch(() => {});

    return res.json({ success: true, id });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
