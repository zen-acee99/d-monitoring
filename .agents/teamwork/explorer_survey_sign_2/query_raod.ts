import { db } from "../../../server/db.js";

async function main() {
  const r = await db.execute({
    sql: "SELECT id, file_name, status, target_personnel, required_signers, signers_matrix, notes FROM signing_workspace_documents WHERE file_name LIKE '%COS-PNPKI%'",
    args: []
  });
  console.log(JSON.stringify(r.rows, null, 2));
}

main().catch(console.error);
