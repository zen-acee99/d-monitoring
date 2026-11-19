import fs from "fs";
import { scanPdfForSigners, findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf";
import { PDFDocument } from "pdf-lib";

async function main() {
  const bytes = fs.readFileSync("scratch/clean_original_ace_dtr.pdf");
  const testUsers = [
    { name: "Ace Malto", role: "Technical Specialist", email: "ace.malto@dict.gov.ph" },
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Rene Jane R. Buena", role: "Provincial Officer - Albay", email: "rene.buena@dict.gov.ph" },
  ];

  const scan = await scanPdfForSigners(bytes, testUsers);
  console.log("Scan Result:", JSON.stringify(scan, null, 2));

  const pdfDoc = await PDFDocument.load(bytes);
  const coords = findPersonnelSignatureCoordinates(pdfDoc, "Ace Malto");
  console.log("Signature Coords for Ace Malto:", JSON.stringify(coords, null, 2));
}

main().catch(console.error);
