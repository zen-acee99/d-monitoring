import { db } from '../server/db.js';

async function fixMemo() {
  const req = JSON.stringify(["ANNABEL C. ODOÑO-CALIMPONG", "CHRISTIAN ROY N. MELAD"]);
  const matrix = JSON.stringify([
    {
      name: "ANNABEL C. ODOÑO-CALIMPONG",
      role: "Regional Director",
      status: "signed",
      position: "above",
      signedAt: "2026-11-10T10:21:52.870Z",
      p12CommonName: "Annabel C. Odoño-Calimpong"
    },
    {
      name: "CHRISTIAN ROY N. MELAD",
      role: "OIC, ROCS",
      status: "pending",
      position: "above"
    }
  ]);

  await db.execute({
    sql: `UPDATE signing_workspace_documents 
          SET required_signers = ?, signers_matrix = ?, status = 'partially_signed', target_personnel = 'ANNABEL C. ODOÑO-CALIMPONG'
          WHERE id = 'doc-upload-1794305927743-0-zxjr'`,
    args: [req, matrix]
  });
  console.log("Updated 138_Memo successfully!");
  process.exit(0);
}

fixMemo().catch(console.error);
