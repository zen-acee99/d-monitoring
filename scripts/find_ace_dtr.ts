import { db } from "../server/db.js";

async function main() {
  const rs1 = await db.execute({
    sql: "SELECT id, file_name, file_size, status, target_personnel, required_signers, signers_matrix, notes, created_at FROM signing_workspace_documents ORDER BY created_at DESC",
    args: []
  });
  console.log("signing_workspace_documents count:", rs1.rows.length);
  for (const r of rs1.rows) {
    console.log(`[SW] ${r.file_name} | status: ${r.status} | target: ${r.target_personnel} | ID: ${r.id}`);
  }

  const rs2 = await db.execute({
    sql: "SELECT id, pdf_filename, status, employee_name, created_at, module FROM dtr_storage ORDER BY created_at DESC LIMIT 10",
    args: []
  });
  console.log("\ndtr_storage count:", rs2.rows.length);
  for (const r of rs2.rows) {
    console.log(`[DTR] ${r.pdf_filename} | status: ${r.status} | emp: ${r.employee_name} | mod: ${r.module} | ID: ${r.id}`);
  }
}

main().catch(console.error);
