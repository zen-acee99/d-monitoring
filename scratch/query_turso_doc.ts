import { db } from '../server/db.js';

async function main() {
  const result = await db.execute({
    sql: `SELECT id, file_name, file_size, uploaded_by, status, length(pdf_data) as pdf_len, substr(pdf_data, 1, 50) as pdf_prefix
          FROM signing_workspace_documents
          WHERE file_name LIKE '%October RAOD%' OR id LIKE '%doc-upload-1794011790736%'
          LIMIT 10`,
    args: []
  });
  console.log('Found records:', result.rows.length);
  for (const r of result.rows) {
    console.log(r);
  }
}

main().catch(console.error);
