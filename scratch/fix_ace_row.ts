import { db } from '../server/db.js';

async function fixAceRow() {
  const req = JSON.stringify(["ACE MALTO", "RENE JANE R. BUENA"]);
  const matrix = JSON.stringify([
    {
      name: "ACE MALTO",
      role: "Technical Specialist",
      status: "signed",
      position: "above",
      signedAt: "2026-11-10T03:05:57.054Z",
      p12CommonName: "Malto Ace Mata"
    },
    {
      name: "RENE JANE R. BUENA",
      role: "Provincial Officer - Albay",
      status: "pending",
      position: "above"
    }
  ]);

  await db.execute({
    sql: `UPDATE signing_workspace_documents 
          SET required_signers = ?, signers_matrix = ?, status = 'partially_signed', target_personnel = 'ACE MATA MALTO'
          WHERE id = 'doc-upload-1794277438673-0-d1i5'`,
    args: [req, matrix]
  });
  console.log("Updated doc-upload-1794277438673-0-d1i5 successfully!");
  process.exit(0);
}

fixAceRow().catch(console.error);
