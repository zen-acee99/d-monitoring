import { db } from "../server/db.js";

async function checkAr() {
  const rs = await db.execute({
    sql: "SELECT id, pdf_filename, status, remarks FROM dtr_storage WHERE pdf_filename LIKE '%AR%' OR pdf_filename LIKE '%Accomplish%'",
  });
  console.log("Found " + rs.rows.length + " AR records:");
  for (const r of rs.rows) {
    console.log(r.id, r.pdf_filename, r.status);
    if (r.remarks) {
      try {
        const rem = JSON.parse(r.remarks as string);
        console.log(" - signers:", rem.signers);
        console.log(" - requiredSigners:", rem.requiredSigners);
      } catch {}
    }
  }
  process.exit(0);
}

checkAr().catch((e) => {
  console.error(e);
  process.exit(1);
});
