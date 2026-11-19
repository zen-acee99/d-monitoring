import { db } from "../server/db.js";

async function main() {
  const dtr = await db.execute("SELECT id, pdf_filename, status, module, remarks FROM dtr_storage WHERE pdf_filename LIKE '%DV%' OR pdf_filename LIKE '%voucher%' OR remarks LIKE '%MALTO%' OR remarks LIKE '%TABO%'");
  console.log(`dtr_storage found ${dtr.rows.length}:`);
  for (const r of dtr.rows) {
    console.log(r.id, r.pdf_filename, r.module);
  }

  const sw = await db.execute("SELECT id, file_name, status, target_personnel, required_signers FROM signing_workspace_documents");
  console.log(`signing_workspace_documents found ${sw.rows.length}:`);
  for (const r of sw.rows) {
    console.log(r.id, r.file_name, r.target_personnel, r.required_signers);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
