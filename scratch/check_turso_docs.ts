import { db } from "../server/db";

async function main() {
  const countRes = await db.execute("SELECT count(*) as count FROM signing_workspace_documents");
  console.log("Count in signing_workspace_documents:", countRes.rows);

  const listRes = await db.execute("SELECT id, file_name, status, uploaded_by, target_personnel FROM signing_workspace_documents LIMIT 30");
  console.log("Documents in signing_workspace_documents:", listRes.rows);
}

main().catch(console.error);
