import fs from "fs";
import { signUploadedPersonnelPdfBytes } from "./src/utils/dtrVectorPdf.ts";

async function testSign() {
  const filePath = "C:\\Users\\Ace\\Downloads\\Documents\\AAR_LibonAlbay.docx_3.pdf";
  const buf = fs.readFileSync(filePath);
  
  // Test with dummy signature image or null
  const res = await signUploadedPersonnelPdfBytes(
    buf,
    "ACE M. MALTO",
    null,
    null,
    { isCounterSign: false }
  );

  console.log("Signed bytes length:", res.bytes.length);
  fs.writeFileSync("test_signed_output.pdf", res.bytes);
  console.log("Saved test_signed_output.pdf");
}

testSign();
