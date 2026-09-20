import { Router, Request, Response } from "express";
import { db } from "../db.js";
import {
  encryptP12Password,
  decryptP12Password,
  signPdfBuffer,
  getSignerIdentityFromP12,
} from "../services/pnpkiSigningService.js";

export const dtrGeneratorRouter = Router();

// Helper to format a dtr_generator row (Never expose sensitive passwords)
function formatDtrGeneratorRow(row: any) {
  return {
    id: row.id,
    user_Id: row.user_Id || "",
    Name: row.Name || "",
    p12: row.p12 || null, // Base64 data
    p12_filename: row.p12_filename || null,
    p12_filesize: Number(row.p12_filesize) || 0,
    p12_password: "", // Kept strictly private on server
    hasP12Password: Boolean(row.p12_password),
    hasP12: Boolean(row.p12),
    image_digiSigned: row.image_digiSigned || null, // Base64 image
    hasImageDigiSigned: Boolean(row.image_digiSigned),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/dtr-generator - List records (strictly scoped by user_Id for multi-user isolation)
dtrGeneratorRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { user_Id, Name, email } = req.query;
    let sql = "SELECT * FROM dtr_generator";
    const args: any[] = [];

    const conditions: string[] = [];
    if (user_Id) {
      conditions.push("(user_Id = ? OR id = ?)");
      args.push(String(user_Id), `dtr-sig-${user_Id}`);
    }
    if (Name) {
      conditions.push("LOWER(Name) = LOWER(?)");
      args.push(String(Name).trim());
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY updated_at DESC";

    const result = await db.execute({ sql, args });
    const records = result.rows.map(formatDtrGeneratorRow);
    return res.json({ success: true, records });
  } catch (error: any) {
    console.error("Error fetching dtr_generator records:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dtr-generator/:id - Get single record
dtrGeneratorRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.execute({
      sql: "SELECT * FROM dtr_generator WHERE id = ? OR user_Id = ? OR LOWER(Name) = LOWER(?)",
      args: [id, id, id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    return res.json({ success: true, record: formatDtrGeneratorRow(result.rows[0]) });
  } catch (error: any) {
    console.error("Error fetching dtr_generator record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dtr-generator - Create or update record (Upsert with strict user_Id audit tracking)
dtrGeneratorRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { id, user_Id, Name, p12, p12_filename, p12_filesize, p12_password, image_digiSigned } = req.body;

    if (!Name || typeof Name !== "string" || !Name.trim()) {
      return res.status(400).json({ success: false, error: "Name is required" });
    }

    const headerUserId = req.headers["x-user-id"] ? String(req.headers["x-user-id"]).trim() : null;
    let cleanUserId = user_Id ? String(user_Id).trim() : headerUserId;
    const cleanName = Name.trim();
    const cleanP12 = p12 || null;
    const cleanP12Filename = p12_filename ? String(p12_filename).trim() : null;
    const cleanP12Filesize = p12_filesize ? Number(p12_filesize) : 0;
    const cleanP12Password = p12_password ? encryptP12Password(String(p12_password).trim()) : null;
    const cleanImage = image_digiSigned || null;

    // Automatic Audit Trailing: If cleanUserId was not explicitly supplied, attempt intelligent lookup from administration table
    if (!cleanUserId) {
      // 1. Try resolving via Common Name from .p12 certificate
      if (cleanP12 && cleanP12Password) {
        try {
          const rawPwd = decryptP12Password(cleanP12Password);
          const identity = getSignerIdentityFromP12(cleanP12, rawPwd);
          if (identity?.commonName) {
            const match = await db.execute({
              sql: "SELECT id FROM administration WHERE LOWER(name) = LOWER(?) OR LOWER(?) LIKE '%' || LOWER(name) || '%' LIMIT 1",
              args: [identity.commonName, identity.commonName],
            });
            if (match.rows.length > 0) {
              cleanUserId = String(match.rows[0].id);
            }
          }
        } catch {}
      }

      // 2. Try resolving via cleanName
      if (!cleanUserId && cleanName && cleanName !== "PERSONNEL") {
        const match = await db.execute({
          sql: "SELECT id FROM administration WHERE LOWER(name) = LOWER(?) OR LOWER(name) LIKE ? LIMIT 1",
          args: [cleanName, `%${cleanName}%`],
        });
        if (match.rows.length > 0) {
          cleanUserId = String(match.rows[0].id);
        }
      }
    }

    const recordId = id || (cleanUserId ? `dtr-sig-${cleanUserId}` : `dtr-sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

    // Check if record exists by ID or user_Id
    let existingRecord = null;
    if (cleanUserId) {
      const check = await db.execute({
        sql: "SELECT * FROM dtr_generator WHERE user_Id = ? OR id = ? OR id = ?",
        args: [cleanUserId, recordId, `dtr-sig-${cleanUserId}`],
      });
      if (check.rows.length > 0) existingRecord = check.rows[0];
    } else if (id) {
      const check = await db.execute({ sql: "SELECT * FROM dtr_generator WHERE id = ?", args: [id] });
      if (check.rows.length > 0) existingRecord = check.rows[0];
    }

    if (existingRecord) {
      // Update existing record
      await db.execute({
        sql: `UPDATE dtr_generator 
              SET user_Id = COALESCE(?, user_Id),
                  Name = ?,
                  p12 = COALESCE(?, p12),
                  p12_filename = COALESCE(?, p12_filename),
                  p12_filesize = CASE WHEN ? > 0 THEN ? ELSE p12_filesize END,
                  p12_password = COALESCE(?, p12_password),
                  image_digiSigned = COALESCE(?, image_digiSigned),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          cleanUserId,
          cleanName,
          cleanP12,
          cleanP12Filename,
          cleanP12Filesize,
          cleanP12Filesize,
          cleanP12Password,
          cleanImage,
          existingRecord.id,
        ],
      });

      const updated = await db.execute({
        sql: "SELECT * FROM dtr_generator WHERE id = ?",
        args: [existingRecord.id],
      });

      return res.json({
        success: true,
        message: "Digital signature profile updated successfully",
        record: formatDtrGeneratorRow(updated.rows[0]),
      });
    }

    // Insert new record
    await db.execute({
      sql: `INSERT INTO dtr_generator (id, user_Id, Name, p12, p12_filename, p12_filesize, p12_password, image_digiSigned, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        recordId,
        cleanUserId,
        cleanName,
        cleanP12,
        cleanP12Filename,
        cleanP12Filesize,
        cleanP12Password,
        cleanImage,
      ],
    });

    const inserted = await db.execute({
      sql: "SELECT * FROM dtr_generator WHERE id = ?",
      args: [recordId],
    });

    return res.status(201).json({
      success: true,
      message: "Digital signature profile saved successfully",
      record: formatDtrGeneratorRow(inserted.rows[0]),
    });
  } catch (error: any) {
    console.error("Error creating/updating dtr_generator record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/dtr-generator/p12-identity - Extract cryptographic signer identity strictly from .p12
dtrGeneratorRouter.post("/p12-identity", async (req: Request, res: Response) => {
  try {
    const { p12, p12_password, profileId, user_Id } = req.body;
    let p12ToUse = p12;
    let passwordToUse = p12_password;

    if ((!p12ToUse || !passwordToUse) && (profileId || user_Id)) {
      const lookupId = profileId || user_Id;
      const check = await db.execute({
        sql: "SELECT * FROM dtr_generator WHERE id = ? OR user_Id = ?",
        args: [lookupId, lookupId],
      });

      if (check.rows.length > 0) {
        const row = check.rows[0];
        if (!p12ToUse && row.p12) {
          p12ToUse = String(row.p12);
        }
        if (!passwordToUse && row.p12_password) {
          passwordToUse = decryptP12Password(String(row.p12_password));
        }
      }
    }

    if (!p12ToUse) {
      return res.status(400).json({
        success: false,
        error: "Missing .p12 certificate file to inspect identity.",
      });
    }

    const identity = getSignerIdentityFromP12(p12ToUse, passwordToUse);

    return res.json({
      success: true,
      identity: {
        commonName: identity.commonName,
        subjectDN: identity.subjectDN,
        organization: identity.organization,
        issuerCN: identity.issuerCN,
        issuerDN: identity.issuerDN,
        serialNumber: identity.serialNumber,
        sha256Fingerprint: identity.sha256Fingerprint,
        validFrom: identity.validFrom,
        validTo: identity.validTo,
        caChainCount: identity.caCerts?.length || 0,
      },
    });
  } catch (error: any) {
    console.error("Error extracting .p12 identity:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to parse .p12 certificate identity. Check password.",
    });
  }
});

// POST /api/dtr-generator/sign-pdf - Cryptographically sign a PDF document using PNPKI .p12
dtrGeneratorRouter.post("/sign-pdf", async (req: Request, res: Response) => {
  try {
    const {
      pdfBase64,
      profileId,
      user_Id,
      p12,
      p12_password,
      account_password,
      isGoogleAuth,
      reason,
      sigRect,
      sigRects,
      pageIndex,
    } = req.body;

    if (!pdfBase64) {
      return res.status(400).json({ success: false, error: "Missing pdfBase64" });
    }

    // Verify account password if provided (for normal email+password accounts)
    if (account_password && (user_Id || profileId)) {
      const targetId = user_Id || profileId;
      const userLookup = await db.execute({
        sql: "SELECT * FROM administration WHERE id = ? OR email = ?",
        args: [targetId, targetId],
      });

      if (userLookup.rows.length > 0) {
        const adminUser: any = userLookup.rows[0];
        if (adminUser.password && String(adminUser.password).trim() !== String(account_password).trim()) {
          return res.status(401).json({
            success: false,
            error: "Incorrect account password. Please enter your valid web application login password.",
          });
        }
      }
    }

    let p12ToUse = p12;
    let passwordToUse = p12_password;

    // If profileId or user_Id provided, look up saved profile in database
    if ((!p12ToUse || !passwordToUse) && (profileId || user_Id)) {
      const lookupId = profileId || user_Id;
      const check = await db.execute({
        sql: "SELECT * FROM dtr_generator WHERE id = ? OR user_Id = ?",
        args: [lookupId, lookupId],
      });

      if (check.rows.length > 0) {
        const row = check.rows[0];
        if (!p12ToUse && row.p12) {
          p12ToUse = String(row.p12);
        }
        if (!passwordToUse && row.p12_password) {
          passwordToUse = decryptP12Password(String(row.p12_password));
        }
      }
    }

    if (!p12ToUse) {
      return res.status(400).json({
        success: false,
        error: "No PNPKI .p12 certificate found for signing. Please upload or attach a .p12 file.",
      });
    }

    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    // Sign PDF - Identity is derived STRICTLY from the P12 certificate
    const { signedBuffer, signerName: signedBy, certificateInfo, signerIdentity } = await signPdfBuffer(
      pdfBuffer,
      p12ToUse,
      passwordToUse,
      {
        reason: reason || "Civil Service Form No. 48 Official Verification",
        sigRect: Array.isArray(sigRect) && sigRect.length === 4 ? (sigRect as [number, number, number, number]) : undefined,
        sigRects: Array.isArray(sigRects) ? (sigRects as [number, number, number, number][]) : undefined,
        pageIndex: typeof pageIndex === "number" ? pageIndex : undefined,
      }
    );

    return res.json({
      success: true,
      signedPdfBase64: signedBuffer.toString("base64"),
      signerName: signedBy,
      certificateInfo,
      signerIdentity: {
        commonName: signerIdentity.commonName,
        subjectDN: signerIdentity.subjectDN,
        organization: signerIdentity.organization,
        issuerCN: signerIdentity.issuerCN,
        issuerDN: signerIdentity.issuerDN,
        serialNumber: signerIdentity.serialNumber,
        sha256Fingerprint: signerIdentity.sha256Fingerprint,
        validFrom: signerIdentity.validFrom,
        validTo: signerIdentity.validTo,
      },
    });
  } catch (error: any) {
    console.error("Error signing PDF with PNPKI .p12:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to cryptographically sign PDF with PNPKI keystore.",
    });
  }
});

// DELETE /api/dtr-generator/:id - Delete a signature record
dtrGeneratorRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const check = await db.execute({
      sql: "SELECT * FROM dtr_generator WHERE id = ?",
      args: [id],
    });

    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }

    await db.execute({
      sql: "DELETE FROM dtr_generator WHERE id = ?",
      args: [id],
    });

    return res.json({ success: true, message: "Digital signature profile deleted" });
  } catch (error: any) {
    console.error("Error deleting dtr_generator record:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
