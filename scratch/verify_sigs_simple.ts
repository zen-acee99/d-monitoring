import fs from "fs";
import { PDFDocument } from "pdf-lib";

async function verify() {
  const toDoc = await PDFDocument.load(fs.readFileSync("scratch/signed_to_perfect.pdf"), { ignoreEncryption: true });
  console.log("Travel Order Fields:");
  toDoc.getForm().getFields().forEach(f => {
    console.log(" -", f.getName());
  });

  const dvDoc = await PDFDocument.load(fs.readFileSync("scratch/signed_dv_perfect.pdf"), { ignoreEncryption: true });
  console.log("DV Fields:");
  dvDoc.getForm().getFields().forEach(f => {
    console.log(" -", f.getName());
  });

  process.exit(0);
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
