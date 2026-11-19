import fs from "fs";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute("SELECT p12, p12_filename, p12_password, image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-usr-mu74lftk'");
  const row = rs.rows[0];
  if (!row) {
    throw new Error("Could not find Ace Malto P12 in dtr_generator!");
  }

  const p12Base64 = String(row.p12);
  const p12Buffer = Buffer.from(p12Base64, "base64");
  const p12Password = decryptP12Password(String(row.p12_password));
  const sigImage = row.image_digiSigned ? String(row.image_digiSigned) : null;

  console.log(`Loaded Ace Malto P12: ${p12Buffer.length} bytes, password length: ${p12Password.length}`);

  const pdfBytes = fs.readFileSync("scratch/clean_original_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const loc = findPersonnelSignatureCoordinates(pdfDoc, "Ace Malto");

  console.log("Found coordinates:", loc);

  const signedResult = await signPdfBuffer(pdfBytes, p12Base64, p12Password, {
    reason: "Civil Service Form No. 48 Digital Signature - DICT Region V Signing Workspace",
    signerName: "Ace Mata Malto",
    pageIndex: loc.pageIndex,
    sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
    sigRects: loc.sigRects,
    signatureImage: sigImage,
  });

  console.log(`Successfully signed! Output PDF length: ${signedResult.signedBuffer.length}`);
  fs.writeFileSync("scratch/ace_dtr_perfect_signed.pdf", signedResult.signedBuffer);
  console.log("Saved scratch/ace_dtr_perfect_signed.pdf!");
}

main().catch(console.error);
