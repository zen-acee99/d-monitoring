import { db } from "../server/db";
import { signPdfBuffer, decryptP12Password, getSignerIdentityFromP12 } from "../server/services/pnpkiSigningService";
import { PDFDocument } from "pdf-lib";
import fs from "fs";

async function test4Signatures() {
  console.log("=== Testing 4 Sequential Signatures (2 Personnel + 2 Supervisor) ===");

  const all = await db.execute("SELECT * FROM dtr_generator WHERE p12 IS NOT NULL");
  const ralph = all.rows.find((r: any) => r.Name.includes("Dela Torre"));
  const ace = all.rows.find((r: any) => r.Name.includes("Malto"));

  const ralphPass = ralph.p12_password ? decryptP12Password(String(ralph.p12_password)) : undefined;
  const acePass = ace.p12_password ? decryptP12Password(String(ace.p12_password)) : undefined;

  // Base PDF
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText("Test 4-Signature Document (Civil Service Form 48)", { x: 50, y: 700 });
  const basePdfBytes = await doc.save();
  let currentBuffer = Buffer.from(basePdfBytes);

  // 1. Personnel Copy 1 [99, 235, 120, 22]
  console.log("\n--- Signing 1/4: Personnel Copy 1 ---");
  const res1 = await signPdfBuffer(
    currentBuffer,
    String(ralph.p12),
    ralphPass,
    {
      sigRect: [99, 235, 120, 22],
      fieldName: "Personnel_Signature_Copy1",
      reason: "Civil Service Form No. 48 Daily Time Record Submission (Copy 1)",
    }
  );
  currentBuffer = res1.signedBuffer;
  console.log("Signed 1/4, size:", currentBuffer.length, "bytes");

  // 2. Personnel Copy 2 [393, 235, 120, 22]
  console.log("\n--- Signing 2/4: Personnel Copy 2 ---");
  const res2 = await signPdfBuffer(
    currentBuffer,
    String(ralph.p12),
    ralphPass,
    {
      sigRect: [393, 235, 120, 22],
      fieldName: "Personnel_Signature_Copy2",
      reason: "Civil Service Form No. 48 Daily Time Record Submission (Copy 2)",
    }
  );
  currentBuffer = res2.signedBuffer;
  console.log("Signed 2/4, size:", currentBuffer.length, "bytes");

  // 3. Supervisor Copy 1 [99, 178, 120, 22]
  console.log("\n--- Signing 3/4: Supervisor Copy 1 ---");
  const res3 = await signPdfBuffer(
    currentBuffer,
    String(ace.p12),
    acePass,
    {
      sigRect: [99, 178, 120, 22],
      fieldName: "Supervisor_Signature_Copy1",
      reason: "Civil Service Form No. 48 Official Verification (Copy 1)",
    }
  );
  currentBuffer = res3.signedBuffer;
  console.log("Signed 3/4, size:", currentBuffer.length, "bytes");

  // 4. Supervisor Copy 2 [393, 178, 120, 22]
  console.log("\n--- Signing 4/4: Supervisor Copy 2 ---");
  const res4 = await signPdfBuffer(
    currentBuffer,
    String(ace.p12),
    acePass,
    {
      sigRect: [393, 178, 120, 22],
      fieldName: "Supervisor_Signature_Copy2",
      reason: "Civil Service Form No. 48 Official Verification (Copy 2)",
    }
  );
  currentBuffer = res4.signedBuffer;
  console.log("Signed 4/4, size:", currentBuffer.length, "bytes");

  fs.writeFileSync("test_4_signatures.pdf", currentBuffer);
  console.log("\nSaved test_4_signatures.pdf successfully!");

  const pdfText = currentBuffer.toString("binary");
  const sigMatches = pdfText.match(/\/Type\s*\/Sig/g);
  console.log("\nTotal /Type /Sig found in PDF binary:", sigMatches ? sigMatches.length : 0);

  const nameMatches = pdfText.match(/\/Name\s*\(([^)]+)\)/g);
  console.log("Names in PDF signature dicts:", nameMatches);

  const fieldMatches = pdfText.match(/\/T\s*\(([^)]+)\)/g);
  console.log("Fields in PDF annotations:", fieldMatches);

  const byteRanges = pdfText.match(/\/ByteRange\s*\[[^\]]+\]/g);
  console.log("ByteRanges in PDF:", byteRanges);
}

test4Signatures().catch(console.error);
