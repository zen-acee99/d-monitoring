import { db } from '../server/db';
import { recheckDocWithLatestUsers, normalizeNameForMatch, matchNames } from '../src/utils/dtrVectorPdf';

async function main() {
  const res = await db.execute("SELECT * FROM signing_workspace_documents WHERE id = 'doc-upload-1794277438673-0-d1i5'");
  const row = res.rows[0];
  const doc = {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    targetPersonnel: row.target_personnel,
    requiredSigners: JSON.parse(row.required_signers as string),
    signers: JSON.parse(row.signers_matrix as string),
    scannedInfo: row.scanned_info ? JSON.parse(row.scanned_info as string) : null,
  };

  console.log("Original doc:", {
    requiredSigners: doc.requiredSigners,
    signers: doc.signers,
    scannedInfo: doc.scannedInfo ? Object.keys(doc.scannedInfo) : null,
  });

  // Let's get users from DB users table
  const userRows = await db.execute("SELECT id, name, role, email FROM users");
  console.log(`Loaded ${userRows.rows.length} users from DB:`, userRows.rows.map(u => u.name));

  const testUsers = userRows.rows.map((u: any) => ({ name: u.name, role: u.role, email: u.email }));

  const result = recheckDocWithLatestUsers(doc, testUsers);
  console.log("\nResult from recheckDocWithLatestUsers:", {
    hasNewRecognition: result.hasNewRecognition,
    newlyDetectedNames: result.newlyDetectedNames,
    requiredSigners: result.updatedDoc.requiredSigners,
    signers: result.updatedDoc.signers,
  });
}

main();
