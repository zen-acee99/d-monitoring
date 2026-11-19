import fs from "fs";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/ace_dtr_perfect_signed.pdf");
  const testUsers = [
    { name: "Ace Malto", role: "Technical Specialist", email: "ace.malto@dict.gov.ph" },
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Rene Jane R. Buena", role: "Provincial Officer - Albay", email: "rene.buena@dict.gov.ph" },
  ];

  const scan = await scanPdfForSigners(bytes, testUsers);
  console.log("Scan Result on signed PDF:", JSON.stringify(scan, null, 2));
}

main().catch(console.error);
