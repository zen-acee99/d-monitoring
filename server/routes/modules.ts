import { Router, Request, Response } from "express";
import { db } from "../db.js";

export const modulesRouter = Router();

// Helper to format a module database row
function formatModuleRow(row: any) {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    shortName: row.shortName || undefined,
    category: String(row.category || "Project"),
    description: row.description || "",
    route_path: row.route_path || "",
    is_active: Boolean(row.is_active === 1 || row.is_active === true),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/modules - List all system modules
modulesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(
      "SELECT * FROM module ORDER BY category ASC, name ASC"
    );
    const modules = result.rows.map(formatModuleRow);
    return res.json({ success: true, modules });
  } catch (error: any) {
    console.error("Error fetching modules:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/modules/:idOrCode - Get single module by ID or Code
modulesRouter.get("/:idOrCode", async (req: Request, res: Response) => {
  try {
    const { idOrCode } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM module WHERE id = ? OR code = ? OR UPPER(code) = UPPER(?)",
      args: [idOrCode, idOrCode, idOrCode],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    return res.json({ success: true, module: formatModuleRow(result.rows[0]) });
  } catch (error: any) {
    console.error("Error fetching module:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/modules - Add a new module
modulesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let code = (body.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, error: "Module Code is required" });
    }
    if (!code.startsWith("MOD_")) {
      code = `MOD_${code.replace(/[^A-Z0-9_]/g, "_")}`;
    }

    const name = (body.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Module Name is required" });
    }

    const id = body.id || `mod-${code.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString(36).slice(-4)}`;
    const shortName = body.shortName?.trim() || null;
    const category = body.category?.trim() || "Project";
    const description = body.description?.trim() || null;
    const route_path = body.route_path?.trim() || null;
    const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;

    // Check for existing code
    const existing = await db.execute({
      sql: "SELECT id FROM module WHERE code = ? OR id = ?",
      args: [code, id],
    });
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: `Module code "${code}" already exists` });
    }

    await db.execute({
      sql: `INSERT INTO module (id, code, name, shortName, category, description, route_path, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, code, name, shortName, category, description, route_path, is_active],
    });

    const inserted = await db.execute({
      sql: "SELECT * FROM module WHERE id = ?",
      args: [id],
    });

    return res.status(201).json({
      success: true,
      module: formatModuleRow(inserted.rows[0]),
    });
  } catch (error: any) {
    console.error("Error creating module:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/modules/:id - Update module details
modulesRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const existing = await db.execute({
      sql: "SELECT * FROM module WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    const current = existing.rows[0];
    const code = body.code ? body.code.trim().toUpperCase() : current.code;
    const name = body.name ? body.name.trim() : current.name;
    const shortName = body.shortName !== undefined ? (body.shortName?.trim() || null) : current.shortName;
    const category = body.category ? body.category.trim() : current.category;
    const description = body.description !== undefined ? (body.description?.trim() || null) : current.description;
    const route_path = body.route_path !== undefined ? (body.route_path?.trim() || null) : current.route_path;
    const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : current.is_active;

    await db.execute({
      sql: `UPDATE module 
            SET code = ?, name = ?, shortName = ?, category = ?, description = ?, route_path = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [code, name, shortName, category, description, route_path, is_active, id],
    });

    const updated = await db.execute({
      sql: "SELECT * FROM module WHERE id = ?",
      args: [id],
    });

    return res.json({
      success: true,
      module: formatModuleRow(updated.rows[0]),
    });
  } catch (error: any) {
    console.error("Error updating module:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/modules/:id/toggle - Toggle active / deactive status
modulesRouter.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.execute({
      sql: "SELECT id, is_active FROM module WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    const currentStatus = Number(existing.rows[0].is_active || 0);
    const newStatus = currentStatus === 1 ? 0 : 1;

    await db.execute({
      sql: "UPDATE module SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [newStatus, id],
    });

    const updated = await db.execute({
      sql: "SELECT * FROM module WHERE id = ?",
      args: [id],
    });

    return res.json({
      success: true,
      module: formatModuleRow(updated.rows[0]),
      message: `Module is now ${newStatus === 1 ? "Active" : "Deactivated"}`,
    });
  } catch (error: any) {
    console.error("Error toggling module status:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/modules/:id - Delete a module
modulesRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.execute({
      sql: "SELECT id, code FROM module WHERE id = ?",
      args: [id],
    });

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Module not found" });
    }

    await db.execute({
      sql: "DELETE FROM module WHERE id = ?",
      args: [id],
    });

    return res.json({ success: true, message: `Module ${existing.rows[0].code} deleted` });
  } catch (error: any) {
    console.error("Error deleting module:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
