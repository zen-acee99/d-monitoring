import fs from "fs";
import { db } from "../server/db.js";

async function updateRevistual() {
  const buf = fs.readFileSync("scratch/test_revistual_signed_dual.pdf");
  const newB64 = `data:application/pdf;base64,${buf.toString("base64")}`;
  const notes = 'Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 (dual DTR copies, 5-8px gap, boxes: [[102, 88, 239, 106], [412, 88, 549, 106]])';

  const row = await db.execute({
    sql: "SELECT remarks FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-5-8re5"],
  });

  const remarksObj = row.rows[0]?.remarks ? JSON.parse(row.rows[0].remarks as string) : {};
  remarksObj.notes = notes;
  remarksObj.targetPersonnel = "NOREEN ANN S. REVISTUAL";
  remarksObj.requiredSigners = ["ANNABEL C. ODOÑO-CALIMPONG"];
  remarksObj.signers = [
    {
      name: "NOREEN ANN S. REVISTUAL",
      role: "Employee",
      status: "signed",
      position: "above",
      signedAt: "D:20261109162637+08'00'",
      p12CommonName: "Revistual Noreen Ann Sabularse",
      isCounterSign: false,
    },
    {
      name: "ANNABEL C. ODOÑO-CALIMPONG",
      role: "Regional Director",
      status: "signed",
      position: "above",
      signedAt: "2026-11-09T15:45:15.000Z",
      p12CommonName: "Odoño-Calimpong Annabel Cortez",
      isCounterSign: false,
    },
  ];

  if (remarksObj.scannedInfo) {
    remarksObj.scannedInfo.primaryPersonnel = "NOREEN ANN S. REVISTUAL";
    remarksObj.scannedInfo.existingSignatures = [
      { pageIndex: 0, rect: [119.782, 147.27, 185.237, 181.961], signerName: "Revistual Noreen Ann Sabularse", isSigned: true },
      { pageIndex: 0, rect: [428.729, 150.543, 496.802, 189.161], signerName: "Revistual Noreen Ann Sabularse", isSigned: true },
      { pageIndex: 0, rect: [102, 88, 239, 106], signerName: "Odoño-Calimpong Annabel Cortez", isSigned: true },
      { pageIndex: 0, rect: [412, 88, 549, 106], signerName: "Odoño-Calimpong Annabel Cortez", isSigned: true },
    ];
  }

  await db.execute({
    sql: "UPDATE dtr_storage SET pdf_data = ?, remarks = ?, status = 'signed' WHERE id = ?",
    args: [newB64, JSON.stringify(remarksObj), "doc-upload-1794223582282-5-8re5"],
  });

  console.log("Successfully updated REVISTUAL DTR in Turso with clean dual signatures above name!");
  process.exit(0);
}

updateRevistual().catch((e) => {
  console.error(e);
  process.exit(1);
});
