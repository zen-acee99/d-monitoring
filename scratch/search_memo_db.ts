import { db } from '../server/db';

async function main() {
  const sw = await db.execute("SELECT id, file_name, file_size, status, target_personnel, required_signers, signers_matrix, created_at FROM signing_workspace_documents");
  console.log("All rows in signing_workspace_documents:", sw.rows.length);
  for (const r of sw.rows) {
    console.log(r);
  }

  const dtr = await db.execute("SELECT id, pdf_filename, status, module, employee_name, created_at FROM dtr_storage WHERE pdf_filename LIKE '%138%' OR pdf_filename LIKE '%Memo%' OR pdf_filename LIKE '%POV%' OR pdf_filename LIKE '%ABSTRACT%' OR employee_name LIKE '%Annabel%'");
  console.log("Matching rows in dtr_storage:", dtr.rows.length);
  for (const r of dtr.rows) {
    console.log(r);
  }
}

main();
