import { Router, Request, Response } from "express";
import { db } from "../db.js";

export const signingWorkspaceRouter = Router();

// Connected clients for Realtime SSE across all browser tabs
const sseClients = new Set<Response>();

export function broadcastSigningWorkspaceEvent(event: {
  type: "INSERT" | "UPDATE" | "DELETE" | "BULK_DELETE" | "BATCH";
  record?: any;
  id?: string;
  ids?: string[];
  batchCount?: number;
}) {
  let eventToSend = event;
  if (event.record && (event.record.pdfDataUrl || event.record.pdf_data)) {
    const { pdfDataUrl, pdf_data, ...leanRecord } = event.record;
    eventToSend = { ...event, record: leanRecord };
  }
  const payload = `data: ${JSON.stringify(eventToSend)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// GET /api/signing-workspace/events - Realtime SSE stream
signingWorkspaceRouter.get("/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sseClients.add(res);
  res.write(`data: ${JSON.stringify({ type: "CONNECTED", timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

function formatSigningDocRow(row: any, includePdf = false) {
  let requiredSigners: string[] = [];
  try {
    if (row.required_signers) {
      requiredSigners = JSON.parse(row.required_signers);
    }
  } catch {}

  let signers: any[] = [];
  try {
    if (row.signers_matrix) {
      signers = JSON.parse(row.signers_matrix);
    }
  } catch {}

  let scannedInfo: any = null;
  try {
    if (row.scanned_info) {
      scannedInfo = JSON.parse(row.scanned_info);
    }
  } catch {}

  return {
    id: String(row.id),
    fileName: String(row.file_name || "Document.pdf"),
    fileSize: String(row.file_size || ""),
    uploadedAt: row.uploaded_at || row.created_at,
    uploadedBy: row.uploaded_by || "System",
    status: row.status || "pending",
    targetPersonnel: row.target_personnel || "PERSONNEL",
    requiredSigners,
    signers,
    scannedInfo,
    pdfDataUrl: includePdf ? (row.pdf_data || undefined) : undefined,
    province: row.province || "Regional Office",
    sectionDivision: row.section_division || "Regional Office V",
    notes: row.notes || "",
    hasP12: Boolean(row.has_p12),
    signatureImage: row.signature_image || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 1. GET /api/signing-workspace - List all documents (supports query filters)
signingWorkspaceRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { status, target_personnel, search } = req.query;
    const includePdf = req.query.include_pdf === "true";
    const pdfField = includePdf ? "pdf_data," : "";

    let sql = `SELECT 
      id, file_name, file_size, uploaded_at, uploaded_by,
      status, target_personnel, required_signers, signers_matrix, scanned_info, ${pdfField}
      province, section_division, notes, has_p12, signature_image,
      created_at, updated_at
    FROM signing_workspace_documents`;

    const args: any[] = [];
    const conditions: string[] = [];

    if (status && status !== "All") {
      conditions.push("status = ?");
      args.push(String(status));
    }

    if (target_personnel) {
      conditions.push("(target_personnel LIKE ? OR file_name LIKE ?)");
      const q = `%${String(target_personnel).trim()}%`;
      args.push(q, q);
    }

    if (search) {
      const q = `%${String(search).trim()}%`;
      conditions.push("(file_name LIKE ? OR target_personnel LIKE ? OR uploaded_by LIKE ? OR notes LIKE ?)");
      args.push(q, q, q, q);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY created_at DESC, id DESC";

    const result = await db.execute({ sql, args });
    const documents = result.rows.map((r) => formatSigningDocRow(r, includePdf));
    return res.json({ success: true, documents });
  } catch (error: any) {
    console.error("Error fetching signing workspace documents:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /api/signing-workspace/:id - Get single document with full PDF binary
signingWorkspaceRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: `SELECT * FROM signing_workspace_documents WHERE id = ? LIMIT 1`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }

    const document = formatSigningDocRow(result.rows[0], true);
    return res.json({ success: true, document });
  } catch (error: any) {
    console.error("Error fetching document:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /api/signing-workspace - Create or Upsert single document
signingWorkspaceRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id = String(body.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const fileName = String(body.fileName || body.file_name || body.pdfFileName || "Document.pdf");
    const fileSize = String(body.fileSize || body.file_size || body.pdfFileSize || "");
    const uploadedBy = String(body.uploadedBy || body.uploaded_by || "System");
    const status = String(body.status || "pending");
    const targetPersonnel = String(body.targetPersonnel || body.target_personnel || body.employeeName || "PERSONNEL");
    const requiredSignersStr = JSON.stringify(body.requiredSigners || body.required_signers || []);
    const signersMatrixStr = JSON.stringify(body.signers || body.signers_matrix || []);
    const scannedInfoStr = body.scannedInfo || body.scanned_info ? JSON.stringify(body.scannedInfo || body.scanned_info) : null;
    const pdfData = body.pdfDataUrl || body.pdf_data || body.pdfData || null;
    const province = String(body.province || "Regional Office");
    const sectionDivision = String(body.sectionDivision || body.section_division || "Regional Office V");
    const notes = String(body.notes || "");
    const hasP12 = body.hasP12 || body.has_p12 ? 1 : 0;
    const signatureImage = body.signatureImage || body.signature_image || null;

    await db.execute({
      sql: `INSERT INTO signing_workspace_documents (
        id, file_name, file_size, uploaded_by, status, target_personnel,
        required_signers, signers_matrix, scanned_info, pdf_data,
        province, section_division, notes, has_p12, signature_image,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        file_size = excluded.file_size,
        status = excluded.status,
        target_personnel = excluded.target_personnel,
        required_signers = excluded.required_signers,
        signers_matrix = excluded.signers_matrix,
        scanned_info = COALESCE(excluded.scanned_info, signing_workspace_documents.scanned_info),
        pdf_data = COALESCE(excluded.pdf_data, signing_workspace_documents.pdf_data),
        province = excluded.province,
        section_division = excluded.section_division,
        notes = excluded.notes,
        has_p12 = excluded.has_p12,
        signature_image = COALESCE(excluded.signature_image, signing_workspace_documents.signature_image),
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        id,
        fileName,
        fileSize,
        uploadedBy,
        status,
        targetPersonnel,
        requiredSignersStr,
        signersMatrixStr,
        scannedInfoStr,
        pdfData,
        province,
        sectionDivision,
        notes,
        hasP12,
        signatureImage,
      ],
    });

    const savedDoc = {
      id,
      fileName,
      fileSize,
      uploadedBy,
      status,
      targetPersonnel,
      requiredSigners: JSON.parse(requiredSignersStr),
      signers: JSON.parse(signersMatrixStr),
      notes,
    };

    broadcastSigningWorkspaceEvent({ type: "INSERT", record: savedDoc });
    return res.json({ success: true, document: savedDoc });
  } catch (error: any) {
    console.error("Error saving document:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. POST /api/signing-workspace/batch - Micro-batch insertion/update
signingWorkspaceRouter.post("/batch", async (req: Request, res: Response) => {
  try {
    const { documents } = req.body;
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, error: "Empty or invalid documents array" });
    }

    const savedRecords: any[] = [];
    for (const doc of documents) {
      const id = String(doc.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const fileName = String(doc.fileName || doc.file_name || doc.pdfFileName || "Document.pdf");
      const fileSize = String(doc.fileSize || doc.file_size || doc.pdfFileSize || "");
      const uploadedBy = String(doc.uploadedBy || doc.uploaded_by || "System");
      const status = String(doc.status || "pending");
      const targetPersonnel = String(doc.targetPersonnel || doc.target_personnel || doc.employeeName || "PERSONNEL");
      const requiredSignersStr = JSON.stringify(doc.requiredSigners || doc.required_signers || []);
      const signersMatrixStr = JSON.stringify(doc.signers || doc.signers_matrix || []);
      const scannedInfoStr = doc.scannedInfo || doc.scanned_info ? JSON.stringify(doc.scannedInfo || doc.scanned_info) : null;
      const pdfData = doc.pdfDataUrl || doc.pdf_data || doc.pdfData || null;
      const province = String(doc.province || "Regional Office");
      const sectionDivision = String(doc.sectionDivision || doc.section_division || "Regional Office V");
      const notes = String(doc.notes || "");
      const hasP12 = doc.hasP12 || doc.has_p12 ? 1 : 0;
      const signatureImage = doc.signatureImage || doc.signature_image || null;

      await db.execute({
        sql: `INSERT INTO signing_workspace_documents (
          id, file_name, file_size, uploaded_by, status, target_personnel,
          required_signers, signers_matrix, scanned_info, pdf_data,
          province, section_division, notes, has_p12, signature_image,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          file_name = excluded.file_name,
          file_size = excluded.file_size,
          status = excluded.status,
          target_personnel = excluded.target_personnel,
          required_signers = excluded.required_signers,
          signers_matrix = excluded.signers_matrix,
          scanned_info = COALESCE(excluded.scanned_info, signing_workspace_documents.scanned_info),
          pdf_data = COALESCE(excluded.pdf_data, signing_workspace_documents.pdf_data),
          province = excluded.province,
          section_division = excluded.section_division,
          notes = excluded.notes,
          has_p12 = excluded.has_p12,
          signature_image = COALESCE(excluded.signature_image, signing_workspace_documents.signature_image),
          updated_at = CURRENT_TIMESTAMP`,
        args: [
          id,
          fileName,
          fileSize,
          uploadedBy,
          status,
          targetPersonnel,
          requiredSignersStr,
          signersMatrixStr,
          scannedInfoStr,
          pdfData,
          province,
          sectionDivision,
          notes,
          hasP12,
          signatureImage,
        ],
      });

      savedRecords.push({ id, fileName, status });
    }

    broadcastSigningWorkspaceEvent({ type: "BATCH", batchCount: savedRecords.length });
    return res.json({ success: true, count: savedRecords.length, saved: savedRecords });
  } catch (error: any) {
    console.error("Error in batch save:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 5. PUT /api/signing-workspace/:id - Update document (status, signers, notes, pdf_data)
signingWorkspaceRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updates: string[] = ["updated_at = CURRENT_TIMESTAMP"];
    const args: any[] = [];

    if (body.status !== undefined) {
      updates.push("status = ?");
      args.push(String(body.status));
    }
    if (body.targetPersonnel !== undefined || body.target_personnel !== undefined) {
      updates.push("target_personnel = ?");
      args.push(String(body.targetPersonnel || body.target_personnel));
    }
    if (body.requiredSigners !== undefined || body.required_signers !== undefined) {
      updates.push("required_signers = ?");
      args.push(JSON.stringify(body.requiredSigners || body.required_signers));
    }
    if (body.signers !== undefined || body.signers_matrix !== undefined) {
      updates.push("signers_matrix = ?");
      args.push(JSON.stringify(body.signers || body.signers_matrix));
    }
    if (body.pdfDataUrl !== undefined || body.pdf_data !== undefined) {
      updates.push("pdf_data = ?");
      args.push(String(body.pdfDataUrl || body.pdf_data));
    }
    if (body.notes !== undefined) {
      updates.push("notes = ?");
      args.push(String(body.notes));
    }
    if (body.signatureImage !== undefined || body.signature_image !== undefined) {
      updates.push("signature_image = ?");
      args.push(String(body.signatureImage || body.signature_image));
    }

    args.push(id);
    const sql = `UPDATE signing_workspace_documents SET ${updates.join(", ")} WHERE id = ?`;
    await db.execute({ sql, args });

    broadcastSigningWorkspaceEvent({ type: "UPDATE", id, record: { id, status: body.status } });
    return res.json({ success: true, id });
  } catch (error: any) {
    console.error("Error updating document:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 6. DELETE /api/signing-workspace/:id - Delete single document
signingWorkspaceRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: `DELETE FROM signing_workspace_documents WHERE id = ?`,
      args: [id],
    });

    broadcastSigningWorkspaceEvent({ type: "DELETE", id });
    return res.json({ success: true, deleted: id });
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 7. POST /api/signing-workspace/bulk-delete - Delete multiple or all documents
signingWorkspaceRouter.post("/bulk-delete", async (req: Request, res: Response) => {
  try {
    const { ids, all } = req.body;
    if (all) {
      await db.execute("DELETE FROM signing_workspace_documents");
      broadcastSigningWorkspaceEvent({ type: "BULK_DELETE" });
      return res.json({ success: true, message: "All documents deleted" });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      await db.execute({
        sql: `DELETE FROM signing_workspace_documents WHERE id IN (${placeholders})`,
        args: ids,
      });
      broadcastSigningWorkspaceEvent({ type: "BULK_DELETE", ids });
      return res.json({ success: true, count: ids.length });
    }

    return res.status(400).json({ success: false, error: "Missing ids or all flag" });
  } catch (error: any) {
    console.error("Error bulk deleting documents:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
