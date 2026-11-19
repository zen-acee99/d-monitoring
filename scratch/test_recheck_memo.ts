import { db } from '../server/db.js';
import { recheckDocWithLatestUsers } from '../src/utils/dtrVectorPdf.js';
import { getStoredUsers, DEFAULT_USERS } from '../src/data/userStore.js';

async function main() {
  const res = await db.execute("SELECT * FROM dtr_storage WHERE id = 'doc-upload-1794305927743-0-zxjr'");
  const r = res.rows[0];
  
  // Simulate mapDtrRecordToWorkspaceDoc
  const target = r.employee_name || "PERSONNEL";
  const doc: any = {
    id: r.id,
    fileName: r.pdf_filename,
    status: r.status,
    targetPersonnel: target,
    requiredSigners: [target],
    signers: [
      {
        name: target,
        role: "Signatory",
        status: r.status === "signed" ? "signed" : "pending",
        position: "above",
      }
    ],
    scannedInfo: null // because remarks / scannedInfo was null!
  };

  const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
  console.log("Before recheck:", JSON.stringify({ requiredSigners: doc.requiredSigners, signers: doc.signers }));
  
  const { updatedDoc } = recheckDocWithLatestUsers(doc, freshUsers);
  console.log("After recheck:", JSON.stringify({ requiredSigners: updatedDoc.requiredSigners, signers: updatedDoc.signers }));
}

main().catch(console.error).finally(() => process.exit(0));
