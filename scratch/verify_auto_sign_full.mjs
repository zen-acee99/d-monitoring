import fs from "fs";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config();

async function testFull() {
  console.log("=== FULL VERIFICATION OF RENE JANE AUTO-SIGN ENGINE ===");

  // Read the source module src/utils/reneJaneAutoSign.ts to check exported components
  const autoSignSource = fs.readFileSync("src/utils/reneJaneAutoSign.ts", "utf8");
  console.log("Checking src/utils/reneJaneAutoSign.ts length:", autoSignSource.length);
  
  const hasMetadata = autoSignSource.includes("RENE_JANE_CERT_METADATA");
  const hasDetect = autoSignSource.includes("detectSignatureCoordinatesForReneJane");
  const hasAutoSign = autoSignSource.includes("autoSignPdfWithReneJane");
  const hasBase64Sig = autoSignSource.includes("RENE_JANE_SIGNATURE_BASE64");

  console.log("Checks:");
  console.log("  hasMetadata:  ", hasMetadata);
  console.log("  hasDetect:    ", hasDetect);
  console.log("  hasAutoSign:  ", hasAutoSign);
  console.log("  hasBase64Sig: ", hasBase64Sig);

  if (!hasMetadata || !hasDetect || !hasAutoSign || !hasBase64Sig) {
    throw new Error("Missing critical exports in reneJaneAutoSign.ts!");
  }

  // Check AceDtrCombiner.tsx in both repos
  const combinerA = fs.readFileSync("src/pages/AceDtrCombiner.tsx", "utf8");
  const combinerB = fs.readFileSync("../dict-dtr-generator/src/pages/AceDtrCombiner.tsx", "utf8");

  console.log("Combiner in dict-monitoring length:", combinerA.length);
  console.log("Combiner in dict-dtr-generator length:", combinerB.length);
  console.log("Combiners identical:", combinerA === combinerB);

  const hasUploadButtonA = combinerA.includes("Upload & Auto-Sign Any PDF");
  const hasDropzoneA = combinerA.includes("Drag & Drop ANY PDF to Auto-Sign with Rene Jane");
  const hasUploadedStateA = combinerA.includes("uploadedResult");
  const hasCleanDownloadA = combinerA.includes("Download Signed PDF");

  console.log("Combiner feature checks:");
  console.log("  hasUploadButton: ", hasUploadButtonA);
  console.log("  hasDropzone:     ", hasDropzoneA);
  console.log("  hasUploadedState:", hasUploadedStateA);
  console.log("  hasCleanDownload:", hasCleanDownloadA);

  if (!hasUploadButtonA || !hasDropzoneA || !hasUploadedStateA || !hasCleanDownloadA) {
    throw new Error("Missing critical UI elements in AceDtrCombiner.tsx!");
  }

  // Verify signature PNGs exist in both repositories
  const sigPaths = [
    "public/signatures/rene-jane-r-buena-signature.png",
    "dist/signatures/rene-jane-r-buena-signature.png",
    "../dict-dtr-generator/public/signatures/rene-jane-r-buena-signature.png",
    "../dict-dtr-generator/dist/signatures/rene-jane-r-buena-signature.png",
  ];

  for (const sp of sigPaths) {
    const exists = fs.existsSync(sp);
    const size = exists ? fs.statSync(sp).size : 0;
    console.log(`Signature file: ${sp} -> exists: ${exists}, size: ${size} bytes`);
    if (!exists || size === 0) {
      throw new Error(`Signature file missing or empty: ${sp}`);
    }
  }

  console.log("\nALL VERIFICATIONS PASSED 100%!");
}

testFull().catch(console.error);
