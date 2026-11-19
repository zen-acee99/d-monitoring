import { db } from '../server/db';

async function test() {
  const res = await db.execute({
    sql: `SELECT * FROM signing_workspace_documents WHERE id = 'doc-upload-1794011790736-22-vbk3'`,
    args: []
  });
  const row = res.rows[0];
  if (row) {
    for (const [k, v] of Object.entries(row)) {
      if (k !== 'pdf_data') {
        console.log(`${k}:`, typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '...' : v);
      }
    }
  }
}
test();
