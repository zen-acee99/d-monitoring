import { db } from '../server/db';

async function test() {
  try {
    const res = await db.execute({
      sql: `SELECT id, file_name, file_size, uploaded_by, length(pdf_data) as pdf_len, (pdf_data IS NULL) as is_null FROM signing_workspace_documents WHERE id LIKE '%1794011790736%' OR file_name LIKE '%1039%'`,
      args: []
    });
    console.log('Results in signing_workspace_documents:', res.rows);

    const dtrRes = await db.execute({
      sql: `SELECT id, employee_name, length(pdf_data) as pdf_len, (pdf_data IS NULL) as is_null FROM dtr_storage WHERE id LIKE '%1794011790736%' OR remarks LIKE '%1039%'`,
      args: []
    });
    console.log('Results in dtr_storage:', dtrRes.rows);
  } catch (err) {
    console.error('DB Error:', err);
  }
}
test();
