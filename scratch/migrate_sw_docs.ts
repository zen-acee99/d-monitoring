import { db } from '../server/db.js';

async function migrate() {
  console.log("Migrating SIGNING_WORKSPACE documents from dtr_storage to signing_workspace_documents...");
  const res = await db.execute("SELECT * FROM dtr_storage WHERE module = 'SIGNING_WORKSPACE'");
  console.log(`Found ${res.rows.length} documents in dtr_storage.`);

  for (const r of res.rows) {
    let remarks: any = {};
    try {
      if (r.remarks) remarks = JSON.parse(r.remarks as string);
    } catch {}

    const id = String(r.id);
    const fileName = String(remarks.originalFileName || r.pdf_filename || "Document.pdf");
    const fileSize = String(r.pdf_filesize || "");
    const uploadedBy = String(remarks.uploadedBy || r.employee_name || "System");
    const status = String(r.status || "pending");
    const targetPersonnel = String(remarks.targetPersonnel || r.employee_name || "PERSONNEL");
    const requiredSignersStr = JSON.stringify(remarks.requiredSigners || (targetPersonnel ? [targetPersonnel] : []));
    const signersMatrixStr = JSON.stringify(remarks.signers || [
      {
        name: targetPersonnel,
        role: "Signatory",
        status: status === "signed" ? "signed" : "pending",
        position: "above"
      }
    ]);
    const scannedInfoStr = remarks.scannedInfo ? JSON.stringify(remarks.scannedInfo) : null;
    const pdfData = r.pdf_data || null;
    const province = String(r.province || "Regional Office");
    const sectionDivision = String(r.section_division || "Regional Office V");
    const notes = String(remarks.notes || "");
    const hasP12 = r.has_p12 ? 1 : 0;
    const signatureImage = r.signature_image || null;

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
        notes = excluded.notes,
        has_p12 = excluded.has_p12,
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
      ]
    });
    console.log(`✓ Migrated ${id} (${fileName})`);
  }

  const count = await db.execute("SELECT COUNT(*) as c FROM signing_workspace_documents");
  console.log(`Total documents in signing_workspace_documents now: ${count.rows[0].c}`);
  process.exit(0);
}

migrate().catch(console.error);
