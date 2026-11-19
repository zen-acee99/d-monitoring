import fs from "fs";
import { scanPdfForSigners } from "../src/utils/dtrVectorPdf";

async function main() {
  const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
  const testUsers = [
    { name: "Ace Malto", role: "Technical Specialist", email: "ace.malto@dict.gov.ph" },
    { name: "Annabel C. Odoño-Calimpong", role: "OIC-Regional Director", email: "annabel.calimpong@dict.gov.ph" },
    { name: "Rene Jane R. Buena", role: "Provincial Officer - Albay", email: "rene.buena@dict.gov.ph" },
    { name: "Leah B. Dy", role: "Chief, AFMD", email: "leah.dy@dict.gov.ph" },
  ];

  const result = await scanPdfForSigners(bytes, testUsers);
  console.log("Scan Result:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
