import { db } from '../server/db.js';

async function main() {
  const result = await db.execute({
    sql: `SELECT id, file_name, file_size, uploaded_by, status, length(pdf_data) as pdf_len
          FROM signing_workspace_documents
          ORDER BY id DESC
          LIMIT 20`,
    args: []
  });
  console.log('Total checked:', result.rows.length);
  for (const r of result.rows) {
    console.log(r);
  }

  const countRes = await db.execute({
    sql: `SELECT count(*) as total,
                 count(pdf_data) as has_pdf,
                 sum(case when pdf_data is null or length(pdf_data) = 0 then 1 else 0 end) as no_pdf
          FROM signing_workspace_documents`,
    args: []
  });
  console.log('Counts in signing_workspace_documents:', countRes.rows[0]);
}

main().catch(console.error);
