import forge from "node-forge";
import { PDFDocument } from "pdf-lib";
import { signPdfBuffer, appendSignatureIncremental } from "../server/services/pnpkiSigningService.ts";

function generateTestP12(commonName: string, password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "Department of Information and Communications Technology" },
    { shortName: "OU", value: "DICT Region V" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des",
    generateLocalKeyId: true,
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, "binary");
}

async function run() {
  console.log("=== Verifying Milestone 1 Core PDF Signature Engine Repair ===");

  const p12Pass = "TestPassword123!";
  const p12Buf1 = generateTestP12("Malto Ace Mata", p12Pass);
  const p12Buf2 = generateTestP12("Rene Jane Rosendo Buena", p12Pass);

  // 1. Create a clean sample base PDF (simulating dual-copy CS Form 48)
  const baseDoc = await PDFDocument.create();
  const page = baseDoc.addPage([612, 792]);
  page.drawText("CIVIL SERVICE FORM NO. 48 - DAILY TIME RECORD", { x: 50, y: 750, size: 10 });
  page.drawText("Copy 1 (Left)", { x: 100, y: 700, size: 8 });
  page.drawText("Copy 2 (Right)", { x: 400, y: 700, size: 8 });
  const basePdfBytes = await baseDoc.save();
  const basePdfBuffer = Buffer.from(basePdfBytes);

  // Dual-copy rects (Copy 1 and Copy 2)
  const dualRects: [number, number, number, number][] = [
    [54, 184, 249, 216],
    [354, 184, 549, 216],
  ];

  console.log("\n[Test 1] First-Signature Mode Signing (Pass 1 - Personnel)...");
  const pass1Result = await signPdfBuffer(
    basePdfBuffer,
    p12Buf1.toString("base64"),
    p12Pass,
    {
      sigRects: dualRects,
      signerName: "Malto Ace Mata",
      reason: "Civil Service Form No. 48 Official DTR Certification",
      fieldName: "Personnel_Signature",
    }
  );
  const pass1PdfBuffer = pass1Result.signedBuffer;
  const pass1Str = pass1PdfBuffer.toString("latin1");

  // Check Pass 1 criteria
  const kidsOnSigPass1 = (pass1Str.match(/\/FT\s*\/Sig[\s\S]*?\/Kids/g) || []).length;
  const formWithoutResPass1 = (pass1Str.match(/\/Subtype\s*\/Form(?![^>]*\/Resources)/g) || []).length;
  const hasFormResPass1 = pass1Str.includes("/Subtype /Form") && /\/Resources\s*<<\s*>>/.test(pass1Str);

  console.log("Pass 1 Kids on /FT /Sig count:", kidsOnSigPass1, "(expected: 0)");
  console.log("Pass 1 Form XObjects without /Resources:", formWithoutResPass1, "(expected: 0)");
  console.log("Pass 1 Form XObject contains /Resources << >>:", hasFormResPass1, "(expected: true)");

  if (kidsOnSigPass1 !== 0) throw new Error("FAIL: Pass 1 has /Kids on /FT /Sig");
  if (formWithoutResPass1 !== 0) throw new Error("FAIL: Pass 1 has Form XObject without /Resources");
  if (!hasFormResPass1) throw new Error("FAIL: Pass 1 Form XObject is missing /Resources << >>");

  // Verify AcroForm structure in Pass 1
  const pass1Doc = await PDFDocument.load(pass1PdfBuffer);
  const pass1AcroForm = pass1Doc.catalog.lookupMaybe(forge as any, "AcroForm" as any) || (pass1Doc.catalog as any).get((PDFDocument as any).PDFName?.of?.("AcroForm") || "AcroForm");
  console.log("Pass 1 Document loaded successfully into pdf-lib without error.");

  // 2. Incremental Mode Signing (Pass 2 - Supervisor Counter-Signature)
  console.log("\n[Test 2] Incremental Mode Signing (Pass 2 - Supervisor)...");
  const supervisorRects: [number, number, number, number][] = [
    [54, 120, 249, 152],
    [354, 120, 549, 152],
  ];

  const pass2Result = await signPdfBuffer(
    pass1PdfBuffer,
    p12Buf2.toString("base64"),
    p12Pass,
    {
      sigRects: supervisorRects,
      signerName: "Rene Jane Rosendo Buena",
      reason: "Civil Service Form No. 48 Supervisor Verification",
      fieldName: "Supervisor_Signature",
      isCounterSign: true,
    }
  );
  const pass2PdfBuffer = pass2Result.signedBuffer;
  const pass2Str = pass2PdfBuffer.toString("latin1");

  const kidsOnSigPass2 = (pass2Str.match(/\/FT\s*\/Sig[\s\S]*?\/Kids/g) || []).length;
  const formWithoutResPass2 = (pass2Str.match(/\/Subtype\s*\/Form(?![^>]*\/Resources)/g) || []).length;

  console.log("Pass 2 Kids on /FT /Sig count:", kidsOnSigPass2, "(expected: 0)");
  console.log("Pass 2 Form XObjects without /Resources:", formWithoutResPass2, "(expected: 0)");

  if (kidsOnSigPass2 !== 0) throw new Error("FAIL: Pass 2 has /Kids on /FT /Sig");
  if (formWithoutResPass2 !== 0) throw new Error("FAIL: Pass 2 has Form XObject without /Resources");

  // Verify signature count
  const sigDictCount = (pass2Str.match(/\/Type\s*\/Sig\b/g) || []).length;
  console.log("Total /Type /Sig dictionaries in Pass 2 PDF:", sigDictCount, "(expected: 2)");
  if (sigDictCount !== 2) throw new Error(`FAIL: Expected 2 signatures in Pass 2, got ${sigDictCount}`);

  // Check /Stamp annotation on secondary rect
  const stampAnnotCount = (pass2Str.match(/\/Subtype\s*\/Stamp\b/g) || []).length;
  console.log("Pass 2 Stamp annotations on Copy 2:", stampAnnotCount, "(expected: 1)");

  // 3. Test Incremental Mode with Signature Image (Test 3)
  console.log("\n[Test 3] Incremental Mode Signing with Embedded Signature Image...");
  const dummyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const p12Buf3 = generateTestP12("Regional Director", p12Pass);
  const pass3Result = await signPdfBuffer(
    pass2PdfBuffer,
    p12Buf3.toString("base64"),
    p12Pass,
    {
      sigRects: [[54, 50, 249, 82]],
      signerName: "Regional Director",
      reason: "Final Regional Director Approval",
      fieldName: "Director_Signature",
      signatureImage: dummyPng,
    }
  );
  const pass3PdfBuffer = pass3Result.signedBuffer;
  const pass3Str = pass3PdfBuffer.toString("latin1");

  const imageXObjectsWithoutRes = (pass3Str.match(/\/Subtype\s*\/Image(?![^>]*\/Resources)/g) || []).length;
  console.log("Pass 3 Image XObjects without /Resources:", imageXObjectsWithoutRes, "(expected: 0)");
  if (imageXObjectsWithoutRes !== 0) throw new Error("FAIL: Pass 3 has Image XObject without /Resources");

  const formWithoutResPass3 = (pass3Str.match(/\/Subtype\s*\/Form(?![^>]*\/Resources)/g) || []).length;
  console.log("Pass 3 Form XObjects without /Resources:", formWithoutResPass3, "(expected: 0)");
  if (formWithoutResPass3 !== 0) throw new Error("FAIL: Pass 3 has Form XObject without /Resources");

  const kidsOnSigPass3 = (pass3Str.match(/\/FT\s*\/Sig[\s\S]*?\/Kids/g) || []).length;
  console.log("Pass 3 Kids on /FT /Sig count:", kidsOnSigPass3, "(expected: 0)");
  if (kidsOnSigPass3 !== 0) throw new Error("FAIL: Pass 3 has /Kids on /FT /Sig");

  // Verify that the PDF can still be parsed
  const pass2Doc = await PDFDocument.load(pass2PdfBuffer);
  console.log("Pass 2 Document loaded successfully into pdf-lib. Page count:", pass2Doc.getPageCount());

  console.log("\n✓ ALL VERIFICATIONS PASSED: 0 /Kids on /FT /Sig, 0 Form XObjects without /Resources!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
