import { db } from '../server/db';

async function test() {
  const res = await db.execute({
    sql: `SELECT id, file_name, file_size, uploaded_by, uploaded_at, length(pdf_data) as len FROM signing_workspace_documents WHERE pdf_data IS NOT NULL AND length(pdf_data) > 0 LIMIT 5`,
    args: []
  });
  console.log('Documents with PDF:', res.rows);
}
test();
