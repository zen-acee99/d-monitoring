import { db } from "../../../server/db.js";

async function main() {
  const r = await db.execute(`
    SELECT id, file_name, status, target_personnel, required_signers, signers_matrix, scanned_info, notes 
    FROM signing_workspace_documents 
    WHERE file_name LIKE '%Elena%' OR file_name LIKE '%Labo%' OR file_name LIKE '%Irosin%'
  `);
  for (const row of r.rows) {
    console.log("=== " + row.file_name + " ===");
    console.log("id:", row.id);
    console.log("status:", row.status);
    console.log("target_personnel:", row.target_personnel);
    console.log("required_signers:", row.required_signers);
    console.log("signers_matrix:", row.signers_matrix);
    console.log("notes:", row.notes);
    console.log("scanned_info:", row.scanned_info);
  }
}

main().catch(console.error);
