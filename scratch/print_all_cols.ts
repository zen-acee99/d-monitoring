import { db } from '../server/db.js';

async function f() {
  const res = await db.execute("SELECT * FROM dtr_storage WHERE id = 'doc-upload-1794305927743-0-zxjr'");
  const row = { ...res.rows[0] };
  delete row.pdf_blob; // don't dump huge blob
  console.log(JSON.stringify(row, null, 2));
  process.exit(0);
}
f();
