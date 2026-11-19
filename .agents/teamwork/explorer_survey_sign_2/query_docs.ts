import { db } from "../../../server/db.js";

async function main() {
  const r = await db.execute(`
    SELECT id, file_name, status, target_personnel, required_signers, notes, 
           length(pdf_data) as pdf_len, length(signature_image) as sig_len 
    FROM signing_workspace_documents 
    WHERE file_name LIKE '%Elena%' OR file_name LIKE '%Labo%' OR file_name LIKE '%Irosin%'
  `);
  console.log(JSON.stringify(r.rows, null, 2));
}

main().catch(console.error);
