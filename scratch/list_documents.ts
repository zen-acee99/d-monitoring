import { db } from '../server/db.js';

async function main() {
  const rows = await db.execute('SELECT id, file_name, file_size, uploaded_at, status, target_personnel, required_signers, signers_matrix, length(pdf_data) as pdf_len FROM signing_workspace_documents');
  console.log(`Found ${rows.rows.length} documents in signing_workspace_documents:`);
  for (const r of rows.rows) {
    console.log({
      id: r.id,
      file_name: r.file_name,
      uploaded_at: r.uploaded_at,
      status: r.status,
      target_personnel: r.target_personnel,
      required_signers: r.required_signers,
      has_pdf: Boolean(r.pdf_len),
      pdf_len: r.pdf_len
    });
  }
}

main().catch(console.error);
