/**
 * Adversarial Stress Test Suite for PNPKI PDF Digital Signature Engine
 * Focus: Adobe Acrobat "Expected a dict object" failure modes,
 * ISO 32000-1 / ISO 32000-2 conformance, dictionary balance,
 * incremental update integrity, and XObject syntax.
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import forge from "node-forge";
import { PDFDocument, PDFName, PDFNumber, PDFString, PDFArray, PDFDict, PDFRawStream } from "pdf-lib";
import { signPdfBuffer, appendSignatureIncremental } from "../server/services/pnpkiSigningService";

// Helper: Generate a real, self-signed PKCS#12 (.p12) keystore in memory
function generateTestP12(commonName = "Test Signer", password = "SecretPassword123!") {
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01" + Math.floor(Math.random() * 100000).toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "DICT Adversarial Challenge" },
    { name: "countryName", value: "PH" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    generateLocalKeyId: true,
    friendlyName: commonName,
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return {
    p12Base64: Buffer.from(p12Der, "binary").toString("base64"),
    password,
    commonName,
  };
}

// 1x1 transparent PNG base64
const TINY_TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// 16x16 red PNG with alpha
const RED_PNG_WITH_ALPHA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mP8z8AARBgGhowBADIwAgH2Fh60AAAAAElFTkSuQmCC";

interface ProbeResult {
  id: string;
  category: string;
  description: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const probeResults: ProbeResult[] = [];

function recordProbe(id: string, category: string, description: string, passed: boolean, error?: string, details?: string) {
  probeResults.push({ id, category, description, passed, error, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] [${id}] ${description}${error ? " -> " + error : ""}`);
}

// Low-level PDF Dictionary and Syntax Inspector
function parsePdfStructure(pdfBuf: Buffer) {
  const pdfStr = pdfBuf.toString("latin1");

  // 1. Check all objects
  const objRegex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  const objects = new Map<number, { body: string; offset: number }>();
  let match;
  while ((match = objRegex.exec(pdfStr)) !== null) {
    objects.set(parseInt(match[1]), { body: match[2], offset: match.index });
  }

  // 2. Check XObjects (Form and Image)
  const formXObjects: { objNum: number; body: string; hasResources: boolean; resourcesBalanced: boolean }[] = [];
  const imageXObjects: { objNum: number; body: string; hasResources: boolean; resourcesBalanced: boolean }[] = [];

  for (const [objNum, { body }] of objects.entries()) {
    if (/\/Subtype\s*\/Form\b/.test(body)) {
      const hasRes = /\/Resources\b/.test(body);
      let balanced = false;
      if (hasRes) {
        const resIdx = body.indexOf("/Resources");
        const after = body.slice(resIdx);
        balanced = /<<[\s\S]*?>>/.test(after);
      }
      formXObjects.push({ objNum, body, hasResources: hasRes, resourcesBalanced: balanced });
    }
    if (/\/Subtype\s*\/Image\b/.test(body)) {
      const hasRes = /\/Resources\b/.test(body);
      let balanced = false;
      if (hasRes) {
        const resIdx = body.indexOf("/Resources");
        const after = body.slice(resIdx);
        balanced = /<<[\s\S]*?>>/.test(after);
      }
      imageXObjects.push({ objNum, body, hasResources: hasRes, resourcesBalanced: balanced });
    }
  }

  // 3. Check Sig fields
  const sigFields: { objNum: number; body: string; isWidget: boolean; hasKids: boolean; hasV: boolean; hasT: boolean }[] = [];
  for (const [objNum, { body }] of objects.entries()) {
    if (/\/FT\s*\/Sig\b/.test(body)) {
      sigFields.push({
        objNum,
        body,
        isWidget: /\/Subtype\s*\/Widget\b/.test(body),
        hasKids: /\/Kids\b/.test(body),
        hasV: /\/V\s+\d+\s+0\s+R/.test(body),
        hasT: /\/T\s*\(/.test(body),
      });
    }
  }

  // 4. Check ByteRanges
  const byteRangeRegex = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const byteRanges: { offset1: number; len1: number; offset2: number; len2: number }[] = [];
  let brMatch;
  while ((brMatch = byteRangeRegex.exec(pdfStr)) !== null) {
    byteRanges.push({
      offset1: parseInt(brMatch[1]),
      len1: parseInt(brMatch[2]),
      offset2: parseInt(brMatch[3]),
      len2: parseInt(brMatch[4]),
    });
  }

  // 5. Check %%EOF and startxref
  const startXrefs = [...pdfStr.matchAll(/startxref\s*(\d+)/g)].map((m) => parseInt(m[1]));
  const eofMatches = [...pdfStr.matchAll(/%%EOF/g)];

  return {
    objects,
    formXObjects,
    imageXObjects,
    sigFields,
    byteRanges,
    startXrefs,
    eofCount: eofMatches.length,
    pdfStr,
  };
}

async function runAdversarialProbes() {
  console.log("================================================================================");
  console.log("  ADVERSARIAL STRESS TEST HARNESS — PNPKI PDF SIGNING ENGINE");
  console.log("================================================================================\n");

  const creds1 = generateTestP12("Personnel Pass1 Signer", "Pass1Secure@123");
  const creds2 = generateTestP12("Supervisor Pass2 Signer", "Pass2Secure@456");
  const creds3 = generateTestP12("Auditor Pass3 Signer", "Pass3Secure@789");
  const creds4 = generateTestP12("Admin Pass4 Signer", "Pass4Secure@999");

  // --------------------------------------------------------------------------
  // Category A: Deeply Nested Catalog Dictionaries (Multiple >> brackets)
  // --------------------------------------------------------------------------
  console.log("\n--- Category A: Deeply Nested Catalog Dictionaries ---");

  // Probe A1: Catalog with /MarkInfo << /Marked true >>
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    // Inject MarkInfo into catalog
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of("MarkInfo"), markInfo);
    const pdfBytes = await doc.save();

    // Sign pass 1
    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
      signerName: "Pass 1 Personnel",
    });

    // Sign pass 2 (triggers incremental catalog processing)
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
      signerName: "Pass 2 Supervisor",
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const p2Doc = await PDFDocument.load(p2.signedBuffer);
    const catalogMarkInfo = p2Doc.catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);

    const markInfoPreserved = catalogMarkInfo !== undefined;
    recordProbe(
      "A1",
      "Catalog Nesting",
      "Catalog with /MarkInfo << /Marked true >> survives incremental update",
      markInfoPreserved,
      markInfoPreserved ? undefined : "MarkInfo dictionary stripped or corrupted"
    );
  } catch (err: any) {
    recordProbe("A1", "Catalog Nesting", "Catalog with /MarkInfo << /Marked true >> survives incremental update", false, err.message);
  }

  // Probe A2: Catalog with 3 levels of nested dictionaries
  try {
    const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/Nested1 <<
  /Nested2 <<
    /Nested3 <<
      /DeepKey (DeepValue)
    >>
  >>
>>
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<< /Length 12 >>
stream
q Q
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000155 00000 n 
0000000212 00000 n 
0000000295 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
357
%%EOF`;

    // Pass 1
    const p1 = await signPdfBuffer(Buffer.from(rawPdf, "binary"), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
      signerName: "Pass 1 Nested",
    });

    // Pass 2
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
      signerName: "Pass 2 Nested",
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const p2Doc = await PDFDocument.load(p2.signedBuffer);
    const n1 = p2Doc.catalog.lookupMaybe(PDFName.of("Nested1"), PDFDict);
    let deepValFound = false;
    if (n1) {
      const n2 = n1.lookupMaybe(PDFName.of("Nested2"), PDFDict);
      if (n2) {
        const n3 = n2.lookupMaybe(PDFName.of("Nested3"), PDFDict);
        if (n3) {
          const val = n3.lookupMaybe(PDFName.of("DeepKey"), PDFString);
          if (val && val.asString() === "DeepValue") deepValFound = true;
        }
      }
    }

    recordProbe(
      "A2",
      "Catalog Nesting",
      "Catalog with 3-level deeply nested dictionary preserves inner keys without corruption",
      deepValFound,
      deepValFound ? undefined : "Deeply nested dictionary keys corrupted or truncated"
    );
  } catch (err: any) {
    recordProbe("A2", "Catalog Nesting", "Catalog with 3-level deeply nested dictionary preserves inner keys without corruption", false, err.message);
  }

  // Probe A3: Sibling nested dictionaries in Catalog
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    doc.catalog.set(PDFName.of("MarkInfo"), doc.context.obj({ Marked: true }));
    doc.catalog.set(PDFName.of("ViewerPreferences"), doc.context.obj({ FitWindow: true, HideToolbar: false }));
    const pdfBytes = await doc.save();

    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
    });

    const p2Doc = await PDFDocument.load(p2.signedBuffer);
    const hasMarkInfo = !!p2Doc.catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);
    const hasVP = !!p2Doc.catalog.lookupMaybe(PDFName.of("ViewerPreferences"), PDFDict);

    recordProbe(
      "A3",
      "Catalog Nesting",
      "Sibling nested dictionaries (/MarkInfo and /ViewerPreferences) both preserved",
      hasMarkInfo && hasVP,
      hasMarkInfo && hasVP ? undefined : `hasMarkInfo=${hasMarkInfo}, hasVP=${hasVP}`
    );
  } catch (err: any) {
    recordProbe("A3", "Catalog Nesting", "Sibling nested dictionaries (/MarkInfo and /ViewerPreferences) both preserved", false, err.message);
  }

  // Probe A4: Nested dictionary placed right before the closing >> of Catalog
  try {
    const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/Perms << /DocMDP 4 0 R >>
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
4 0 obj
<< /Type /SigRef >>
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000085 00000 n 
0000000142 00000 n 
0000000210 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
246
%%EOF`;

    const p1 = await signPdfBuffer(Buffer.from(rawPdf, "binary"), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
    });

    const str2 = p2.signedBuffer.toString("latin1");
    const catalogMatches = [...str2.matchAll(/1\s+0\s+obj([\s\S]*?)endobj/g)];
    const latestCatalog = catalogMatches.length > 0 ? catalogMatches[catalogMatches.length - 1][1] : "";
    
    // Count << and >> in latest Catalog object
    const openCount = (latestCatalog.match(/<</g) || []).length;
    const closeCount = (latestCatalog.match(/>>/g) || []).length;
    const permsIntact = /\/Perms\s*<<[\s\S]*?>>/.test(latestCatalog);
    const catalogBalanced = openCount === closeCount && permsIntact;

    recordProbe(
      "A4",
      "Catalog Nesting",
      "Nested dictionary immediately before closing >> (/Perms << >>) not truncated by sanitizer",
      catalogBalanced,
      catalogBalanced
        ? undefined
        : `Unbalanced dictionary brackets in Catalog: << count=${openCount}, >> count=${closeCount}. Line 1449 replace(/>>\\s*$/, "") stripped closing >> from nested dictionary!`
    );
  } catch (err: any) {
    recordProbe("A4", "Catalog Nesting", "Nested dictionary immediately before closing >> (/Perms << >>) not truncated by sanitizer", false, err.message);
  }

  // Probe A5: String containing >> inside parentheses: (Document >> Version 2)
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    doc.setTitle("Document >> Version 2");
    const pdfBytes = await doc.save();

    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
    });

    const p2Doc = await PDFDocument.load(p2.signedBuffer);
    const title = p2Doc.getTitle();
    const titleMatch = title === "Document >> Version 2";
    recordProbe(
      "A5",
      "Catalog Nesting",
      "String with embedded '>>' delimiter in document info / catalog does not trick regex",
      titleMatch,
      titleMatch ? undefined : `Title was: ${title}`
    );
  } catch (err: any) {
    recordProbe("A5", "Catalog Nesting", "String with embedded '>>' delimiter in document info / catalog does not trick regex", false, err.message);
  }

  // Probe A6: Catalog with trailing whitespace, newlines and comments before >>
  try {
    const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
% Trailing comment before closing
  \r\n  >>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000105 00000 n 
0000000162 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
230
%%EOF`;

    const p1 = await signPdfBuffer(Buffer.from(rawPdf, "binary"), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const p2Doc = await PDFDocument.load(p2.signedBuffer);
    const valid = !!p2Doc.catalog;
    recordProbe(
      "A6",
      "Catalog Nesting",
      "Catalog with comments and trailing whitespace before >> parses cleanly",
      valid,
      valid ? undefined : "Failed to load signed document catalog"
    );
  } catch (err: any) {
    recordProbe("A6", "Catalog Nesting", "Catalog with comments and trailing whitespace before >> parses cleanly", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Category B: Multi-Pass Incremental Sequential Signatures (Pass 1 - Pass 4)
  // --------------------------------------------------------------------------
  console.log("\n--- Category B: Multi-Pass Incremental Sequential Signatures ---");

  try {
    const baseDoc = await PDFDocument.create();
    baseDoc.addPage([600, 800]);
    const basePdfBytes = await baseDoc.save();

    console.log("  Executing 4-pass sequential signatures...");
    const t0 = Date.now();

    // Pass 1: Personnel
    const p1 = await signPdfBuffer(Buffer.from(basePdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[50, 200, 200, 250]],
      signerName: creds1.commonName,
      reason: "Pass 1 Personnel Signature",
    });

    // Pass 2: Supervisor
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[250, 200, 400, 250]],
      signerName: creds2.commonName,
      reason: "Pass 2 Supervisor Verification",
    });

    // Pass 3: Auditor
    const p3 = await signPdfBuffer(p2.signedBuffer, creds3.p12Base64, creds3.password, {
      sigRects: [[50, 100, 200, 150]],
      signerName: creds3.commonName,
      reason: "Pass 3 Audit Certification",
    });

    // Pass 4: Admin
    const p4 = await signPdfBuffer(p3.signedBuffer, creds4.p12Base64, creds4.password, {
      sigRects: [[250, 100, 400, 150]],
      signerName: creds4.commonName,
      reason: "Pass 4 Final Administrative Concurrence",
    });

    const elapsed = Date.now() - t0;
    console.log(`  4-pass signing completed in ${elapsed}ms.`);

    const s1 = p1.signedBuffer.length;
    const s2 = p2.signedBuffer.length;
    const s3 = p3.signedBuffer.length;
    const s4 = p4.signedBuffer.length;

    // Probe B1: Sequential execution pass
    recordProbe(
      "B1",
      "Sequential Multi-Pass",
      "All 4 sequential passes sign cleanly without unhandled exception",
      s1 > 0 && s2 > s1 && s3 > s2 && s4 > s3,
      s4 > s3 ? undefined : `Sizes not strictly growing: s1=${s1}, s2=${s2}, s3=${s3}, s4=${s4}`
    );

    // Probe B2: Exactly 4 separate %%EOF markers in 4-pass document
    const parsed4 = parsePdfStructure(p4.signedBuffer);
    recordProbe(
      "B2",
      "Sequential Multi-Pass",
      "Pass 4 document contains 4 distinct incremental revision boundaries (%%EOF)",
      parsed4.eofCount === 4,
      parsed4.eofCount === 4 ? undefined : `Expected 4 EOF markers, found ${parsed4.eofCount}`
    );

    // Probe B3: /Prev cross-reference chain linkage
    const str4 = p4.signedBuffer.toString("latin1");
    const prevMatches = [...str4.matchAll(/\/Prev\s+(\d+)/g)].map((m) => parseInt(m[1]));
    // Revisions 2, 3, 4 should each point to the startxref of revision 1, 2, 3
    const startXrefs = [...str4.matchAll(/startxref\s*(\d+)/g)].map((m) => parseInt(m[1]));

    let prevChainValid = true;
    if (prevMatches.length >= 3 && startXrefs.length === 4) {
      if (prevMatches[0] !== startXrefs[0]) prevChainValid = false;
      if (prevMatches[1] !== startXrefs[1]) prevChainValid = false;
      if (prevMatches[2] !== startXrefs[2]) prevChainValid = false;
    } else {
      prevChainValid = false;
    }

    recordProbe(
      "B3",
      "Sequential Multi-Pass",
      "/Prev pointer in revisions 2, 3, 4 links precisely to previous startxref offsets",
      prevChainValid,
      prevChainValid ? undefined : `prevMatches=[${prevMatches}], startXrefs=[${startXrefs}]`
    );

    // Probe B4: Valid /ByteRange across all 4 revisions
    let byteRangesValid = parsed4.byteRanges.length === 4;
    parsed4.byteRanges.forEach((br, i) => {
      if (br.offset1 !== 0) byteRangesValid = false;
      if (br.len1 <= 0 || br.offset2 <= 0 || br.len2 <= 0) byteRangesValid = false;
      const totalCovered = br.offset2 + br.len2;
      // In revision 4, totalCovered must equal p4 length
      if (i === 3 && totalCovered !== p4.signedBuffer.length) byteRangesValid = false;
    });

    recordProbe(
      "B4",
      "Sequential Multi-Pass",
      "All 4 revisions maintain valid /ByteRange enclosing cryptographic contents",
      byteRangesValid,
      byteRangesValid ? undefined : `byteRanges=${JSON.stringify(parsed4.byteRanges)}`
    );

    // Probe B5: Distinct terminal /T names and distinct /V signature dicts
    const distinctSigObjNums = new Set(parsed4.sigFields.map((f) => f.objNum));
    const allTerminal = parsed4.sigFields.every((f) => f.isWidget && !f.hasKids && f.hasV && f.hasT);
    const fourDistinctWidgets = parsed4.sigFields.length === 4 && distinctSigObjNums.size === 4;

    recordProbe(
      "B5",
      "Sequential Multi-Pass",
      "4 distinct terminal /FT /Sig widgets created with unique /T names and no /Kids",
      allTerminal && fourDistinctWidgets,
      allTerminal && fourDistinctWidgets ? undefined : `allTerminal=${allTerminal}, count=${parsed4.sigFields.length}`
    );

    // Probe B6: AcroForm /Fields contains all 4 terminal widget references
    const p4Doc = await PDFDocument.load(p4.signedBuffer);
    const acroForm = p4Doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
    let fieldsCount = 0;
    if (acroForm) {
      const fieldsArr = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
      if (fieldsArr) fieldsCount = fieldsArr.size();
    }

    recordProbe(
      "B6",
      "Sequential Multi-Pass",
      "AcroForm /Fields array preserves all 4 terminal widget references across passes",
      fieldsCount === 4,
      fieldsCount === 4 ? undefined : `AcroForm /Fields has ${fieldsCount} entries (expected 4)`
    );

    // Probe B7: AcroForm /SigFlags contains 3 (SIGNATURES_EXIST | APPEND_ONLY)
    let sigFlagsVal = 0;
    if (acroForm) {
      const sf = acroForm.lookupMaybe(PDFName.of("SigFlags"), PDFNumber);
      if (sf) sigFlagsVal = sf.asNumber();
    }

    recordProbe(
      "B7",
      "Sequential Multi-Pass",
      "AcroForm /SigFlags is 3 (SIGNATURES_EXIST | APPEND_ONLY) in Pass 4",
      sigFlagsVal === 3,
      sigFlagsVal === 3 ? undefined : `SigFlags was ${sigFlagsVal}`
    );
  } catch (err: any) {
    recordProbe("B1-B7", "Sequential Multi-Pass", "Multi-pass sequential signature execution", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Category C: Dual-Copy CS Form 48 Layouts & Adversarial Rects
  // --------------------------------------------------------------------------
  console.log("\n--- Category C: Dual-Copy CS Form 48 Layouts & Adversarial Rects ---");

  // Probe C1: Dual distinct rects (Copy 1 + Copy 2)
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [
        [50, 200, 200, 250], // Copy 1
        [350, 200, 500, 250], // Copy 2
      ],
      signerName: "Dual Copy Employee",
    });

    const parsed = parsePdfStructure(signed.signedBuffer);
    // There must be exactly 1 /FT /Sig field in AcroForm, zero /Kids
    const sigCount = parsed.sigFields.length;
    const hasKids = parsed.sigFields.some((f) => f.hasKids);

    recordProbe(
      "C1",
      "Dual-Copy CS Form 48",
      "Dual signature rects (Copy 1 + Copy 2) produce exactly 1 terminal /FT /Sig with 0 /Kids",
      sigCount === 1 && !hasKids,
      sigCount === 1 && !hasKids ? undefined : `sigCount=${sigCount}, hasKids=${hasKids}`
    );
  } catch (err: any) {
    recordProbe("C1", "Dual-Copy CS Form 48", "Dual signature rects (Copy 1 + Copy 2)", false, err.message);
  }

  // Probe C2: Identical duplicate rects
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [
        [100, 100, 250, 150],
        [100, 100, 250, 150], // Identical duplicate
      ],
      signerName: "Duplicate Rect Signer",
    });

    const parsed = parsePdfStructure(signed.signedBuffer);
    const sigCount = parsed.sigFields.length;
    recordProbe(
      "C2",
      "Dual-Copy CS Form 48",
      "Identical duplicate rects deduplicated cleanly to 1 terminal widget",
      sigCount === 1,
      sigCount === 1 ? undefined : `Found ${sigCount} fields`
    );
  } catch (err: any) {
    recordProbe("C2", "Dual-Copy CS Form 48", "Identical duplicate rects deduplicated", false, err.message);
  }

  // Probe C3: Degenerate zero-dimension rects: [100, 100, 100, 100]
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 100, 100]],
      signerName: "Zero Dim Signer",
    });

    const pDoc = await PDFDocument.load(signed.signedBuffer);
    const page = pDoc.getPages()[0];
    const annots = page.node.lookup(PDFName.of("Annots"), PDFArray);
    const widget = pDoc.context.lookup(annots.get(0), PDFDict);
    const rect = widget.lookup(PDFName.of("Rect"), PDFArray);

    const x1 = (rect.get(0) as PDFNumber).asNumber();
    const y1 = (rect.get(1) as PDFNumber).asNumber();
    const x2 = (rect.get(2) as PDFNumber).asNumber();
    const y2 = (rect.get(3) as PDFNumber).asNumber();

    const w = x2 - x1;
    const h = y2 - y1;
    const validBounds = w >= 125 && h >= 26;

    recordProbe(
      "C3",
      "Dual-Copy CS Form 48",
      "Degenerate zero-dimension rect normalizes to min bounds (w >= 125, h >= 26)",
      validBounds,
      validBounds ? undefined : `w=${w}, h=${h}`
    );
  } catch (err: any) {
    recordProbe("C3", "Dual-Copy CS Form 48", "Degenerate zero-dimension rect normalizes", false, err.message);
  }

  // Probe C4: Inverted coordinates: [250, 150, 100, 100] (urx < llx, ury < lly)
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[250, 150, 100, 100]],
      signerName: "Inverted Coords Signer",
    });

    const pDoc = await PDFDocument.load(signed.signedBuffer);
    const page = pDoc.getPages()[0];
    const annots = page.node.lookup(PDFName.of("Annots"), PDFArray);
    const widget = pDoc.context.lookup(annots.get(0), PDFDict);
    const rect = widget.lookup(PDFName.of("Rect"), PDFArray);

    const x1 = (rect.get(0) as PDFNumber).asNumber();
    const y1 = (rect.get(1) as PDFNumber).asNumber();
    const x2 = (rect.get(2) as PDFNumber).asNumber();
    const y2 = (rect.get(3) as PDFNumber).asNumber();

    const validOrder = x2 > x1 && y2 > y1 && x1 >= 0 && y1 >= 0;
    recordProbe(
      "C4",
      "Dual-Copy CS Form 48",
      "Inverted coordinates [max, max, min, min] properly re-ordered to [llx, lly, urx, ury]",
      validOrder,
      validOrder ? undefined : `[${x1}, ${y1}, ${x2}, ${y2}]`
    );
  } catch (err: any) {
    recordProbe("C4", "Dual-Copy CS Form 48", "Inverted coordinates properly re-ordered", false, err.message);
  }

  // Probe C5: Empty sigRects: [] falls back to default rect
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [],
      signerName: "Empty Rects Signer",
    });

    const parsed = parsePdfStructure(signed.signedBuffer);
    recordProbe(
      "C5",
      "Dual-Copy CS Form 48",
      "Empty sigRects [] falls back to standard default rect without error",
      parsed.sigFields.length === 1,
      parsed.sigFields.length === 1 ? undefined : `Found ${parsed.sigFields.length} sig fields`
    );
  } catch (err: any) {
    recordProbe("C5", "Dual-Copy CS Form 48", "Empty sigRects fallback", false, err.message);
  }

  // Probe C6: Quad rects (4 copies on 1 page)
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [
        [50, 400, 150, 450],
        [200, 400, 300, 450],
        [50, 200, 150, 250],
        [200, 200, 300, 250],
      ],
      signerName: "Quad Signer",
    });

    const parsed = parsePdfStructure(signed.signedBuffer);
    const hasKids = parsed.sigFields.some((f) => f.hasKids);
    recordProbe(
      "C6",
      "Dual-Copy CS Form 48",
      "Quad-copy rects (4 boxes) produces exactly 1 terminal /FT /Sig and 0 /Kids",
      parsed.sigFields.length === 1 && !hasKids,
      parsed.sigFields.length === 1 && !hasKids ? undefined : `fields=${parsed.sigFields.length}, kids=${hasKids}`
    );
  } catch (err: any) {
    recordProbe("C6", "Dual-Copy CS Form 48", "Quad-copy rects", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Category D: Form XObjects /Resources << >> Syntax Validation
  // --------------------------------------------------------------------------
  console.log("\n--- Category D: Form XObjects /Resources << >> Syntax Validation ---");

  // Probe D1: First-signature Form XObject contains valid /Resources << >>
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
      signerName: "Form XObject Tester",
    });

    const parsed = parsePdfStructure(signed.signedBuffer);
    const allFormRes = parsed.formXObjects.length > 0 && parsed.formXObjects.every((fx) => fx.hasResources && fx.resourcesBalanced);

    recordProbe(
      "D1",
      "Form XObjects",
      "First-signature appearance Form XObject (/AP /N) contains valid /Resources << >>",
      allFormRes,
      allFormRes ? undefined : `formXObjects=${JSON.stringify(parsed.formXObjects)}`
    );
  } catch (err: any) {
    recordProbe("D1", "Form XObjects", "First-signature appearance Form XObject /Resources", false, err.message);
  }

  // Probe D2: Incremental update appearance Form XObject contains /Resources
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const allFormRes = parsed.formXObjects.length >= 2 && parsed.formXObjects.every((fx) => fx.hasResources && fx.resourcesBalanced);

    recordProbe(
      "D2",
      "Form XObjects",
      "Incremental update Form XObjects (Pass 1 & Pass 2) 100% contain valid /Resources << >>",
      allFormRes,
      allFormRes ? undefined : `formXObjects count=${parsed.formXObjects.length}`
    );
  } catch (err: any) {
    recordProbe("D2", "Form XObjects", "Incremental update Form XObjects /Resources", false, err.message);
  }

  // Probe D3: Form XObject with skipVisualText=true maintains /Resources << >>
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
      skipVisualText: true,
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
      skipVisualText: true,
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const allValid = parsed.formXObjects.every((fx) => fx.hasResources && fx.resourcesBalanced);

    recordProbe(
      "D3",
      "Form XObjects",
      "Form XObject with skipVisualText: true retains /Resources << >>",
      allValid,
      allValid ? undefined : "Missing /Resources on skipVisualText"
    );
  } catch (err: any) {
    recordProbe("D3", "Form XObjects", "Form XObject with skipVisualText: true", false, err.message);
  }

  // Probe D4: Appearance Form XObject bounding box /BBox has valid dimensions
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const signed = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });

    const parsed = parsePdfStructure(signed.signedBuffer);
    let bboxValid = true;
    for (const fx of parsed.formXObjects) {
      const match = fx.body.match(/\/BBox\s*\[\s*([\d\.-]+)\s+([\d\.-]+)\s+([\d\.-]+)\s+([\d\.-]+)\s*\]/);
      if (!match) {
        bboxValid = false;
        break;
      }
      const [, x1, y1, x2, y2] = match.map(Number);
      if (x2 <= x1 || y2 <= y1) bboxValid = false;
    }

    recordProbe(
      "D4",
      "Form XObjects",
      "Appearance Form XObjects define strictly positive bounding box /BBox [llx lly urx ury]",
      bboxValid,
      bboxValid ? undefined : "Invalid or inverted BBox detected"
    );
  } catch (err: any) {
    recordProbe("D4", "Form XObjects", "Form XObject bounding box", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Category E: Image XObjects /Resources << >> Validation
  // --------------------------------------------------------------------------
  console.log("\n--- Category E: Image XObjects /Resources << >> Validation ---");

  // Probe E1: Transparent PNG with alpha in incremental signing (both RGB and SMask)
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    // Pass 1: base signature
    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });

    // Pass 2: incremental with transparent PNG
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
      signatureImage: RED_PNG_WITH_ALPHA,
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const imgXObjects = parsed.imageXObjects;
    const hasRGB = imgXObjects.some((img) => img.body.includes("/ColorSpace /DeviceRGB"));
    const hasGray = imgXObjects.some((img) => img.body.includes("/ColorSpace /DeviceGray"));
    const allHaveResources = imgXObjects.length > 0 && imgXObjects.every((img) => img.hasResources && img.resourcesBalanced);

    recordProbe(
      "E1",
      "Image XObjects",
      "Transparent PNG in incremental update generates both RGB and SMask Image XObjects with /Resources << >>",
      hasRGB && hasGray && allHaveResources,
      hasRGB && hasGray && allHaveResources
        ? undefined
        : `hasRGB=${hasRGB}, hasGray=${hasGray}, allHaveResources=${allHaveResources}`
    );
  } catch (err: any) {
    recordProbe("E1", "Image XObjects", "Transparent PNG incremental signing", false, err.message);
  }

  // Probe E2: 1x1 minimal PNG image embedding
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
      signatureImage: TINY_TRANSPARENT_PNG,
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    const valid = parsed.imageXObjects.every((img) => img.hasResources && img.resourcesBalanced);

    recordProbe(
      "E2",
      "Image XObjects",
      "1x1 minimal PNG embeds cleanly with /Resources << >>",
      valid,
      valid ? undefined : "Missing /Resources on minimal PNG"
    );
  } catch (err: any) {
    recordProbe("E2", "Image XObjects", "1x1 minimal PNG embeds cleanly", false, err.message);
  }

  // Probe E3: Incremental signing WITHOUT image omits Image XObjects cleanly without broken references
  try {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);
    const pdfBytes = await doc.save();

    const p1 = await signPdfBuffer(Buffer.from(pdfBytes), creds1.p12Base64, creds1.password, {
      sigRects: [[100, 100, 250, 150]],
    });
    const p2 = await signPdfBuffer(p1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [[300, 100, 450, 150]],
      // No signatureImage provided
    });

    const parsed = parsePdfStructure(p2.signedBuffer);
    // Appearance XObject should not have broken /SigImg reference
    const p2Str = p2.signedBuffer.toString("latin1");
    const hasDanglingSigImg = p2Str.includes("/SigImg 0 0 R");

    recordProbe(
      "E3",
      "Image XObjects",
      "Incremental update without image omits Image XObjects cleanly with zero broken references",
      !hasDanglingSigImg,
      !hasDanglingSigImg ? undefined : "Found dangling /SigImg reference"
    );
  } catch (err: any) {
    recordProbe("E3", "Image XObjects", "Incremental update without image", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Category F: AcroForm /DR Indirect References & Font Preservation
  // --------------------------------------------------------------------------
  console.log("\n--- Category F: AcroForm /DR Indirect References & Font Preservation ---");

  // Probe F1: AcroForm with indirect /DR reference (/DR 99 0 R)
  try {
    const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/AcroForm 5 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Courier
>>
endobj
5 0 obj
<<
/Fields []
/DR 99 0 R
/DA (/Courier 12 Tf 0 g)
>>
endobj
99 0 obj
<<
/Font << /Cour 4 0 R >>
>>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000078 00000 n 
0000000135 00000 n 
0000000203 00000 n 
0000000268 00000 n 
0000000341 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref
393
%%EOF`;

    // Sign incrementally directly via appendSignatureIncremental
    const updated = await appendSignatureIncremental(
      Buffer.from(rawPdf, "binary"),
      "Indirect DR Signer",
      [[100, 100, 250, 150]],
      "Test Indirect DR"
    );

    const updatedStr = updated.toString("latin1");
    // Find the new AcroForm object (should reuse obj 5)
    const obj5Match = updatedStr.match(/5\s+0\s+obj([\s\S]*?)endobj/g);
    const latestObj5 = obj5Match ? obj5Match[obj5Match.length - 1] : "";

    const drPreserved = latestObj5.includes("/DR 99 0 R");
    const daPreserved = latestObj5.includes("/Courier");

    recordProbe(
      "F1",
      "AcroForm /DR",
      "AcroForm indirect /DR reference (/DR 99 0 R) preserved in incremental update without corruption",
      drPreserved,
      drPreserved ? undefined : `Latest obj 5 content: ${latestObj5}`
    );

    recordProbe(
      "F2",
      "AcroForm /DR",
      "AcroForm existing /DA string (/Courier 12 Tf 0 g) preserved alongside indirect /DR",
      daPreserved,
      daPreserved ? undefined : `Latest obj 5 content: ${latestObj5}`
    );
  } catch (err: any) {
    recordProbe("F1", "AcroForm /DR", "AcroForm indirect /DR reference", false, err.message);
    recordProbe("F2", "AcroForm /DR", "AcroForm existing /DA string", false, err.message);
  }

  // Probe F3: AcroForm with existing non-signature form fields preserved in /Fields
  try {
    const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/AcroForm 4 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
4 0 obj
<<
/Fields [98 0 R]
>>
endobj
98 0 obj
<<
/Type /Annot
/Subtype /Widget
/FT /Tx
/T (EmployeeNameField)
/V (Jane Doe)
>>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000078 00000 n 
0000000135 00000 n 
0000000203 00000 n 
0000000244 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
341
%%EOF`;

    const updated = await appendSignatureIncremental(
      Buffer.from(rawPdf, "binary"),
      "Field Preserve Signer",
      [[100, 100, 250, 150]],
      "Test Preserve Fields"
    );

    const updatedStr = updated.toString("latin1");
    const latestAcroForm = updatedStr.match(/4\s+0\s+obj([\s\S]*?)endobj/g);
    const afBody = latestAcroForm ? latestAcroForm[latestAcroForm.length - 1] : "";

    const preservesField98 = afBody.includes("98 0 R");
    recordProbe(
      "F3",
      "AcroForm /DR",
      "Existing non-signature form fields (98 0 R) preserved in AcroForm /Fields",
      preservesField98,
      preservesField98 ? undefined : `AcroForm body: ${afBody}`
    );
  } catch (err: any) {
    recordProbe("F3", "AcroForm /DR", "Existing non-signature form fields preserved", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Category G: Real-World DTR Stress & Adobe Acrobat Structural Parser
  // --------------------------------------------------------------------------
  console.log("\n--- Category G: Real-World DTR Stress & Adobe Acrobat Structural Parser ---");

  try {
    // Generate simulated CS Form 48 DTR with preprinted text and two copies
    const dtrDoc = await PDFDocument.create();
    const dtrPage = dtrDoc.addPage([612, 792]);

    // Draw preprinted Civil Service Form No. 48 header
    dtrPage.drawText("Civil Service Form No. 48", { x: 50, y: 750, size: 10 });
    dtrPage.drawText("DAILY TIME RECORD", { x: 50, y: 735, size: 12 });
    dtrPage.drawText("Civil Service Form No. 48", { x: 350, y: 750, size: 10 });
    dtrPage.drawText("DAILY TIME RECORD", { x: 350, y: 735, size: 12 });

    const rawDtr = await dtrDoc.save();

    // Pass 1: Personnel
    const dtrP1 = await signPdfBuffer(Buffer.from(rawDtr), creds1.p12Base64, creds1.password, {
      sigRects: [
        [50, 200, 200, 250],
        [350, 200, 500, 250],
      ],
      signerName: "ANNABEL C. ODOÑO-CALIMPONG",
      reason: "Civil Service Form No. 48 Official Daily Time Record Digital Certification",
      signatureImage: RED_PNG_WITH_ALPHA,
    });

    // Pass 2: Supervisor
    const dtrP2 = await signPdfBuffer(dtrP1.signedBuffer, creds2.p12Base64, creds2.password, {
      sigRects: [
        [50, 100, 200, 150],
        [350, 100, 500, 150],
      ],
      signerName: "RENE JANE R. BUENA",
      reason: "Civil Service Form No. 48 Verification and Approval",
      signatureImage: RED_PNG_WITH_ALPHA,
    });

    const parsedDtr = parsePdfStructure(dtrP2.signedBuffer);

    // Check Adobe Acrobat ISO 32000 structural requirements:
    // 1. Exactly 2 terminal signature fields
    const termCount = parsedDtr.sigFields.length;
    // 2. Zero /Kids on /FT /Sig
    const zeroKids = !parsedDtr.sigFields.some((f) => f.hasKids);
    // 3. 100% of Form XObjects have /Resources << >>
    const formResOk = parsedDtr.formXObjects.every((fx) => fx.hasResources && fx.resourcesBalanced);
    // 4. 100% of Image XObjects have /Resources << >>
    const imgResOk = parsedDtr.imageXObjects.every((ix) => ix.hasResources && ix.resourcesBalanced);
    // 5. Valid ByteRanges
    const brOk = parsedDtr.byteRanges.length === 2 && parsedDtr.byteRanges[1].offset2 + parsedDtr.byteRanges[1].len2 === dtrP2.signedBuffer.length;
    // 6. Clean pdf-lib reload
    const reloaded = await PDFDocument.load(dtrP2.signedBuffer);
    const reloadOk = reloaded.getPageCount() === 1;

    const allAcrobatReqs = termCount === 2 && zeroKids && formResOk && imgResOk && brOk && reloadOk;

    recordProbe(
      "G1",
      "Real-World CS Form 48",
      "Dual-copy CS Form 48 two-pass signing satisfies 100% Adobe Acrobat ISO 32000 structural requirements",
      allAcrobatReqs,
      allAcrobatReqs ? undefined : `termCount=${termCount}, zeroKids=${zeroKids}, formResOk=${formResOk}, imgResOk=${imgResOk}, brOk=${brOk}, reloadOk=${reloadOk}`
    );
  } catch (err: any) {
    recordProbe("G1", "Real-World CS Form 48", "CS Form 48 two-pass signing", false, err.message);
  }

  // --------------------------------------------------------------------------
  // Summary & Statistics
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("  ADVERSARIAL STRESS TEST SUMMARY");
  console.log("================================================================================");

  const total = probeResults.length;
  const passed = probeResults.filter((p) => p.passed).length;
  const failed = probeResults.filter((p) => !p.passed).length;

  console.log(`Total Adversarial Probes Executed: ${total}`);
  console.log(`Passed:                            ${passed}`);
  console.log(`Failed:                            ${failed}`);
  console.log(`Pass Rate:                          ${((passed / total) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log("\n>>> EMPIRICAL VERDICT: APPROVE <<<");
  } else {
    console.log("\n>>> EMPIRICAL VERDICT: REJECT <<<");
  }
  console.log("================================================================================\n");

  // Output JSON report to a local temporary artifact outside .agents/teamwork
  const reportPath = path.resolve(process.cwd(), "scratch/adversarial_probe_report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total,
        passed,
        failed,
        verdict: failed === 0 ? "APPROVE" : "REJECT",
        probes: probeResults,
      },
      null,
      2
    )
  );

  return { total, passed, failed, verdict: failed === 0 ? "APPROVE" : "REJECT" };
}

runAdversarialProbes()
  .then((res) => {
    if (res.failed > 0) process.exit(1);
  })
  .catch((err) => {
    console.error("Fatal error running stress harness:", err);
    process.exit(1);
  });
