import { db } from '../server/db.js';

async function main() {
  const result = await db.execute({
    sql: `SELECT id, employee_name, pdf_file_name, length(pdf_data_url) as pdf_len, module, doc_type, submitted_date
          FROM dtr_storage
          WHERE id LIKE '%doc-upload-1794011790736%' OR pdf_file_name LIKE '%October RAOD%'
          LIMIT 10`,
    args: []
  });
  console.log('Found in dtr_storage:', result.rows.length);
  for (const r of result.rows) {
    console.log(r);
  }
}

main().catch(console.error);
