import { db } from '../server/db';

async function test() {
  const countRes = await db.execute({
    sql: `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN pdf_data IS NULL OR length(pdf_data) = 0 THEN 1 ELSE 0 END) as null_count,
            SUM(CASE WHEN pdf_data IS NOT NULL AND length(pdf_data) > 0 THEN 1 ELSE 0 END) as has_pdf_count
          FROM signing_workspace_documents`,
    args: []
  });
  console.log('Document stats:', countRes.rows);

  const sampleNulls = await db.execute({
    sql: `SELECT id, file_name, file_size, uploaded_by, uploaded_at, status 
          FROM signing_workspace_documents 
          WHERE pdf_data IS NULL OR length(pdf_data) = 0 
          LIMIT 10`,
    args: []
  });
  console.log('Sample null PDF documents:', sampleNulls.rows);
}
test();
