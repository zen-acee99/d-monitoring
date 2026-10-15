import { Router, Request, Response } from "express";
import { db } from "../db.js";
import { encryptP12Password, decryptP12Password } from "../services/pnpkiSigningService.js";

export const dtrUserSetupRouter = Router();

// Helper to format a row
function formatDtrUserSetupRow(row: any, includeSecret = true) {
  const decryptedOtcPassword =
    includeSecret && row.otc_password ? decryptP12Password(String(row.otc_password)) : "";

  return {
    id: row.id,
    userId: row.user_id,
    user_id: row.user_id,
    employeeName: row.employee_name || "",
    employee_name: row.employee_name || "",
    province: row.province || "Regional Office (RO)",
    supervisorName: row.supervisor_name || "NORLY A. TABO",
    supervisor_name: row.supervisor_name || "NORLY A. TABO",
    supervisorTitle: row.supervisor_title || "OIC Chief - Technical Operations Division",
    supervisor_title: row.supervisor_title || "OIC Chief - Technical Operations Division",
    selectedOfficerOption: row.selected_officer_option || "norly-tabo",
    selected_officer_option: row.selected_officer_option || "norly-tabo",
    regularHours: row.regular_hours || "",
    regular_hours: row.regular_hours || "",
    saturdayHours: row.saturday_hours || "",
    saturday_hours: row.saturday_hours || "",
    periodText: row.period_text || "",
    period_text: row.period_text || "",
    otcUsername: row.otc_username || "",
    otc_username: row.otc_username || "",
    otcPassword: decryptedOtcPassword,
    otc_password: decryptedOtcPassword,
    hasOtcPassword: Boolean(row.otc_password),
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  };
}

// Helper to verify caller is resource owner or administrator (prevents IDOR)
async function isCallerOwnerOrAdmin(callerId: string, targetUserId: string): Promise<boolean> {
  if (!callerId) return false;
  if (callerId === targetUserId || callerId === `setup-${targetUserId}`) return true;
  try {
    const adminRes = await db.execute({
      sql: "SELECT role FROM administration WHERE (id = ? OR LOWER(email) = LOWER(?)) AND status = 'active' LIMIT 1",
      args: [callerId, callerId],
    });
    if (adminRes.rows.length > 0) {
      const role = String(adminRes.rows[0].role || "");
      if (
        [
          "Super Admin",
          "Admin",
          "Regional Director",
          "Asst. Regional Director",
          "Assistant Regional Director",
        ].includes(role)
      ) {
        return true;
      }
    }
  } catch {}
  return false;
}

// GET /api/dtr-user-setup - List all saved setups (or query by user_id / employee_name)
dtrUserSetupRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { user_id, userId, employee_name, employeeName } = req.query;
    const callerUserId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]).trim() : "";
    const isCallerAdmin = callerUserId
      ? await isCallerOwnerOrAdmin(callerUserId, "__ADMIN_CHECK__")
      : false;

    let sql = "SELECT * FROM dtr_user_setup";
    const args: any[] = [];
    const conditions: string[] = [];

    const targetUserId = user_id || userId;
    if (targetUserId) {
      conditions.push("(user_id = ? OR id = ?)");
      args.push(String(targetUserId), `setup-${targetUserId}`);
    }

    const targetName = employee_name || employeeName;
    if (targetName && typeof targetName === "string" && targetName.trim()) {
      conditions.push("LOWER(employee_name) LIKE ?");
      args.push(`%${targetName.trim().toLowerCase()}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY updated_at DESC";

    const result = await db.execute({ sql, args });
    const setups = result.rows.map((row: any) => {
      const isOwner =
        Boolean(callerUserId) &&
        (String(row.user_id) === callerUserId || String(row.id) === `setup-${callerUserId}`);
      const includeSecret = isOwner || isCallerAdmin;
      return formatDtrUserSetupRow(row, includeSecret);
    });
    return res.json({ success: true, setups });
  } catch (error: any) {
    console.error("Error fetching dtr_user_setup records:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// GET /api/dtr-user-setup/:userId - Get saved setup by user_id or id
dtrUserSetupRouter.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const callerUserId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]).trim() : "";

    const result = await db.execute({
      sql: "SELECT * FROM dtr_user_setup WHERE user_id = ? OR id = ? OR id = ? LIMIT 1",
      args: [userId, userId, `setup-${userId}`],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "No saved setup found for this user" });
    }

    const includeSecret = await isCallerOwnerOrAdmin(callerUserId, userId);
    return res.json({ success: true, setup: formatDtrUserSetupRow(result.rows[0], includeSecret) });
  } catch (error: any) {
    console.error("Error fetching dtr_user_setup by userId:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// POST /api/dtr-user-setup - Upsert saved setup for a user
dtrUserSetupRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const userId = (body.userId || body.user_id || "").trim();
    const employeeName = (body.employeeName || body.employee_name || "").trim();

    if (!userId) {
      return res.status(400).json({ success: false, error: "user_id is required" });
    }
    if (!employeeName) {
      return res.status(400).json({ success: false, error: "employee_name is required" });
    }

    // IDOR Protection: Caller must either be the user or an active administrator
    const callerUserId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]).trim() : "";
    if (callerUserId) {
      const authorized = await isCallerOwnerOrAdmin(callerUserId, userId);
      if (!authorized) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: You cannot modify another personnel's setup.",
        });
      }
    }

    const id = body.id || `setup-${userId}`;
    const province = body.province || "Regional Office (RO)";
    const supervisorName = body.supervisorName || body.supervisor_name || "NORLY A. TABO";
    const supervisorTitle =
      body.supervisorTitle ||
      body.supervisor_title ||
      "OIC Chief - Technical Operations Division";
    const selectedOfficerOption =
      body.selectedOfficerOption || body.selected_officer_option || "norly-tabo";
    const regularHours = body.regularHours || body.regular_hours || "";
    const saturdayHours = body.saturdayHours || body.saturday_hours || "";
    const periodText = body.periodText || body.period_text || "";
    const otcUsername = (body.otcUsername || body.otc_username || "").trim();
    const otcPassword = (body.otcPassword || body.otc_password || "").trim();
    const encryptedOtcPassword = otcPassword ? encryptP12Password(otcPassword) : null;

    await db.execute({
      sql: `INSERT INTO dtr_user_setup (
              id, user_id, employee_name, province, supervisor_name, supervisor_title,
              selected_officer_option, regular_hours, saturday_hours, period_text,
              otc_username, otc_password, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              employee_name = excluded.employee_name,
              province = excluded.province,
              supervisor_name = excluded.supervisor_name,
              supervisor_title = excluded.supervisor_title,
              selected_officer_option = excluded.selected_officer_option,
              regular_hours = excluded.regular_hours,
              saturday_hours = excluded.saturday_hours,
              period_text = excluded.period_text,
              otc_username = COALESCE(NULLIF(excluded.otc_username, ''), dtr_user_setup.otc_username),
              otc_password = COALESCE(NULLIF(excluded.otc_password, ''), dtr_user_setup.otc_password),
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        id,
        userId,
        employeeName,
        province,
        supervisorName,
        supervisorTitle,
        selectedOfficerOption,
        regularHours,
        saturdayHours,
        periodText,
        otcUsername || null,
        encryptedOtcPassword,
      ],
    });

    const result = await db.execute({
      sql: "SELECT * FROM dtr_user_setup WHERE user_id = ? LIMIT 1",
      args: [userId],
    });

    const saved = result.rows.length > 0 ? formatDtrUserSetupRow(result.rows[0], true) : null;
    return res.json({ success: true, message: "Personnel setup saved successfully", setup: saved });
  } catch (error: any) {
    console.error("Error upserting dtr_user_setup:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// DELETE /api/dtr-user-setup/:userId - Delete saved setup
dtrUserSetupRouter.delete("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const callerUserId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]).trim() : "";

    // IDOR Protection: Caller must either be the user or an active administrator
    if (callerUserId) {
      const authorized = await isCallerOwnerOrAdmin(callerUserId, userId);
      if (!authorized) {
        return res.status(403).json({
          success: false,
          error: "Access Denied: You cannot delete another personnel's setup.",
        });
      }
    }

    await db.execute({
      sql: "DELETE FROM dtr_user_setup WHERE user_id = ? OR id = ? OR id = ?",
      args: [userId, userId, `setup-${userId}`],
    });
    return res.json({ success: true, message: "Setup removed successfully" });
  } catch (error: any) {
    console.error("Error deleting dtr_user_setup:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});
