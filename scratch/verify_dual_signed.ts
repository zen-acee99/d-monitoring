import fs from "fs";
import { PDFDocument } from "pdf-lib";

async function verify() {
  const doc = await PDFDocument.load(fs.readFileSync("scratch/test_revistual_signed_dual.pdf"), { ignoreEncryption: true });
  console.log("Fields in signed dual DTR:");
  doc.getForm().getFields().forEach(f => {
    console.log(" -", f.getName());
  });

  process.exit(0);
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});
