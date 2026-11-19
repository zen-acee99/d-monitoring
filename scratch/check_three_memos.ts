import { db } from '../server/db.js';

async function main() {
  const ids = [
    'doc-upload-1794305927743-0-zxjr',
    'doc-upload-1794305927743-2-80pi',
    'doc-upload-1794305927744-3-yk3t'
  ];
  for (const id of ids) {
    const res = await db.execute({
      sql: "SELECT id, employee_name, pdf_filename, status, remarks FROM dtr_storage WHERE id = ?",
      args: [id]
    });
    if (res.rows.length > 0) {
      const r = res.rows[0];
      console.log('ID:', r.id);
      console.log('Name:', r.pdf_filename);
      console.log('Remarks:', r.remarks);
      console.log('-----------------------------------');
    }
  }
  process.exit(0);
}

main();
