import { db } from '../server/db';
import fs from 'fs';

async function main() {
  const res = await db.execute({
    sql: "SELECT id, file_name, uploaded_by, status, target_personnel, required_signers, signers_matrix, created_at, length(pdf_data) as pdf_len FROM signing_workspace_documents WHERE file_name LIKE '%Masareta%' OR file_name LIKE '%154%'",
    args: []
  });
  console.log('signing_workspace_documents matches:', res.rows.length);
  if (res.rows.length > 0) {
    console.log(JSON.stringify(res.rows, null, 2));
    const full = await db.execute({
      sql: "SELECT pdf_data FROM signing_workspace_documents WHERE id = ?",
      args: [res.rows[0].id]
    });
    if (full.rows[0]?.pdf_data) {
      const dataStr = String(full.rows[0].pdf_data);
      const b64 = dataStr.replace(/^data:application\/pdf;base64,/, '');
      fs.writeFileSync('scratch/masareta_from_db.pdf', Buffer.from(b64, 'base64'));
      console.log('Saved scratch/masareta_from_db.pdf, size:', fs.statSync('scratch/masareta_from_db.pdf').size);
    }
  }

  const res2 = await db.execute({
    sql: "SELECT id, pdf_filename, employee_name, status, submitted_date, length(pdf_data) as pdf_len FROM dtr_storage WHERE pdf_filename LIKE '%Masareta%' OR pdf_filename LIKE '%154%'",
    args: []
  });
  console.log('dtr_storage matches:', res2.rows.length);
  if (res2.rows.length > 0) {
    console.log(JSON.stringify(res2.rows, null, 2));
    if (!fs.existsSync('scratch/masareta_from_db.pdf')) {
      const full2 = await db.execute({
        sql: "SELECT pdf_data FROM dtr_storage WHERE id = ?",
        args: [res2.rows[0].id]
      });
      if (full2.rows[0]?.pdf_data) {
        const dataStr2 = String(full2.rows[0].pdf_data);
        const b64_2 = dataStr2.replace(/^data:application\/pdf;base64,/, '');
        fs.writeFileSync('scratch/masareta_from_db.pdf', Buffer.from(b64_2, 'base64'));
        console.log('Saved scratch/masareta_from_db.pdf from dtr_storage');
      }
    }
  }
}

main().catch(console.error);
