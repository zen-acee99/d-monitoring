import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import forge from "node-forge";
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFDict, rgb } from "pdf-lib";
import { signPdfBuffer, appendSignatureIncremental } from "../server/services/pnpkiSigningService.ts";
import { RENE_JANE_SIGNATURE_BASE64 } from "../src/utils/reneJaneAutoSign.ts";

// Helper to generate a compliant RSA 2048 test .p12 keystore
function generateTestP12(commonName: string, password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + Date.now().toString(16) + Math.floor(Math.random() * 1000).toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "Department of Information and Communications Technology" },
    { shortName: "OU", value: "DICT Region V (Bicol)" },
    { name: "countryName", value: "PH" },
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

// Real signature PNG data URL for image embedding tests
const SAMPLE_SIGNATURE_PNG = RENE_JANE_SIGNATURE_BASE64;

// Structural Auditor
interface StructuralAuditResult {
  passed: boolean;
  kidsOnSigCount: number;
  formXObjectsWithoutResources: number;
  imageXObjectsWithoutResources: number;
  sigDictCount: number;
  acroFormFieldCount: number;
  isPdfLibParsable: boolean;
  errors: string[];
}

function auditPdfBinaryStructure(pdfBuf: Buffer): StructuralAuditResult {
  const pdfStr = pdfBuf.toString("latin1");
  const errors: string[] = [];

  // 1. Check for /Kids on any /FT /Sig field
  // ISO 32000-2 Clause 12.7.4.5: A digital signature field shall not have kids
  const sigKidsMatches = pdfStr.match(/\/FT\s*\/Sig[\s\S]*?\/Kids/g) || [];
  const kidsOnSigCount = sigKidsMatches.length;
  if (kidsOnSigCount > 0) {
    errors.push(`Found ${kidsOnSigCount} /FT /Sig fields containing non-terminal /Kids array`);
  }

  // 2. Check Form XObjects without /Resources
  // Adobe Acrobat PPKLite throws "Expected a dict object" if Form XObject lacks /Resources
  const formWithoutResMatches = pdfStr.match(/\/Subtype\s*\/Form(?![^>]*\/Resources)/g) || [];
  const formXObjectsWithoutResources = formWithoutResMatches.length;
  if (formXObjectsWithoutResources > 0) {
    errors.push(`Found ${formXObjectsWithoutResources} Form XObjects lacking /Resources dictionary`);
  }

  // 3. Check Image XObjects without /Resources
  const imgWithoutResMatches = pdfStr.match(/\/Subtype\s*\/Image(?![^>]*\/Resources)/g) || [];
  const imageXObjectsWithoutResources = imgWithoutResMatches.length;
  if (imageXObjectsWithoutResources > 0) {
    errors.push(`Found ${imageXObjectsWithoutResources} Image XObjects lacking /Resources dictionary`);
  }

  // 4. Count signature dictionaries
  const sigMatches = pdfStr.match(/\/Type\s*\/Sig\b/g) || [];
  const sigDictCount = sigMatches.length;

  // 5. Count AcroForm /Fields entries in the latest AcroForm
  const fieldsMatches = [...pdfStr.matchAll(/\/Fields\s*\[([^\]]*)\]/g)];
  let acroFormFieldCount = 0;
  if (fieldsMatches.length > 0) {
    const latestFields = fieldsMatches[fieldsMatches.length - 1][1];
    const refs = latestFields.match(/\d+\s+0\s+R/g) || [];
    acroFormFieldCount = refs.length;
  }

  // 6. Verify ByteRange formatting and non-zero contents
  const byteRangeMatches = [...pdfStr.matchAll(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g)];
  if (byteRangeMatches.length === 0) {
    errors.push("Missing or invalid /ByteRange in signed PDF");
  } else {
    for (const br of byteRangeMatches) {
      const p1 = parseInt(br[1]);
      const p2 = parseInt(br[2]);
      const p3 = parseInt(br[3]);
      const p4 = parseInt(br[4]);
      if (p1 !== 0 || p2 <= 0 || p3 <= p2 || p4 <= 0) {
        errors.push(`Malformed /ByteRange offsets: [${p1}, ${p2}, ${p3}, ${p4}]`);
      }
    }
  }

  // 7. Verify loadability with pdf-lib
  let isPdfLibParsable = false;
  try {
    const doc = PDFDocument.load(pdfBuf, { ignoreEncryption: true });
    isPdfLibParsable = true;
  } catch (err: any) {
    errors.push(`pdf-lib parse error: ${err.message}`);
  }

  return {
    passed: errors.length === 0,
    kidsOnSigCount,
    formXObjectsWithoutResources,
    imageXObjectsWithoutResources,
    sigDictCount,
    acroFormFieldCount,
    isPdfLibParsable,
    errors,
  };
}

// Verifies PDF with Adobe Acrobat via UIAutomation PowerShell script
function verifyWithAdobeAcrobat(pdfPath: string): { success: boolean; output: string } {
  const psScript = path.resolve("tests/adobe_acrobat_verifier.ps1");
  const fullPdfPath = path.resolve(pdfPath);
  try {
    const cmd = `powershell -ExecutionPolicy Bypass -File "${psScript}" -PdfPath "${fullPdfPath}" -WaitSeconds 6`;
    const stdout = execSync(cmd, { encoding: "utf8", timeout: 30000 });
    return { success: true, output: stdout };
  } catch (err: any) {
    return { success: false, output: err.stdout || err.message };
  }
}

// Main Adversarial Test Suite
async function main() {
  console.log("==========================================================================");
  console.log("  ADOBE ACROBAT END-TO-END ADVERSARIAL VERIFICATION & AUDIT SUITE");
  console.log("==========================================================================");

  const outDir = path.resolve("scratch/acrobat_challenger_out");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const p12Password = "PnpkiSecure2026!";
  const employeeP12 = generateTestP12("Malto Ace Mata", p12Password);
  const supervisorP12 = generateTestP12("Buena Rene Jane Rosendo", p12Password);
  const auditorP12 = generateTestP12("Regional Director Region V", p12Password);
  const specialP12 = generateTestP12("Malto (Ace) \\Mata\\", p12Password);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const testResults: { name: string; structuralPass: boolean; acrobatPass: boolean; details: string }[] = [];

  async function recordTest(
    testName: string,
    pdfBuf: Buffer,
    fileName: string,
    expectedSigs: number
  ) {
    totalTests++;
    console.log(`\n--------------------------------------------------------------------------`);
    console.log(`[TEST ${totalTests}] ${testName}`);
    console.log(`--------------------------------------------------------------------------`);

    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, pdfBuf);

    // 1. Structural Binary Audit
    const audit = auditPdfBinaryStructure(pdfBuf);
    console.log(`  Structural Audit:`);
    console.log(`    - /Kids on /FT /Sig count: ${audit.kidsOnSigCount} (expected: 0)`);
    console.log(`    - Form XObjects without /Resources: ${audit.formXObjectsWithoutResources} (expected: 0)`);
    console.log(`    - Image XObjects without /Resources: ${audit.imageXObjectsWithoutResources} (expected: 0)`);
    console.log(`    - Total /Type /Sig signatures: ${audit.sigDictCount} (expected: ${expectedSigs})`);
    console.log(`    - AcroForm /Fields entries: ${audit.acroFormFieldCount}`);
    console.log(`    - pdf-lib loadable: ${audit.isPdfLibParsable}`);

    const structuralPass = audit.passed && audit.sigDictCount === expectedSigs;
    if (!structuralPass) {
      console.error(`  >>> STRUCTURAL AUDIT FAILED:`, audit.errors);
    } else {
      console.log(`  ✓ Structural Audit: PASSED (100% compliant)`);
    }

    // 2. Real Adobe Acrobat UIAutomation Verification
    console.log(`  Launching Adobe Acrobat for empirical verification...`);
    const acrobatResult = verifyWithAdobeAcrobat(filePath);
    const acrobatPass = acrobatResult.success && !acrobatResult.output.includes("FATAL ERROR") && !acrobatResult.output.includes("MODAL POPUP ERROR");

    if (acrobatPass) {
      console.log(`  ✓ Adobe Acrobat: PASSED (Opened cleanly, zero modal popups, verified)`);
    } else {
      console.error(`  >>> ADOBE ACROBAT FAILED:`);
      console.error(acrobatResult.output);
    }

    const testPassed = structuralPass && acrobatPass;
    if (testPassed) {
      passedTests++;
    } else {
      failedTests++;
    }

    testResults.push({
      name: testName,
      structuralPass,
      acrobatPass,
      details: audit.errors.join("; ") || "Verified cleanly",
    });
  }

  // -------------------------------------------------------------------------
  // TEST SCENARIO 1: CS Form 48 Single DTR - Pass 1 (Employee First Signature)
  // -------------------------------------------------------------------------
  const dtrDoc1 = await PDFDocument.create();
  const dtrPage1 = dtrDoc1.addPage([612, 792]);
  dtrPage1.drawText("CIVIL SERVICE FORM NO. 48 - DAILY TIME RECORD", { x: 50, y: 750, size: 10 });
  dtrPage1.drawText("NAME: MALTO, ACE MATA", { x: 50, y: 730, size: 8 });
  dtrPage1.drawText("Copy 1 (Left)", { x: 100, y: 680, size: 8 });
  dtrPage1.drawText("Copy 2 (Right)", { x: 400, y: 680, size: 8 });
  const baseDtrBytes1 = await dtrDoc1.save();
  const baseDtrBuf1 = Buffer.from(baseDtrBytes1);

  // Dual-copy rects for CS Form 48
  const employeeRects: [number, number, number, number][] = [
    [54, 184, 249, 216],
    [354, 184, 549, 216],
  ];

  const pass1Result = await signPdfBuffer(
    baseDtrBuf1,
    employeeP12.toString("base64"),
    p12Password,
    {
      sigRects: employeeRects,
      signerName: "Malto Ace Mata",
      reason: "Civil Service Form No. 48 Official DTR Certification",
      fieldName: "Personnel_Signature",
    }
  );
  await recordTest(
    "CS Form 48 Single DTR - Pass 1 Personnel First Signature (Dual-Copy Rects)",
    pass1Result.signedBuffer,
    "cs_form_48_pass1_employee.pdf",
    1
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 2: CS Form 48 Single DTR - Pass 2 (Supervisor Incremental Update)
  // -------------------------------------------------------------------------
  const supervisorRects: [number, number, number, number][] = [
    [54, 120, 249, 152],
    [354, 120, 549, 152],
  ];

  const pass2Result = await signPdfBuffer(
    pass1Result.signedBuffer,
    supervisorP12.toString("base64"),
    p12Password,
    {
      sigRects: supervisorRects,
      signerName: "Buena Rene Jane Rosendo",
      reason: "Civil Service Form No. 48 Supervisor Official Verification",
      fieldName: "Supervisor_Signature",
      isCounterSign: true,
    }
  );
  await recordTest(
    "CS Form 48 Single DTR - Pass 2 Supervisor Counter-Signature (Incremental Dual-Copy)",
    pass2Result.signedBuffer,
    "cs_form_48_pass2_dual_signed.pdf",
    2
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 3: Incremental Signing with Embedded Signature Image & Alpha Mask
  // -------------------------------------------------------------------------
  const pass2WithImage = await signPdfBuffer(
    pass1Result.signedBuffer,
    supervisorP12.toString("base64"),
    p12Password,
    {
      sigRects: supervisorRects,
      signerName: "Buena Rene Jane Rosendo",
      reason: "Civil Service Form No. 48 Supervisor Official Verification",
      fieldName: "Supervisor_Signature_Img",
      signatureImage: SAMPLE_SIGNATURE_PNG,
      isCounterSign: true,
    }
  );
  await recordTest(
    "Single DTR - Incremental Signing with Embedded PNG Signature Image & SMask",
    pass2WithImage.signedBuffer,
    "cs_form_48_pass2_image_stroke.pdf",
    2
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 4: Three-Pass Sequential Incremental Signing (Employee + Supervisor + Auditor)
  // -------------------------------------------------------------------------
  const auditorRects: [number, number, number, number][] = [
    [54, 60, 249, 92],
  ];

  const pass3Result = await signPdfBuffer(
    pass2Result.signedBuffer,
    auditorP12.toString("base64"),
    p12Password,
    {
      sigRects: auditorRects,
      signerName: "Regional Director Region V",
      reason: "Final Regional Director Administrative Audit & Verification",
      fieldName: "Auditor_Signature",
    }
  );
  await recordTest(
    "Single DTR - Three-Pass Sequential Incremental Update (Revisions 1 to 3)",
    pass3Result.signedBuffer,
    "cs_form_48_pass3_auditor.pdf",
    3
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 5: Multi-Document Combine DTR (CS Form 48 Page 1 + AR Page 2)
  // -------------------------------------------------------------------------
  const combineDoc = await PDFDocument.create();
  const cPage1 = combineDoc.addPage([612, 792]);
  cPage1.drawText("CIVIL SERVICE FORM NO. 48 - DAILY TIME RECORD", { x: 50, y: 750, size: 10 });
  cPage1.drawText("Page 1: Official DTR Hours & Minutes", { x: 50, y: 700, size: 9 });

  const cPage2 = combineDoc.addPage([612, 792]);
  cPage2.drawText("ACCOMPLISHMENT REPORT (AR)", { x: 50, y: 750, size: 10 });
  cPage2.drawText("Page 2: Monthly Highlights and Deliverables", { x: 50, y: 700, size: 9 });

  const combineBaseBytes = await combineDoc.save();
  const combineBaseBuf = Buffer.from(combineBaseBytes);

  // Pass 1: Sign DTR Page 1
  const combinePass1 = await signPdfBuffer(
    combineBaseBuf,
    employeeP12.toString("base64"),
    p12Password,
    {
      sigRects: employeeRects,
      pageIndex: 0,
      signerName: "Malto Ace Mata",
      reason: "Civil Service Form No. 48 Official DTR Certification",
      fieldName: "Personnel_Signature",
    }
  );

  // Pass 2: Sign AR Page 2 incrementally
  const arSignRects: [number, number, number, number][] = [
    [320, 80, 520, 112],
  ];
  const combinePass2 = await signPdfBuffer(
    combinePass1.signedBuffer,
    supervisorP12.toString("base64"),
    p12Password,
    {
      sigRects: arSignRects,
      pageIndex: 1,
      signerName: "Buena Rene Jane Rosendo",
      reason: "Accomplishment Report Verification & Official Approval",
      fieldName: "Supervisor_Signature_AR",
    }
  );
  await recordTest(
    "Combine DTR Module - Multi-Document Package (DTR Page 1 + AR Page 2)",
    combinePass2.signedBuffer,
    "combine_dtr_multipage_ar.pdf",
    2
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 6: Adversarial Name with Parentheses, Slashes & Special Characters
  // -------------------------------------------------------------------------
  const pass1Special = await signPdfBuffer(
    baseDtrBuf1,
    specialP12.toString("base64"),
    p12Password,
    {
      sigRects: employeeRects,
      signerName: "Malto (Ace) \\Mata\\",
      reason: "Special Characters & Escaping Verification",
      fieldName: "Personnel_Special_Signature",
    }
  );
  await recordTest(
    "Adversarial Syntax - Signer Name with Parentheses and Backslashes",
    pass1Special.signedBuffer,
    "adversarial_escaped_name.pdf",
    1
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 7: Catalog with Pre-existing Nested Dictionaries
  // -------------------------------------------------------------------------
  const nestedDoc = await PDFDocument.create();
  nestedDoc.addPage([612, 792]);
  // Inject nested dictionary into Catalog
  nestedDoc.catalog.set(
    PDFName.of("ViewerPreferences"),
    nestedDoc.context.obj({
      FitWindow: true,
      HideToolbar: false,
      PrintScaling: PDFName.of("None"),
    })
  );
  nestedDoc.catalog.set(
    PDFName.of("MarkInfo"),
    nestedDoc.context.obj({
      Marked: true,
    })
  );
  const nestedBaseBytes = await nestedDoc.save();
  const nestedPass1 = await signPdfBuffer(
    Buffer.from(nestedBaseBytes),
    employeeP12.toString("base64"),
    p12Password,
    {
      sigRects: employeeRects,
      signerName: "Malto Ace Mata",
      reason: "Nested Catalog Verification Pass 1",
    }
  );
  const nestedPass2 = await signPdfBuffer(
    nestedPass1.signedBuffer,
    supervisorP12.toString("base64"),
    p12Password,
    {
      sigRects: supervisorRects,
      signerName: "Buena Rene Jane Rosendo",
      reason: "Nested Catalog Verification Pass 2",
    }
  );
  await recordTest(
    "Adversarial Catalog - Nested Dictionaries (/MarkInfo, /ViewerPreferences) Preservation",
    nestedPass2.signedBuffer,
    "adversarial_nested_catalog.pdf",
    2
  );

  // -------------------------------------------------------------------------
  // TEST SCENARIO 8: Indirect AcroForm /DR Reference Preservation
  // -------------------------------------------------------------------------
  const drDoc = await PDFDocument.create();
  drDoc.addPage([612, 792]);
  const customFontDict = drDoc.context.obj({
    Type: "Font",
    Subtype: "Type1",
    BaseFont: "Helvetica",
  });
  const customFontRef = drDoc.context.register(customFontDict);
  const drObj = drDoc.context.obj({
    Font: drDoc.context.obj({
      CustomHelv: customFontRef,
    }),
  });
  const drRef = drDoc.context.register(drObj);
  const acroFormObj = drDoc.context.obj({
    Fields: drDoc.context.obj([]),
    DR: drRef,
    SigFlags: 3,
  });
  const acroFormRef = drDoc.context.register(acroFormObj);
  drDoc.catalog.set(PDFName.of("AcroForm"), acroFormRef);

  const drBaseBytes = await drDoc.save();
  const drPass1 = await signPdfBuffer(
    Buffer.from(drBaseBytes),
    employeeP12.toString("base64"),
    p12Password,
    {
      sigRects: employeeRects,
      signerName: "Malto Ace Mata",
      reason: "Indirect /DR Reference Pass 1",
    }
  );
  const drPass2 = await signPdfBuffer(
    drPass1.signedBuffer,
    supervisorP12.toString("base64"),
    p12Password,
    {
      sigRects: supervisorRects,
      signerName: "Buena Rene Jane Rosendo",
      reason: "Indirect /DR Reference Pass 2",
    }
  );
  await recordTest(
    "Adversarial AcroForm - Indirect /DR Reference Preservation Across Incremental Revisions",
    drPass2.signedBuffer,
    "adversarial_indirect_dr.pdf",
    2
  );

  // -------------------------------------------------------------------------
  // FINAL REPORT & VERDICT
  // -------------------------------------------------------------------------
  console.log("\n==========================================================================");
  console.log("  ADVERSARIAL VERIFICATION SUMMARY");
  console.log("==========================================================================");
  console.log(`Total Test Scenarios Executed: ${totalTests}`);
  console.log(`Passed:                        ${passedTests}`);
  console.log(`Failed:                        ${failedTests}`);
  console.log(`Pass Rate:                      ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log("--------------------------------------------------------------------------");
  testResults.forEach((t, i) => {
    const status = t.structuralPass && t.acrobatPass ? "PASS" : "FAIL";
    console.log(`  [${i + 1}] ${status}: ${t.name}`);
    console.log(`      Structural: ${t.structuralPass ? "OK" : "FAIL"}, Acrobat: ${t.acrobatPass ? "OK" : "FAIL"}`);
  });
  console.log("==========================================================================");

  if (failedTests > 0) {
    console.error(`\nOVERALL VERDICT: REJECT (${failedTests} tests failed)`);
    process.exit(1);
  } else {
    console.log(`\nOVERALL VERDICT: APPROVE (All ${totalTests} test scenarios passed with 100% compliance)`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Adversarial test suite encountered fatal exception:", err);
  process.exit(1);
});
