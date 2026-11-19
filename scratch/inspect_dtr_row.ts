import { db } from '../server/db.js';

async function main() {
  try {
    const res = await db.execute("SELECT * FROM dtr_storage WHERE id = 'doc-upload-1794305927743-0-zxjr'");
    if (res.rows.length === 0) {
      console.log("No row found");
    } else {
      const r = res.rows[0];
      console.log('id:', r.id);
      console.log('employee_name:', r.employee_name);
      console.log('pdf_filename:', r.pdf_filename);
      console.log('status:', r.status);
      console.log('notes:', r.notes);
      console.log('has_p12:', r.has_p12);
      console.log('supervisor_name:', r.supervisor_name);
      console.log('division_head:', r.division_head);
      console.log('p12_signers:', r.p12_signers);
      console.log('scanned_signers:', r.scanned_signers);
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
