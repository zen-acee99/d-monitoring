import { db } from '../server/db.js';

async function main() {
  const result = await db.execute("SELECT id, file_name, file_size, status, target_personnel, required_signers, signers_matrix FROM signing_workspace_documents ORDER BY created_at DESC");
  console.log(`signing_workspace_documents count: ${result.rows.length}`);
  for (const r of result.rows) {
    console.log(`- [${r.status}] ${r.file_name} | Target: ${r.target_personnel} | Req: ${r.required_signers}`);
  }
  process.exit(0);
}

main();
