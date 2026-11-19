import { db } from '../server/db.js';
import { recheckDocWithLatestUsers } from '../src/utils/dtrVectorPdf.js';
import { DEFAULT_USERS } from '../src/data/userStore.js';

async function main() {
  const res = await db.execute("SELECT * FROM signing_workspace_documents WHERE id = 'doc-upload-1794277438673-0-d1i5'");
  if (res.rows.length === 0) {
    console.log("No row in signing_workspace_documents");
    return;
  }
  const r = res.rows[0];
  const rawDoc = {
    id: r.id,
    fileName: r.file_name,
    status: r.status,
    targetPersonnel: r.target_personnel,
    requiredSigners: JSON.parse(r.required_signers as string),
    signers: JSON.parse(r.signers_matrix as string),
    scannedInfo: r.scanned_info ? JSON.parse(r.scanned_info as string) : null,
  };
  console.log("rawDoc requiredSigners:", rawDoc.requiredSigners);
  console.log("rawDoc signers:", rawDoc.signers);

  const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
  const { updatedDoc } = recheckDocWithLatestUsers(rawDoc, freshUsers);
  console.log("updatedDoc requiredSigners:", updatedDoc.requiredSigners);
  console.log("updatedDoc signers:", updatedDoc.signers);
  process.exit(0);
}

main();
