import { db } from '../server/db';

async function test() {
  const res = await db.execute({
    sql: `SELECT id, pdf_filename, pdf_filesize, (pdf_data IS NULL) as is_null, length(pdf_data) as len FROM dtr_storage WHERE id = 'doc-upload-1794011790736-22-vbk3'`,
    args: []
  });
  console.log('dtr_storage pdf:', res.rows[0]);
}
test();
