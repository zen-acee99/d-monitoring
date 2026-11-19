import { db } from "../../../server/db.js";

async function main() {
  const r = await db.execute(`
    SELECT id, file_name, status, target_personnel, required_signers, signers_matrix, notes 
    FROM signing_workspace_documents 
    WHERE status = 'pending'
  `);
  console.log(`Pending documents (${r.rows.length}):`);
  for (const row of r.rows) {
    console.log(`- [${row.status}] ${row.file_name} | target: ${row.target_personnel} | signers: ${row.signers_matrix} | notes: ${row.notes}`);
  }
}

main().catch(console.error);
