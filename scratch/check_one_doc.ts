import { db } from '../server/db.js';

async function main() {
  const result = await db.execute({
    sql: `SELECT * FROM signing_workspace_documents WHERE id = 'doc-upload-1794011790736-22-vbk3'`,
    args: []
  });
  console.log(result.rows[0]);
}

main().catch(console.error);
