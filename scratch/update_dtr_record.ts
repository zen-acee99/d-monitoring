import fs from "fs";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const signedBytes = fs.readFileSync("scratch/ace_dtr_final_signed.pdf");
  const base64Data = `data:application/pdf;base64,${signedBytes.toString("base64")}`;
  const recordId = "doc-upload-1794277438673-0-d1i5";

  const updatedRemarks = {
    originalFileName: "DTR_Form48_Ace_Mata_Malto_2026 (10).pdf",
    targetPersonnel: "ACE MATA MALTO",
    requiredSigners: ["ACE MALTO", "RENE JANE R. BUENA"],
    signers: [
      {
        name: "ACE MALTO",
        role: "Technical Specialist",
        status: "signed",
        position: "above",
        signedAt: new Date().toISOString(),
        p12CommonName: "Malto Ace Mata"
      },
      {
        name: "RENE JANE R. BUENA",
        role: "Provincial Officer - Albay",
        status: "pending",
        position: "above"
      }
    ],
    counterSigners: [],
    scannedInfo: {
      primaryPersonnel: "ACE MALTO",
      requiredSigners: ["ACE MALTO", "RENE JANE R. BUENA"],
      signers: [
        {
          name: "ACE MALTO",
          roleHeader: "",
          title: "Technical Specialist",
          x: 124.5,
          y: 233.5,
          pageIndex: 0,
          isAlreadySigned: true,
          status: "signed",
          p12CommonName: "Malto Ace Mata"
        },
        {
          name: "RENE JANE R. BUENA",
          roleHeader: "",
          title: "Provincial Officer - Albay",
          x: 119.5,
          y: 176.5,
          pageIndex: 0,
          isAlreadySigned: false,
          status: "pending"
        }
      ],
      detectedTexts: [
        "ACE MATA MALTO",
        "RENE JANE R. BUENA",
        "Provincial Officer - Albay"
      ],
      existingSignatures: [
        {
          pageIndex: 0,
          rect: [122, 243, 237, 261],
          signerName: "Ace Mata Malto",
          fieldName: "Personnel_Signature_Copy1",
          isSigned: true
        },
        {
          pageIndex: 0,
          rect: [416, 243, 531, 261],
          signerName: "Ace Mata Malto",
          fieldName: "Personnel_Signature_Copy2",
          isSigned: true
        }
      ]
    },
    notes: 'Signed directly ABOVE personnel "ACE MATA MALTO" on both left and right copies (gap 5-8px, normal font)'
  };

  // 1. Update dtr_storage
  const res1 = await client.execute({
    sql: `UPDATE dtr_storage SET 
      pdf_data = ?, 
      pdf_filesize = ?, 
      status = 'partially_signed',
      remarks = ?,
      updated_at = ?
      WHERE id = ?`,
    args: [
      base64Data,
      `${Math.round(signedBytes.length / 1024)} KB`,
      JSON.stringify(updatedRemarks),
      new Date().toISOString(),
      recordId,
    ],
  });
  console.log("Updated dtr_storage rows affected:", res1.rowsAffected);

  // 2. Upsert signing_workspace_documents
  const res2 = await client.execute({
    sql: `INSERT INTO signing_workspace_documents (
      id, file_name, file_size, uploaded_at, uploaded_by, status,
      target_personnel, required_signers, signers_matrix, scanned_info,
      pdf_data, province, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      status = excluded.status,
      target_personnel = excluded.target_personnel,
      required_signers = excluded.required_signers,
      signers_matrix = excluded.signers_matrix,
      scanned_info = excluded.scanned_info,
      pdf_data = excluded.pdf_data,
      notes = excluded.notes,
      updated_at = excluded.updated_at`,
    args: [
      recordId,
      "DTR_Form48_Ace_Mata_Malto_2026 (10).pdf",
      `${Math.round(signedBytes.length / 1024)} KB`,
      new Date().toISOString(),
      "Ace malto",
      "partially_signed",
      "ACE MATA MALTO",
      JSON.stringify(["ACE MALTO", "RENE JANE R. BUENA"]),
      JSON.stringify(updatedRemarks.signers),
      JSON.stringify(updatedRemarks.scannedInfo),
      base64Data,
      "Albay",
      updatedRemarks.notes,
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  });
  console.log("Upserted signing_workspace_documents rows affected:", res2.rowsAffected);
}

main().catch(console.error);
