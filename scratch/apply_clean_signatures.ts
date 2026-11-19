import fs from "fs";
import { db } from "../server/db.js";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService.js";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function run() {
  console.log("=== Applying Clean Signatures to DV and Travel Order ===");

  // Find Annabel's P12
  const annabelP12Res = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE (Name LIKE '%Annabel%' OR Name LIKE '%ODO%') AND p12 IS NOT NULL LIMIT 1",
  });

  if (annabelP12Res.rows.length === 0) {
    console.error("Annabel P12 not found in dtr_generator table!");
    process.exit(1);
  }

  const p12Row = annabelP12Res.rows[0];
  const p12Base64 = String(p12Row.p12);
  const password = p12Row.p12_password ? decryptP12Password(String(p12Row.p12_password)) : undefined;
  const sigImg = p12Row.image_digiSigned ? String(p12Row.image_digiSigned) : undefined;
  console.log("Loaded Annabel P12 successfully.");

  // 1. Process Travel Order
  const toRec = await db.execute({
    sql: "SELECT id, pdf_filename, pdf_data, remarks FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-6-zhyd"],
  });

  if (toRec.rows.length > 0) {
    const row = toRec.rows[0];
    console.log(`\nProcessing ${row.pdf_filename} (${row.id})...`);
    let sourceBytes: Buffer;
    if (fs.existsSync("scratch/test_to_real.pdf")) {
      sourceBytes = fs.readFileSync("scratch/test_to_real.pdf");
      console.log("Using pristine source scratch/test_to_real.pdf");
    } else {
      let b64 = row.pdf_data as string;
      if (b64.startsWith("data:")) b64 = b64.split(",")[1];
      sourceBytes = Buffer.from(b64, "base64");
    }

    const pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
      isCounterSign: false,
    });
    console.log("Calculated new coordinates for Travel Order:", coords);

    if (coords) {
      const sigRect: [number, number, number, number] = [
        coords.boxX,
        coords.boxY,
        coords.boxX + coords.boxW,
        coords.boxY + coords.boxH,
      ];

      const signRes = await signPdfBuffer(sourceBytes, p12Base64, password, {
        signerName: "Annabel C. Odoño-Calimpong",
        signatureImage: sigImg,
        sigRect,
        pageIndex: coords.pageIndex,
        isCounterSign: false,
        fieldName: "Signature_Annabel",
      });

      if (signRes && signRes.signedBuffer) {
        fs.writeFileSync("scratch/signed_to_perfect.pdf", signRes.signedBuffer);
        const newB64 = `data:application/pdf;base64,${signRes.signedBuffer.toString("base64")}`;

        const remarksObj = row.remarks ? JSON.parse(row.remarks as string) : {};
        remarksObj.notes = `Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 (5-8px gap, box: [${coords.boxX}, ${coords.boxY}, ${coords.boxX + coords.boxW}, ${coords.boxY + coords.boxH}])`;
        if (!remarksObj.signers) remarksObj.signers = [];
        const sIdx = remarksObj.signers.findIndex((s: any) => s.name.includes("ANNABEL") || s.name.includes("ODO"));
        if (sIdx >= 0) {
          remarksObj.signers[sIdx].status = "signed";
          remarksObj.signers[sIdx].position = "above";
        }

        await db.execute({
          sql: "UPDATE dtr_storage SET pdf_data = ?, remarks = ?, status = 'signed' WHERE id = ?",
          args: [newB64, JSON.stringify(remarksObj), row.id],
        });
        console.log("Successfully updated Travel Order in Turso dtr_storage!");
      }
    }
  }

  // 2. Process DV
  const dvRec = await db.execute({
    sql: "SELECT id, pdf_filename, pdf_data, remarks FROM dtr_storage WHERE id = ?",
    args: ["doc-upload-1794223582282-8-j69c"],
  });

  if (dvRec.rows.length > 0) {
    const row = dvRec.rows[0];
    console.log(`\nProcessing ${row.pdf_filename} (${row.id})...`);
    let sourceBytes: Buffer;
    if (fs.existsSync("scratch/test_dv_real.pdf")) {
      sourceBytes = fs.readFileSync("scratch/test_dv_real.pdf");
      console.log("Using pristine source scratch/test_dv_real.pdf");
    } else {
      let b64 = row.pdf_data as string;
      if (b64.startsWith("data:")) b64 = b64.split(",")[1];
      sourceBytes = Buffer.from(b64, "base64");
    }

    const pdfDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const coords = findPersonnelSignatureCoordinates(pdfDoc, "ANNABEL C. ODOÑO-CALIMPONG", {
      isCounterSign: false,
    });
    console.log("Calculated new coordinates for DV:", coords);

    if (coords) {
      const sigRect: [number, number, number, number] = [
        coords.boxX,
        coords.boxY,
        coords.boxX + coords.boxW,
        coords.boxY + coords.boxH,
      ];

      const signRes = await signPdfBuffer(sourceBytes, p12Base64, password, {
        signerName: "Annabel C. Odoño-Calimpong",
        signatureImage: sigImg,
        sigRect,
        pageIndex: coords.pageIndex,
        isCounterSign: false,
        fieldName: "Signature_Annabel",
      });

      if (signRes && signRes.signedBuffer) {
        fs.writeFileSync("scratch/signed_dv_perfect.pdf", signRes.signedBuffer);
        const newB64 = `data:application/pdf;base64,${signRes.signedBuffer.toString("base64")}`;

        const remarksObj = row.remarks ? JSON.parse(row.remarks as string) : {};
        remarksObj.notes = `Signed directly ABOVE personnel "ANNABEL C. ODOÑO-CALIMPONG" on page 1 in column D (5-8px gap, box: [${coords.boxX}, ${coords.boxY}, ${coords.boxX + coords.boxW}, ${coords.boxY + coords.boxH}])`;
        if (!remarksObj.signers) remarksObj.signers = [];
        const sIdx = remarksObj.signers.findIndex((s: any) => s.name.includes("ANNABEL") || s.name.includes("ODO"));
        if (sIdx >= 0) {
          remarksObj.signers[sIdx].status = "signed";
          remarksObj.signers[sIdx].position = "above";
        }

        await db.execute({
          sql: "UPDATE dtr_storage SET pdf_data = ?, remarks = ?, status = 'signed' WHERE id = ?",
          args: [newB64, JSON.stringify(remarksObj), row.id],
        });
        console.log("Successfully updated DV in Turso dtr_storage!");
      }
    }
  }

  console.log("\nAll done!");
  process.exit(0);
}

run().catch((e) => {
  console.error("Error applying clean signatures:", e);
  process.exit(1);
});
