import { PDFDocument, StandardFonts } from "pdf-lib";
import { scanPdfForSigners, findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf.js";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Supervisor Section
  page.drawText("Cash Advance necessary, lawful and incurred under my direct supervision.", { x: 20, y: 440, size: 8, font });
  page.drawText("NORLY A. TABO", { x: 250, y: 396, size: 10, font: fontBold });
  page.drawText("OIC Chief, Technical Operations Division", { x: 200, y: 382, size: 8, font });
  page.drawText("Printed Name, Designation and Signature of Supervisor", { x: 180, y: 370, size: 7, font });

  // Section C (Accountant)
  page.drawText("C. Certified :", { x: 20, y: 270, size: 9, font: fontBold });
  page.drawText("Signature", { x: 20, y: 205, size: 8, font });
  page.drawText("Printed Name", { x: 20, y: 174, size: 8, font });
  page.drawText("AIVAN M. BALOLOY", { x: 100, y: 174, size: 9, font: fontBold });
  page.drawText("Accountant III", { x: 100, y: 155, size: 8, font });

  // Section D (Approved for Payment)
  page.drawText("D. Approved for Payment :", { x: 318, y: 270, size: 9, font: fontBold });
  page.drawText("Signature", { x: 318, y: 205, size: 8, font });
  page.drawText("Printed Name", { x: 318, y: 174, size: 8, font });
  page.drawText("ACEMATA MALTO", { x: 420, y: 174, size: 9, font: fontBold });
  page.drawText("OIC-Regional Director", { x: 420, y: 155, size: 8, font });

  const bytes = await doc.save();
  const pDoc = await PDFDocument.load(bytes);

  const users = [
    { name: "Ace Malto", role: "Super Admin" },
    { name: "Norly A. Tabo", role: "Supervisor" },
    { name: "Aivan M. Baloloy", role: "Accountant" },
    { name: "Annabel C. Odoño-Calimpong", role: "Regional Director" }
  ];

  const scan = await scanPdfForSigners(bytes, users);
  console.log("=== SCAN RESULTS ===");
  console.log("Scan primaryPersonnel:", scan.primaryPersonnel);
  console.log("Scan requiredSigners:", scan.requiredSigners);
  console.log("Scan signers:", scan.signers.map(s => ({ name: s.name, y: s.y, isAlreadySigned: s.isAlreadySigned, status: s.status })));

  console.log("\n=== COORDINATE RESOLUTION ===");
  console.log("Target ACEMATA MALTO:");
  const locAce = findPersonnelSignatureCoordinates(pDoc, "ACEMATA MALTO");
  console.log(locAce);

  console.log("\nTarget Odoño-Calimpong Annabel Cortez (Keystore Name):");
  const locAnnabel = findPersonnelSignatureCoordinates(pDoc, "Odoño-Calimpong Annabel Cortez");
  console.log(locAnnabel);

  console.log("\nTarget NORLY A. TABO:");
  const locNorly = findPersonnelSignatureCoordinates(pDoc, "NORLY A. TABO");
  console.log(locNorly);
}

main().catch(console.error);
