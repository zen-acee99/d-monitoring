import { Router, Request, Response } from "express";
import { db } from "../db.js";

export const dtrStorageRouter = Router();

// Realtime SSE connected clients across all browser tabs and profiles
const realtimeClients = new Set<Response>();

export function broadcastDtrRealtimeEvent(event: {
  type: "INSERT" | "UPDATE" | "DELETE";
  record?: any;
  id?: string;
}) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of realtimeClients) {
    try {
      client.write(payload);
    } catch {
      realtimeClients.delete(client);
    }
  }
}

// GET /api/dtr-storage/events - Realtime SSE stream for instant multi-tab & multi-client sync
dtrStorageRouter.get("/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  realtimeClients.add(res);

  // Initial connection handshake
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: new Date().toISOString() })}\n\n`);

  // Periodic heartbeat to prevent timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      realtimeClients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    realtimeClients.delete(res);
  });
});

function formatDtrStorageRow(row: any) {
  let parsedRows: any[] = [];
  try {
    if (row.rows_json) {
      parsedRows = JSON.parse(row.rows_json);
    }
  } catch {}

  return {
    id: row.id,
    userId: row.user_id || "",
    employeeName: row.employee_name || "",
    employeeId: row.employee_id || "",
    position: row.position || "",
    employmentStatus: row.employment_status || "Regular",
    module: row.module || "PROVINCIAL",
    province: row.province || undefined,
    sectionDivision: row.section_division || "",
    periodText: row.period_text || "",
    month: Number(row.month) || 0,
    year: Number(row.year) || 2026,
    scope: row.scope || "full",
    regularHours: row.regular_hours || "",
    saturdayHours: row.saturday_hours || "",
    supervisorName: row.supervisor_name || "",
    supervisorTitle: row.supervisor_title || "",
    signerName: row.signer_name || undefined,
    employeeSignatureImage: row.employee_signature_image || undefined,
    employeeHasP12: Boolean(row.employee_has_p12),
    employeeSignerName: row.employee_signer_name || undefined,
    supervisorSignatureImage: row.supervisor_signature_image || undefined,
    supervisorHasP12: Boolean(row.supervisor_has_p12),
    totalDaysRendered: Number(row.total_days_rendered) || 0,
    totalHoursRendered: Number(row.total_hours_rendered) || 0,
    undertimeHours: Number(row.undertime_hours) || 0,
    undertimeMinutes: Number(row.undertime_minutes) || 0,
    status: row.status || "Submitted",
    submittedDate: row.submitted_date || "",
    pdfFileName: row.pdf_filename || "",
    pdfFileSize: row.pdf_filesize || "",
    pdfDataUrl: row.pdf_data || undefined,
    hasP12: Boolean(row.has_p12 || row.employee_has_p12),
    signatureImage: row.signature_image || row.employee_signature_image || undefined,
    rows: parsedRows,
    docType: row.doc_type || (row.pdf_filename?.toUpperCase().startsWith("AR_") ? "AR" : "DTR"),
    remarks: row.remarks || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/dtr-storage - List stored DTR records
dtrStorageRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { module, province, user_id, status, search } = req.query;
    let sql = `SELECT 
      id, user_id, employee_name, employee_id, position, employment_status,
      module, province, section_division, period_text, month, year, scope,
      regular_hours, saturday_hours, supervisor_name, supervisor_title,
      total_days_rendered, total_hours_rendered, undertime_hours, undertime_minutes,
      status, submitted_date, pdf_filename, pdf_filesize,
      has_p12, signature_image, signer_name,
      employee_signature_image, employee_has_p12, employee_signer_name,
      supervisor_signature_image, supervisor_has_p12,
      rows_json, doc_type, remarks, created_at, updated_at
    FROM dtr_storage`;
    const args: any[] = [];
    const conditions: string[] = [];

    if (module) {
      conditions.push("module = ?");
      args.push(String(module).toUpperCase());
    }

    if (province && province !== "ALL") {
      if (String(province).toLowerCase().includes("regional")) {
        conditions.push("(province LIKE '%Regional%' OR province LIKE '%RO%' OR province = 'Regional Off' OR province = 'Regional Office')");
      } else {
        conditions.push("LOWER(province) = LOWER(?)");
        args.push(String(province).trim());
      }
    }

    if (user_id) {
      conditions.push("user_id = ?");
      args.push(String(user_id));
    }

    if (status && status !== "All") {
      conditions.push("status = ?");
      args.push(String(status));
    }

    if (search) {
      const q = `%${String(search).trim()}%`;
      conditions.push("(employee_name LIKE ? OR employee_id LIKE ? OR position LIKE ? OR period_text LIKE ? OR pdf_filename LIKE ?)");
      args.push(q, q, q, q, q);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY created_at DESC, id DESC";

    const result = await db.execute({ sql, args });
    const records = result.rows.map(formatDtrStorageRow);
    return res.json({ success: true, records });
  } catch (error: any) {
    console.error("Error fetching dtr_storage records:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dtr-storage/:id - Get single record
dtrStorageRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM dtr_storage WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    return res.json({ success: true, record: formatDtrStorageRow(result.rows[0]) });
  } catch (error: any) {
    console.error("Error fetching dtr_storage record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dtr-storage - Create or upsert record with audit user_id tracking
dtrStorageRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const employeeName = (body.employeeName || body.employee_name || "PERSONNEL").trim().toUpperCase();

    const headerUserId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]).trim() : null;
    let cleanUserId = body.userId || body.user_id ? String(body.userId || body.user_id).trim() : headerUserId;

    // Audit Trailing: If cleanUserId is missing, attempt to look up from administration by name
    if (!cleanUserId && employeeName && employeeName !== "PERSONNEL") {
      try {
        const match = await db.execute({
          sql: "SELECT id FROM administration WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE ? LIMIT 1",
          args: [employeeName, `%${employeeName}%`],
        });
        if (match.rows.length > 0) {
          cleanUserId = String(match.rows[0].id);
        }
      } catch {}
    }

    const recordId = body.id || `DTR-${body.module || "PROV"}-${Date.now().toString().slice(-6)}`;
    const nowStr = new Date().toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const submittedDate = body.submittedDate || body.submitted_date || nowStr;
    const rowsJson = body.rows ? JSON.stringify(body.rows) : (body.rows_json || "[]");

    await db.execute({
      sql: `INSERT INTO dtr_storage (
              id, user_id, employee_name, employee_id, position, employment_status,
              module, province, section_division, period_text, month, year, scope,
              regular_hours, saturday_hours, supervisor_name, supervisor_title,
              total_days_rendered, total_hours_rendered, undertime_hours, undertime_minutes,
              status, submitted_date, pdf_filename, pdf_filesize, pdf_data,
              has_p12, signature_image, signer_name,
              employee_signature_image, employee_has_p12, employee_signer_name,
              supervisor_signature_image, supervisor_has_p12,
              rows_json, doc_type, remarks, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              ?, ?, ?,
              ?, ?, ?,
              ?, ?,
              ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
            ON CONFLICT(id) DO UPDATE SET
              user_id = COALESCE(excluded.user_id, dtr_storage.user_id),
              employee_name = excluded.employee_name,
              employee_id = excluded.employee_id,
              position = excluded.position,
              employment_status = excluded.employment_status,
              module = excluded.module,
              province = excluded.province,
              section_division = excluded.section_division,
              period_text = excluded.period_text,
              month = excluded.month,
              year = excluded.year,
              scope = excluded.scope,
              regular_hours = excluded.regular_hours,
              saturday_hours = excluded.saturday_hours,
              supervisor_name = excluded.supervisor_name,
              supervisor_title = excluded.supervisor_title,
              total_days_rendered = excluded.total_days_rendered,
              total_hours_rendered = excluded.total_hours_rendered,
              undertime_hours = excluded.undertime_hours,
              undertime_minutes = excluded.undertime_minutes,
              status = excluded.status,
              submitted_date = excluded.submitted_date,
              pdf_filename = excluded.pdf_filename,
              pdf_filesize = excluded.pdf_filesize,
              pdf_data = COALESCE(excluded.pdf_data, dtr_storage.pdf_data),
              has_p12 = excluded.has_p12,
              signature_image = COALESCE(excluded.signature_image, dtr_storage.signature_image),
              signer_name = COALESCE(excluded.signer_name, dtr_storage.signer_name),
              employee_signature_image = COALESCE(excluded.employee_signature_image, dtr_storage.employee_signature_image),
              employee_has_p12 = COALESCE(excluded.employee_has_p12, dtr_storage.employee_has_p12),
              employee_signer_name = COALESCE(excluded.employee_signer_name, dtr_storage.employee_signer_name),
              supervisor_signature_image = COALESCE(excluded.supervisor_signature_image, dtr_storage.supervisor_signature_image),
              supervisor_has_p12 = COALESCE(excluded.supervisor_has_p12, dtr_storage.supervisor_has_p12),
              rows_json = excluded.rows_json,
              doc_type = COALESCE(excluded.doc_type, dtr_storage.doc_type),
              remarks = excluded.remarks,
              updated_at = CURRENT_TIMESTAMP`,
      args: [
        recordId,
        cleanUserId,
        employeeName,
        body.employeeId || body.employee_id || `DICT-R5-${body.year || 2026}-${Math.floor(100 + Math.random() * 900)}`,
        body.position || "Technical Specialist / Engineer",
        body.employmentStatus || body.employment_status || "Regular",
        (body.module || "PROVINCIAL").toUpperCase(),
        body.province || null,
        body.sectionDivision || body.section_division || (body.province ? `${body.province} Provincial Operations` : "Regional Operations (RO)"),
        body.periodText || body.period_text || "AUGUST 01-31, 2026",
        body.month !== undefined ? Number(body.month) : 7,
        body.year !== undefined ? Number(body.year) : 2026,
        body.scope || "full",
        body.regularHours || body.regular_hours || "",
        body.saturdayHours || body.saturday_hours || "",
        body.supervisorName || body.supervisor_name || "NORLY A. TABO",
        body.supervisorTitle || body.supervisor_title || "OIC Chief - Technical Operations Division",
        Number(body.totalDaysRendered || body.total_days_rendered) || 0,
        Number(body.totalHoursRendered || body.total_hours_rendered) || 0,
        Number(body.undertimeHours || body.undertime_hours) || 0,
        Number(body.undertimeMinutes || body.undertime_minutes) || 0,
        body.status || "Submitted",
        submittedDate,
        body.pdfFileName || body.pdf_filename || `DTR_${employeeName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        body.pdfFileSize || body.pdf_filesize || "325 KB",
        body.pdfDataUrl || body.pdf_data || null,
        body.hasP12 ? 1 : 0,
        body.signatureImage || body.signature_image || null,
        body.signerName || body.signer_name || null,
        body.employeeSignatureImage || body.employee_signature_image || body.signatureImage || null,
        body.employeeHasP12 !== undefined ? (body.employeeHasP12 ? 1 : 0) : (body.hasP12 ? 1 : 0),
        body.employeeSignerName || body.employee_signer_name || employeeName,
        body.supervisorSignatureImage || body.supervisor_signature_image || null,
        body.supervisorHasP12 ? 1 : 0,
        rowsJson,
        body.docType || body.doc_type || (body.pdfFileName?.toUpperCase().startsWith("AR_") ? "AR" : "DTR"),
        body.remarks || `Generated for ${body.province || "Regional Office"}`,
      ],
    });

    const saved = await db.execute({
      sql: "SELECT * FROM dtr_storage WHERE id = ?",
      args: [recordId],
    });

    const formattedRecord = formatDtrStorageRow(saved.rows[0]);

    // Broadcast INSERT realtime event to all connected browser clients & profiles
    broadcastDtrRealtimeEvent({
      type: "INSERT",
      record: formattedRecord,
      id: formattedRecord.id,
    });

    return res.json({
      success: true,
      message: "DTR record saved to storage repository with audit tracking",
      record: formattedRecord,
    });
  } catch (error: any) {
    console.error("Error saving dtr_storage record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/dtr-storage/:id - Update status or remarks
dtrStorageRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    await db.execute({
      sql: `UPDATE dtr_storage 
            SET status = COALESCE(?, status),
                remarks = COALESCE(?, remarks),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [status || null, remarks || null, id],
    });

    const updated = await db.execute({
      sql: "SELECT * FROM dtr_storage WHERE id = ?",
      args: [id],
    });

    if (updated.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    const formattedRecord = formatDtrStorageRow(updated.rows[0]);

    // Broadcast UPDATE realtime event to all connected browser clients & profiles
    broadcastDtrRealtimeEvent({
      type: "UPDATE",
      record: formattedRecord,
      id: formattedRecord.id,
    });

    return res.json({
      success: true,
      record: formattedRecord,
    });
  } catch (error: any) {
    console.error("Error updating dtr_storage record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/dtr-storage/:id - Delete record
dtrStorageRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: "DELETE FROM dtr_storage WHERE id = ?",
      args: [id],
    });

    // Broadcast DELETE realtime event to all connected browser clients & profiles
    broadcastDtrRealtimeEvent({
      type: "DELETE",
      id,
    });

    return res.json({ success: true, message: "DTR storage record deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting dtr_storage record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
