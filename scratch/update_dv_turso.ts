import fs from "fs";
import { db } from "../server/db.js";

async function updateDv() {
  const buf = fs.readFileSync("scratch/signed_dv_perfect.pdf");
  const newB64 = `data:application/pdf;base64,${buf.toString("base64")}`;
  const notes = 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 in column D (5-8px gap, box: [421, 183, 558, 201])';

  const row = await db.execute({
    sql: "SELECT remarks FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-8-j69c"],
  });

  const remarksObj = row.rows[0]?.remarks ? JSON.parse(row.rows[0].remarks as string) : {};
  remarksObj.notes = notes;
  if (!remarksObj.signers) remarksObj.signers = [];
  const sIdx = remarksObj.signers.findIndex((s: any) => s.name.includes("ANNABEL") || s.name.includes("ODO"));
  if (sIdx >= 0) {
    remarksObj.signers[sIdx].status = "signed";
    remarksObj.signers[sIdx].position = "above";
  }

  await db.execute({
    sql: "UPDATE dtr_storage SET pdf_data = ?, remarks = ?, status = 'signed' WHERE id = ?",
    args: [newB64, JSON.stringify(remarksObj), "doc-upload-1794223582282-8-j69c"],
  });
  console.log("Successfully updated DV in Turso!");
  process.exit(0);
}

updateDv().catch((e) => {
  console.error(e);
  process.exit(1);
});
