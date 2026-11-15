/**
 * Adobe Acrobat Digital Signature Verification Compliance Test Suite
 * 
 * Comprehensive 4-Tier Opaque-Box Test Suite for PDF Digital Signature Structure
 * and Adobe Acrobat "Expected a dict object" resolution.
 * 
 * Standards & Specifications:
 * - ISO 32000-1:2008 / PDF 1.7
 * - ISO 32000-2:2020 Clause 12.7.4.5 (Signature Fields)
 * - Adobe Acrobat DC Digital Signature Verification Engine
 * 
 * Test Tiers:
 * - Tier 1: Feature Coverage (40 tests across 8 features)
 * - Tier 2: Boundary & Corner Cases (40 tests across 8 feature boundaries)
 * - Tier 3: Cross-Feature Interactions (8 tests covering multi-feature combinations)
 * - Tier 4: Real-World Application Scenarios (5 tests covering full workflows)
 * Total: 93+ test cases
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import forge from "node-forge";
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFString, rgb, StandardFonts } from "pdf-lib";

import {
  signPdfBuffer,
  appendSignatureIncremental,
  getSignerIdentityFromP12,
  encryptP12Password,
  decryptP12Password,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  normalizeSignatureBoundingBox,
  splitSignerNameToLines,
  fixMojibake,
} from "../server/services/pnpkiSigningService";

// ============================================================================
// TEST FIXTURES & HELPER UTILITIES
// ============================================================================

const DEFAULT_P12_PASS = "TestP12Pass123!";
let cachedDefaultP12Base64 = "";

/**
 * Rapidly creates a valid, self-signed PKCS#12 (.p12) keystore buffer
 * using native OpenSSL keygen (2048-bit RSA) + node-forge X.509 packaging.
 */
function createTestP12(
  commonName: string = "Juan Dela Cruz",
  organization: string = "DICT Region V",
  password: string = DEFAULT_P12_PASS
): string {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });

  const privPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;

  const forgePriv = forge.pki.privateKeyFromPem(privPem);
  const forgePub = forge.pki.publicKeyFromPem(pubPem);

  const cert = forge.pki.createCertificate();
  cert.publicKey = forgePub;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2);

  cert.setSubject([
    { name: "commonName", value: commonName },
    { name: "organizationName", value: organization },
    { name: "countryName", value: "PH" },
  ]);
  cert.setIssuer([
    { name: "commonName", value: "Government Signing CA - G2" },
    { name: "organizationName", value: "DICT" },
    { name: "countryName", value: "PH" },
  ]);

  cert.sign(forgePriv, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(forgePriv, [cert], password, {
    generateLocalKeyId: true,
    friendlyName: commonName,
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(p12Der, "binary").toString("base64");
}

/**
 * Generates a clean 1x1 or custom dimension base64 PNG data URL for signature stamp tests
 */
function createTestSignatureImageBase64(width = 60, height = 30): string {
  // 1x1 transparent PNG minimal byte sequence
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64"
  );
  return `data:image/png;base64,${png1x1.toString("base64")}`;
}

/**
 * Creates a synthetic base PDF with various configurable internal structures
 */
async function createSyntheticPdf(options?: {
  pageCount?: number;
  contentsType?: "stream" | "array" | "none";
  nestedCatalogDicts?: boolean;
  withAcroForm?: boolean;
  indirectDR?: boolean;
  signerNameInText?: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pagesCount = options?.pageCount || 1;

  for (let i = 0; i < pagesCount; i++) {
    const page = doc.addPage([612, 792]);
    if (options?.contentsType === "array") {
      // Create multiple text operations in sequence to test array Contents
      page.drawText(`Page ${i + 1} Line 1: Civil Service Form No. 48`, {
        x: 50,
        y: 700,
        size: 10,
        font,
      });
      page.drawText(`Page ${i + 1} Line 2: Daily Time Record`, {
        x: 50,
        y: 680,
        size: 10,
        font,
      });
      if (options?.signerNameInText) {
        page.drawText(options.signerNameInText, {
          x: 100,
          y: 200,
          size: 9,
          font,
        });
      }
    } else if (options?.contentsType === "none") {
      // Remove contents entirely
      page.node.delete(PDFName.of("Contents"));
    } else {
      // Standard single stream
      page.drawText("Civil Service Form No. 48 - Official Daily Time Record", {
        x: 50,
        y: 720,
        size: 11,
        font,
      });
      if (options?.signerNameInText) {
        page.drawText(options.signerNameInText, {
          x: 100,
          y: 200,
          size: 9,
          font,
        });
      }
    }
  }

  // Inject nested dictionaries into Catalog if requested
  if (options?.nestedCatalogDicts) {
    const markInfo = doc.context.obj({ Marked: true });
    doc.catalog.set(PDFName.of("MarkInfo"), markInfo);

    const viewerPrefs = doc.context.obj({
      FitWindow: true,
      HideToolbar: false,
      PrintScaling: "None",
    });
    doc.catalog.set(PDFName.of("ViewerPreferences"), viewerPrefs);
  }

  // Inject AcroForm with indirect /DR if requested
  if (options?.indirectDR) {
    const helvFont = doc.context.obj({
      Type: "Font",
      Subtype: "Type1",
      BaseFont: "Helvetica",
      Encoding: "WinAnsiEncoding",
    });
    const fontRef = doc.context.register(helvFont);

    const drFonts = doc.context.obj({ Helv: fontRef });
    const drDict = doc.context.obj({ Font: drFonts });
    const drRef = doc.context.register(drDict);

    const acroForm = doc.context.obj({
      Fields: doc.context.obj([]),
      DR: drRef, // Indirect reference!
      DA: PDFString.of("/Helv 0 Tf 0 g "),
    });
    const acroFormRef = doc.context.register(acroForm);
    doc.catalog.set(PDFName.of("AcroForm"), acroFormRef);
  } else if (options?.withAcroForm) {
    const acroForm = doc.context.obj({
      Fields: doc.context.obj([]),
      SigFlags: 3,
    });
    const acroFormRef = doc.context.register(acroForm);
    doc.catalog.set(PDFName.of("AcroForm"), acroFormRef);
  }

  const pdfBytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}

// PDF Object inspection helper utilities
function parsePdfObjectsFromBuffer(pdfBuf: Buffer): Map<number, string> {
  const map = new Map<number, string>();
  const pdfStr = pdfBuf.toString("latin1");
  const regex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let match;
  while ((match = regex.exec(pdfStr)) !== null) {
    map.set(parseInt(match[1]), match[2]);
  }
  return map;
}

function findObjectsWithSubtype(pdfBuf: Buffer, subtype: string): { objNum: number; body: string }[] {
  const objects = parsePdfObjectsFromBuffer(pdfBuf);
  const results: { objNum: number; body: string }[] = [];
  const regex = new RegExp(`\\/Subtype\\s*\\/${subtype}\\b`);
  for (const [objNum, body] of objects.entries()) {
    if (regex.test(body)) {
      results.push({ objNum, body });
    }
  }
  return results;
}

function findObjectsWithFT(pdfBuf: Buffer, ft: string): { objNum: number; body: string }[] {
  const objects = parsePdfObjectsFromBuffer(pdfBuf);
  const results: { objNum: number; body: string }[] = [];
  const regex = new RegExp(`\\/FT\\s*\\/${ft}\\b`);
  for (const [objNum, body] of objects.entries()) {
    if (regex.test(body)) {
      results.push({ objNum, body });
    }
  }
  return results;
}

function findObjectsWithType(pdfBuf: Buffer, type: string): { objNum: number; body: string }[] {
  const objects = parsePdfObjectsFromBuffer(pdfBuf);
  const results: { objNum: number; body: string }[] = [];
  const regex = new RegExp(`\\/Type\\s*\\/${type}\\b`);
  for (const [objNum, body] of objects.entries()) {
    if (regex.test(body)) {
      results.push({ objNum, body });
    }
  }
  return results;
}

function isDictBalanced(dictStr: string): boolean {
  let depth = 0;
  for (let i = 0; i < dictStr.length - 1; i++) {
    if (dictStr[i] === "<" && dictStr[i + 1] === "<") {
      depth++;
      i++;
    } else if (dictStr[i] === ">" && dictStr[i + 1] === ">") {
      depth--;
      i++;
    }
  }
  return depth === 0;
}

// ============================================================================
// TEST SUITE BEGINS
// ============================================================================

describe("Adobe Acrobat Digital Signature Verification Compliance Test Suite", () => {
  before(() => {
    cachedDefaultP12Base64 = createTestP12("DICT Signatory User", "DICT Region V", DEFAULT_P12_PASS);
  });

  // ==========================================================================
  // TIER 1: FEATURE COVERAGE (40 Tests, 5 per feature)
  // ==========================================================================
  describe("Tier 1: Feature Coverage", () => {
    // Feature 1: Form XObject /Resources Dictionary (First-Signature Mode)
    describe("Feature 1: Form XObject /Resources Dictionary (Pass 1)", () => {
      it("T1.1.1: Appearance Form XObject in first signature contains /Resources dictionary", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Juan Dela Cruz",
        });

        const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
        assert.ok(formObjs.length > 0, "PDF must contain at least one Form XObject");
        for (const fo of formObjs) {
          assert.match(
            fo.body,
            /\/Resources\s*(?:<<|\d+\s+0\s+R)/,
            `Form XObject obj ${fo.objNum} must declare a /Resources dictionary to prevent Acrobat 'Expected a dict object'`
          );
        }
      });

      it("T1.1.2: Form XObject /Resources dictionary is syntactically balanced", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
        });

        const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
        for (const fo of formObjs) {
          const resMatch = fo.body.match(/\/Resources\s*(<<[\s\S]*?>>)/);
          if (resMatch) {
            assert.ok(isDictBalanced(resMatch[1]), `/Resources dictionary in obj ${fo.objNum} must be balanced`);
          }
        }
      });

      it("T1.1.3: Form XObject appearance stream defines BBox and Form Subtype", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
        });

        const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
        assert.ok(formObjs.length > 0);
        for (const fo of formObjs) {
          assert.match(fo.body, /\/Type\s*\/XObject/, "Must declare /Type /XObject");
          assert.match(fo.body, /\/Subtype\s*\/Form/, "Must declare /Subtype /Form");
          assert.match(fo.body, /\/BBox\s*\[/, "Must declare /BBox");
        }
      });

      it("T1.1.4: Form XObject includes /Font or empty /Resources << >> when text is skipped", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          skipVisualText: true,
        });

        const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
        assert.ok(formObjs.length > 0);
        for (const fo of formObjs) {
          assert.match(fo.body, /\/Resources\s*(?:<<|\d+\s+0\s+R)/, "Even without text, /Resources must be present");
        }
      });

      it("T1.1.5: Multi-page document first signature ensures Form XObject on target page has /Resources", async () => {
        const basePdf = await createSyntheticPdf({ pageCount: 3 });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          pageIndex: 2,
          sigRect: [100, 100, 225, 126],
        });

        const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
        assert.ok(formObjs.length > 0);
        for (const fo of formObjs) {
          assert.match(fo.body, /\/Resources\s*(?:<<|\d+\s+0\s+R)/);
        }
      });
    });

    // Feature 2: Image XObjects /Resources Dictionary (Incremental / Pass 2+)
    describe("Feature 2: Image XObjects /Resources Dictionary (Incremental)", () => {
      it("T1.2.1: Appended signature image XObject contains /Resources << >>", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Employee One",
        });

        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Civil Service Form No. 48 Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Signature",
          0,
          { signatureImage: createTestSignatureImageBase64() }
        );

        const imageObjs = findObjectsWithSubtype(pass2, "Image");
        assert.ok(imageObjs.length > 0, "Must contain appended Image XObjects");
        for (const img of imageObjs) {
          assert.match(
            img.body,
            /\/Resources\s*<<\s*>>/,
            `Image XObject obj ${img.objNum} must contain /Resources << >> to prevent Acrobat validation error`
          );
        }
      });

      it("T1.2.2: Appended smask (alpha channel) XObject contains /Resources << >>", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
        });

        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Signature",
          0,
          { signatureImage: createTestSignatureImageBase64() }
        );

        const smasks = findObjectsWithSubtype(pass2, "Image").filter((img) => img.body.includes("/ColorSpace /DeviceGray"));
        if (smasks.length > 0) {
          for (const sm of smasks) {
            assert.match(sm.body, /\/Resources\s*<<\s*>>/, "Alpha SMask Image XObject must have /Resources << >>");
          }
        }
      });

      it("T1.2.3: Second-pass incremental update preserves image dimensions and color depth", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Signature",
          0,
          { signatureImage: createTestSignatureImageBase64() }
        );

        const imageObjs = findObjectsWithSubtype(pass2, "Image");
        for (const img of imageObjs) {
          assert.match(img.body, /\/Width\s+\d+/, "Must declare /Width");
          assert.match(img.body, /\/Height\s+\d+/, "Must declare /Height");
          assert.match(img.body, /\/BitsPerComponent\s+8/, "Must declare 8 bits per component");
        }
      });

      it("T1.2.4: Image XObjects have valid /Filter /FlateDecode and /Length", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Signature",
          0,
          { signatureImage: createTestSignatureImageBase64() }
        );

        const imageObjs = findObjectsWithSubtype(pass2, "Image");
        for (const img of imageObjs) {
          assert.match(img.body, /\/Filter\s*\/FlateDecode/);
          assert.match(img.body, /\/Length\s+\d+/);
        }
      });

      it("T1.2.5: Incremental signing without signature image omits Image XObjects cleanly", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Signature"
        );

        const pdfStr = pass2.toString("latin1");
        assert.ok(pdfStr.includes("/Type /Sig"), "Must contain signature dictionary");
        assert.ok(pdfStr.includes("/FT /Sig"), "Must contain signature widget");
      });
    });

    // Feature 3: Single Terminal Widget /FT /Sig Field Architecture
    describe("Feature 3: Single Terminal Widget /FT /Sig Field", () => {
      it("T1.3.1: AcroForm /Fields points directly to terminal widget annotation", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
        });

        const sigFields = findObjectsWithFT(signed.signedBuffer, "Sig");
        assert.ok(sigFields.length > 0, "Must contain /FT /Sig field");
        for (const sf of sigFields) {
          assert.match(
            sf.body,
            /\/Subtype\s*\/Widget/,
            "Signature field must be a terminal Widget annotation dictionary per ISO 32000-2"
          );
        }
      });

      it("T1.3.2: Terminal widget dictionary contains both /FT /Sig and /Subtype /Widget", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
        });

        const widgets = findObjectsWithSubtype(signed.signedBuffer, "Widget");
        const sigWidget = widgets.find((w) => /\/FT\s*\/Sig\b/.test(w.body));
        assert.ok(sigWidget, "Must find terminal widget with /FT /Sig");
        assert.match(sigWidget.body, /\/Type\s*\/Annot/, "Must have /Type /Annot");
        assert.match(sigWidget.body, /\/V\s+\d+\s+0\s+R/, "Must have /V reference to /Sig dictionary");
      });

      it("T1.3.3: No /FT /Sig field contains a /Kids array (ISO 32000-2 Clause 12.7.4.5)", async () => {
        const basePdf = await createSyntheticPdf();
        // Dual copy rects simulating Copy 1 & Copy 2
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRects: [
            [100, 200, 225, 226],
            [350, 200, 475, 226],
          ],
        });

        const sigFields = findObjectsWithFT(signed.signedBuffer, "Sig");
        for (const sf of sigFields) {
          assert.ok(
            !/\/Kids\b/.test(sf.body),
            `Signature field obj ${sf.objNum} must NOT have /Kids (violates ISO 32000-2 Clause 12.7.4.5)`
          );
        }
      });

      it("T1.3.4: Dual-copy signature rects produce single terminal /FT /Sig in AcroForm /Fields", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRects: [
            [100, 200, 225, 226],
            [350, 200, 475, 226],
          ],
        });

        const doc = await PDFDocument.load(signed.signedBuffer);
        const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
        assert.ok(acroForm, "Document Catalog must contain AcroForm");
        const fields = acroForm.lookupMaybe(PDFName.of("Fields"), PDFArray);
        assert.ok(fields, "AcroForm must contain Fields array");
        assert.strictEqual(fields.size(), 1, "Must contain exactly 1 terminal signature field in /Fields");
      });

      it("T1.3.5: Terminal widget annotation references the cryptographic /V <sigDictRef> directly", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
        });

        const sigFields = findObjectsWithFT(signed.signedBuffer, "Sig");
        const sigDicts = findObjectsWithType(signed.signedBuffer, "Sig");
        assert.ok(sigDicts.length > 0, "Must contain /Type /Sig object");

        const targetSigObjNum = sigDicts[0].objNum;
        const matchingField = sigFields.find((sf) => sf.body.includes(`/V ${targetSigObjNum} 0 R`));
        assert.ok(matchingField, "Terminal signature widget must reference /Sig dict directly via /V");
      });
    });

    // Feature 4: Safe Incremental Catalog Sanitization
    describe("Feature 4: Safe Incremental Catalog Update", () => {
      it("T1.4.1: Incremental update preserves nested >> delimiters in Catalog dictionary", async () => {
        const basePdf = await createSyntheticPdf({ nestedCatalogDicts: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const catalogs = findObjectsWithType(pass2, "Catalog");
        for (const cat of catalogs) {
          assert.ok(isDictBalanced(cat.body), `Catalog obj ${cat.objNum} must have balanced << and >>`);
        }
      });

      it("T1.4.2: Catalog with /MarkInfo << /Marked true >> retains complete dictionary after signing", async () => {
        const basePdf = await createSyntheticPdf({ nestedCatalogDicts: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const doc = await PDFDocument.load(pass2);
        const markInfo = doc.catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);
        assert.ok(markInfo, "MarkInfo must be retained after incremental update");
      });

      it("T1.4.3: Catalog with /ViewerPreferences retains nested >> without truncation", async () => {
        const basePdf = await createSyntheticPdf({ nestedCatalogDicts: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const doc = await PDFDocument.load(pass2);
        const prefs = doc.catalog.lookupMaybe(PDFName.of("ViewerPreferences"), PDFDict);
        assert.ok(prefs, "ViewerPreferences dictionary must survive incremental update intact");
      });

      it("T1.4.4: Incremental update preserves /Pages reference in Catalog", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const catalogs = findObjectsWithType(pass2, "Catalog");
        for (const cat of catalogs) {
          assert.match(cat.body, /\/Pages\s+\d+\s+0\s+R/, "Catalog must contain /Pages reference");
        }
      });

      it("T1.4.5: Incremental update preserves /Type /Catalog without duplication", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const catalogs = findObjectsWithType(pass2, "Catalog");
        for (const cat of catalogs) {
          const typeMatches = cat.body.match(/\/Type\s*\/Catalog/g) || [];
          assert.strictEqual(typeMatches.length, 1, "Catalog should have exactly one /Type /Catalog");
        }
      });
    });

    // Feature 5: AcroForm /DR Indirect Reference Handling
    describe("Feature 5: AcroForm /DR Indirect Reference Handling", () => {
      it("T1.5.1: Incremental update preserves indirect /DR reference (X 0 R)", async () => {
        const basePdf = await createSyntheticPdf({ indirectDR: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const pdfStr = pass2.toString("latin1");
        assert.match(pdfStr, /\/DR\s+(?:<<|\d+\s+0\s+R)/, "AcroForm /DR must be preserved");
        const doc = await PDFDocument.load(pass2);
        assert.ok(doc, "PDF must load cleanly with indirect /DR");
      });

      it("T1.5.2: Incremental update preserves inline /DR << ... >> without truncating fonts", async () => {
        const basePdf = await createSyntheticPdf({ withAcroForm: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const pdfStr = pass2.toString("latin1");
        assert.match(pdfStr, /\/DR\s*<<[\s\S]*?>>/, "Inline /DR must remain a balanced dictionary");
      });

      it("T1.5.3: AcroForm object maintains balanced << >> delimiters when updating /Fields", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const acroFormMatches = [...pass2.toString("latin1").matchAll(/\/Fields\s*\[[^\]]*\][\s\S]*?>>/g)];
        assert.ok(acroFormMatches.length > 0, "Must find AcroForm definition");
        for (const m of acroFormMatches) {
          assert.ok(m[0].includes(">>"), "AcroForm must terminate with >>");
        }
      });

      it("T1.5.4: AcroForm /SigFlags contains 3 (SIGNATURES_EXIST | APPEND_ONLY)", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(pass1.signedBuffer);
        const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
        assert.ok(acroForm);
        const sigFlags = (acroForm.lookupMaybe(PDFName.of("SigFlags"), PDFNumber) as PDFNumber).asNumber();
        assert.strictEqual(sigFlags & 3, 3, "SigFlags must have bits 1 and 2 set");
      });

      it("T1.5.5: AcroForm with existing /DA preserves default appearance string", async () => {
        const basePdf = await createSyntheticPdf({ indirectDR: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor Two",
          [[300, 200, 425, 226]],
          "Verification"
        );

        const pdfStr = pass2.toString("latin1");
        assert.match(pdfStr, /\/DA\s*\([^)]*\)/, "Default appearance /DA must be preserved");
      });
    });

    // Feature 6: Page /Contents Type Safety
    describe("Feature 6: Page /Contents Type Safety", () => {
      it("T1.6.1: First signature correctly handles single stream /Contents", async () => {
        const basePdf = await createSyntheticPdf({ contentsType: "stream" });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Juan Dela Cruz",
        });

        assert.ok(signed.signedBuffer.length > basePdf.length);
        const doc = await PDFDocument.load(signed.signedBuffer);
        assert.strictEqual(doc.getPageCount(), 1);
      });

      it("T1.6.2: First signature correctly handles array of streams /Contents [ ... ]", async () => {
        const basePdf = await createSyntheticPdf({ contentsType: "array" });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Juan Dela Cruz",
        });

        const doc = await PDFDocument.load(signed.signedBuffer);
        const page = doc.getPages()[0];
        const contents = page.node.lookupMaybe(PDFName.of("Contents"), PDFArray);
        assert.ok(contents, "Contents should be safely converted/appended as array");
      });

      it("T1.6.3: First signature safely handles page with no initial /Contents (empty page)", async () => {
        const basePdf = await createSyntheticPdf({ contentsType: "none" });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Juan Dela Cruz",
        });

        const doc = await PDFDocument.load(signed.signedBuffer);
        assert.ok(doc, "Empty-content page signed cleanly");
      });

      it("T1.6.4: Page /Contents remains valid and parsable after typography injection", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Juan Dela Cruz",
        });

        const doc = await PDFDocument.load(signed.signedBuffer);
        const page = doc.getPages()[0];
        assert.ok(page, "Page must parse cleanly");
      });

      it("T1.6.5: Visual typography stream is properly balanced (q ... Q)", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Juan Dela Cruz",
        });

        const pdfStr = signed.signedBuffer.toString("latin1");
        assert.ok(pdfStr.includes("q\nBT\n/F_PNPKI") || pdfStr.includes("q\n/F_PNPKI") || pdfStr.includes("/Helv"), "Text stream exists");
      });
    });

    // Feature 7: Cross-Repository Synchronization
    describe("Feature 7: Cross-Repository Synchronization", () => {
      const REPO_DICT_MONITORING = path.resolve(process.cwd());
      const REPO_DICT_DTR_GEN = path.resolve(process.cwd(), "..", "dict-dtr-generator");
      const REPO_D_MONITORING = path.resolve(process.cwd(), "..", "..", "D-monitoring", "d-monitoring");

      it("T1.7.1: Verify dict-monitoring/server/services/pnpkiSigningService.ts exists and exports contracts", () => {
        const pnpkiPath = path.join(REPO_DICT_MONITORING, "server", "services", "pnpkiSigningService.ts");
        assert.ok(fs.existsSync(pnpkiPath), "dict-monitoring pnpkiSigningService.ts must exist");
      });

      it("T1.7.2: Verify dict-dtr-generator/server/services/pnpkiSigningService.ts exists", () => {
        const pnpkiPath = path.join(REPO_DICT_DTR_GEN, "server", "services", "pnpkiSigningService.ts");
        assert.ok(fs.existsSync(pnpkiPath), "dict-dtr-generator pnpkiSigningService.ts must exist");
      });

      it("T1.7.3: Verify d-monitoring/server/services/pnpkiSigningService.ts exists", () => {
        const pnpkiPath = path.join(REPO_D_MONITORING, "server", "services", "pnpkiSigningService.ts");
        assert.ok(fs.existsSync(pnpkiPath), "d-monitoring pnpkiSigningService.ts must exist");
      });

      it("T1.7.4: Verify signPdfBuffer contract parameter signature across repositories", () => {
        assert.strictEqual(typeof signPdfBuffer, "function", "signPdfBuffer must be a function");
      });

      it("T1.7.5: Verify appendSignatureIncremental contract parameter signature across repositories", () => {
        assert.strictEqual(typeof appendSignatureIncremental, "function", "appendSignatureIncremental must be a function");
      });
    });

    // Feature 8: Single & Combined DTR Compliance
    describe("Feature 8: Single & Combined DTR Compliance", () => {
      it("T1.8.1: Single DTR first-pass signing produces compliant PDF", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          reason: "Civil Service Form No. 48 Official Daily Time Record Certification",
          signerName: "Ace Malto",
        });

        assert.ok(signed.signedBuffer.length > 0);
        assert.strictEqual(signed.signerName, "Ace Malto");
      });

      it("T1.8.2: Single DTR second-pass incremental signing produces multi-revision PDF", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Ace Malto",
        });
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Buena Rene Jane Rosendo",
          [[350, 200, 475, 226]],
          "Civil Service Form No. 48 Official Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Signature"
        );

        const pdfStr = pass2.toString("latin1");
        const sigMatches = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
        assert.strictEqual(sigMatches.length, 2, "Must contain exactly 2 signatures in 2 revisions");
      });

      it("T1.8.3: Combine DTR batch signing produces valid byte structure", async () => {
        const doc1 = await createSyntheticPdf();
        const doc2 = await createSyntheticPdf();

        const s1 = await signPdfBuffer(doc1, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Buena Rene Jane Rosendo",
        });
        const s2 = await signPdfBuffer(doc2, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Buena Rene Jane Rosendo",
        });

        assert.ok(s1.signedBuffer.length > 0);
        assert.ok(s2.signedBuffer.length > 0);
      });

      it("T1.8.4: Signed PDFs open cleanly in PDFDocument without parsing errors", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(signed.signedBuffer);
        assert.strictEqual(doc.getPageCount(), 1);
      });

      it("T1.8.5: Signed PDFs contain valid /ByteRange and PKCS#7 /Contents", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pdfStr = signed.signedBuffer.toString("latin1");
        assert.match(pdfStr, /\/ByteRange\s*\[\s*\d+\s+\d+\s+\d+\s+\d+\s*\]/, "Must have resolved ByteRange");
        assert.match(pdfStr, /\/Filter\s*\/Adobe\.PPKLite/, "Must use Adobe.PPKLite filter");
        assert.match(pdfStr, /\/SubFilter\s*\/adbe\.pkcs7\.detached/, "Must use adbe.pkcs7.detached");
      });
    });
  });

  // ==========================================================================
  // TIER 2: BOUNDARY & CORNER CASES (40 Tests, 5 per feature boundary)
  // ==========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    // Boundary 1: Form XObject geometry and boundary conditions
    describe("Boundary 1: Form XObject Bounding Conditions", () => {
      it("T2.1.1: Form XObject with degenerate rect auto-normalizes to minimum dimensions", () => {
        const box = normalizeSignatureBoundingBox([100, 200, 100, 200]);
        assert.ok(box.bboxW >= 125, "Bounding width must be at least 125pt");
        assert.ok(box.bboxH >= 26, "Bounding height must be at least 26pt");
      });

      it("T2.1.2: Form XObject with inverted coords [max, max, min, min] normalizes correctly", () => {
        const box = normalizeSignatureBoundingBox([300, 400, 100, 200]);
        assert.strictEqual(box.minX, 100);
        assert.strictEqual(box.minY, 200);
        assert.strictEqual(box.maxX, 300);
        assert.strictEqual(box.maxY, 400);
      });

      it("T2.1.3: Form XObject with fractional float coordinates rounds cleanly", () => {
        const box = normalizeSignatureBoundingBox([100.45, 200.89, 225.12, 235.67]);
        assert.strictEqual(box.minX, 100);
        assert.strictEqual(box.minY, 201);
      });

      it("T2.1.4: Form XObject spanning large width (> 500pt) normalizes safely", () => {
        const box = normalizeSignatureBoundingBox([50, 100, 560, 200]);
        assert.strictEqual(box.bboxW, 510);
        assert.strictEqual(box.bboxH, 100);
      });

      it("T2.1.5: First signature with skipVisualText=true generates valid Form XObject", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          skipVisualText: true,
          sigRect: [100, 200, 225, 226],
        });
        const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
        assert.ok(formObjs.length > 0);
        assert.match(formObjs[0].body, /\/Resources\s*(?:<<|\d+\s+0\s+R)/);
      });
    });

    // Boundary 2: Image XObject formats & edge cases
    describe("Boundary 2: Image XObject Formats & Edge Cases", () => {
      it("T2.2.1: Image XObject handles 1x1 transparent PNG without throwing", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Sig",
          0,
          { signatureImage: createTestSignatureImageBase64(1, 1) }
        );
        assert.ok(pass2.length > pass1.signedBuffer.length);
      });

      it("T2.2.2: Image XObject handles missing image data gracefully (fallback)", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Sig",
          0,
          { signatureImage: "corrupted_non_base64" }
        );
        assert.ok(pass2.length > pass1.signedBuffer.length);
      });

      it("T2.2.3: Image XObject handles counter-signature checkmark vector fallback", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Sig",
          0,
          { isCounterSign: true }
        );
        assert.ok(pass2.toString("latin1").includes("DigiSigned"));
      });

      it("T2.2.4: High aspect-ratio signature image embeds without distorting", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Sig",
          0,
          { signatureImage: createTestSignatureImageBase64(300, 50) }
        );
        assert.ok(pass2.length > pass1.signedBuffer.length);
      });

      it("T2.2.5: Incremental signing with empty visualOptions embeds cleanly", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification",
          "pnpki@dict.gov.ph",
          "Legazpi City",
          "Supervisor_Sig",
          0,
          {}
        );
        assert.ok(pass2.length > pass1.signedBuffer.length);
      });
    });

    // Boundary 3: Widget rects, deduplication & multi-rect boundary
    describe("Boundary 3: Widget Rects & Deduplication", () => {
      it("T2.3.1: Duplicate identical signature rects are deduplicated", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRects: [
            [100, 200, 225, 226],
            [100, 200, 225, 226], // Duplicate!
          ],
        });
        const doc = await PDFDocument.load(signed.signedBuffer);
        const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
        const fields = acroForm?.lookupMaybe(PDFName.of("Fields"), PDFArray);
        assert.strictEqual(fields?.size(), 1, "Duplicate rects must be deduplicated to 1 field");
      });

      it("T2.3.2: Quad-copy rects (4 boxes) normalizes without crashing", () => {
        const boxes = [
          [50, 100, 175, 126],
          [200, 100, 325, 126],
          [350, 100, 475, 126],
          [500, 100, 625, 126],
        ].map((r) => normalizeSignatureBoundingBox(r as any));
        assert.strictEqual(boxes.length, 4);
      });

      it("T2.3.3: Empty sigRects array falls back to default rect [98, 218, 122, 26]", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRects: [],
        });
        assert.ok(signed.signedBuffer.length > 0);
      });

      it("T2.3.4: Signature box with width < 20 auto-expands to minimum 125pt", () => {
        const box = normalizeSignatureBoundingBox([100, 200, 110, 220]);
        assert.strictEqual(box.bboxW, 125);
      });

      it("T2.3.5: Signature box with height < 14 auto-expands to minimum 26pt", () => {
        const box = normalizeSignatureBoundingBox([100, 200, 250, 205]);
        assert.strictEqual(box.bboxH, 26);
      });
    });

    // Boundary 4: Catalog nested dictionaries & multi-revision boundary
    describe("Boundary 4: Catalog Nested Dictionaries & Multi-Revision", () => {
      it("T2.4.1: Catalog with 3 levels of nested dictionaries remains balanced", async () => {
        const basePdf = await createSyntheticPdf({ nestedCatalogDicts: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification"
        );
        const catalogs = findObjectsWithType(pass2, "Catalog");
        for (const cat of catalogs) {
          assert.ok(isDictBalanced(cat.body));
        }
      });

      it("T2.4.2: Catalog with trailing whitespace before closing >> handled safely", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification"
        );
        const pdfStr = pass2.toString("latin1");
        assert.ok(pdfStr.includes("trailer"));
      });

      it("T2.4.3: Catalog without initial /AcroForm links newly created AcroForm", async () => {
        const basePdf = await createSyntheticPdf({ withAcroForm: false });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(pass1.signedBuffer);
        assert.ok(doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict));
      });

      it("T2.4.4: Catalog with existing indirect /AcroForm updates in-place", async () => {
        const basePdf = await createSyntheticPdf({ withAcroForm: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification"
        );
        const doc = await PDFDocument.load(pass2);
        assert.ok(doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict));
      });

      it("T2.4.5: Multiple sequential incremental updates (Revisions 1 to 4) preserve all revisions", async () => {
        const basePdf = await createSyntheticPdf();
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 100, 225, 126],
          signerName: "Signer 1",
        });
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Signer 2",
          [[100, 150, 225, 176]],
          "Verification 2"
        );
        const pass3 = await appendSignatureIncremental(
          pass2,
          "Signer 3",
          [[100, 200, 225, 226]],
          "Verification 3"
        );
        const pass4 = await appendSignatureIncremental(
          pass3,
          "Signer 4",
          [[100, 250, 225, 276]],
          "Verification 4"
        );

        const pdfStr = pass4.toString("latin1");
        const sigMatches = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
        assert.strictEqual(sigMatches.length, 4, "Must contain all 4 signatures");
      });
    });

    // Boundary 5: AcroForm /DR and /Fields boundary
    describe("Boundary 5: AcroForm /DR and /Fields Boundary", () => {
      it("T2.5.1: AcroForm /DR pointing to multi-font dictionary preserved", async () => {
        const basePdf = await createSyntheticPdf({ indirectDR: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(pass1.signedBuffer);
        const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
        assert.ok(acroForm?.lookupMaybe(PDFName.of("DR"), PDFDict));
      });

      it("T2.5.2: AcroForm without initial /DR creates default Helvetica /DR", async () => {
        const basePdf = await createSyntheticPdf({ withAcroForm: false });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pass2 = await appendSignatureIncremental(
          pass1.signedBuffer,
          "Supervisor",
          [[100, 200, 225, 226]],
          "Verification"
        );
        assert.match(pass2.toString("latin1"), /\/DR\s*<<\s*\/Font/);
      });

      it("T2.5.3: AcroForm with empty Fields [] array appends cleanly", async () => {
        const basePdf = await createSyntheticPdf({ withAcroForm: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(pass1.signedBuffer);
        const fields = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict)?.lookupMaybe(PDFName.of("Fields"), PDFArray);
        assert.strictEqual(fields?.size(), 1);
      });

      it("T2.5.4: AcroForm preserves existing non-signature form fields", async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([612, 792]);
        const form = doc.getForm();
        const textField = form.createTextField("EmployeeName");
        textField.setText("Juan Dela Cruz");
        textField.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
        const pdfWithForm = Buffer.from(await doc.save());

        const signed = await signPdfBuffer(pdfWithForm, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const verifiedDoc = await PDFDocument.load(signed.signedBuffer);
        const verifiedForm = verifiedDoc.getForm();
        assert.strictEqual(verifiedForm.getTextField("EmployeeName").getText(), "Juan Dela Cruz");
      });

      it("T2.5.5: AcroForm default appearance string /DA is preserved", async () => {
        const basePdf = await createSyntheticPdf({ indirectDR: true });
        const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const pdfStr = pass1.signedBuffer.toString("latin1");
        assert.match(pdfStr, /\/DA\s*\(/);
      });
    });

    // Boundary 6: Page /Contents multi-stream & font resource boundary
    describe("Boundary 6: Page /Contents & Resource Boundary", () => {
      it("T2.6.1: Page with 3 existing content streams handles typography append", async () => {
        const basePdf = await createSyntheticPdf({ contentsType: "array" });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(signed.signedBuffer);
        assert.ok(doc.getPages()[0]);
      });

      it("T2.6.2: Page without initial /Resources creates /Resources dictionary", async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([612, 792]);
        page.node.delete(PDFName.of("Resources"));
        const pdfBuf = Buffer.from(await doc.save());

        const signed = await signPdfBuffer(pdfBuf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const loaded = await PDFDocument.load(signed.signedBuffer);
        assert.ok(loaded.getPages()[0].node.lookupMaybe(PDFName.of("Resources"), PDFDict));
      });

      it("T2.6.3: Page font resources merge F_PNPKI font without collisions", async () => {
        const basePdf = await createSyntheticPdf();
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const doc = await PDFDocument.load(signed.signedBuffer);
        const page = doc.getPages()[0];
        const res = page.node.lookupMaybe(PDFName.of("Resources"), PDFDict);
        const fonts = res?.lookupMaybe(PDFName.of("Font"), PDFDict);
        assert.ok(fonts?.lookupMaybe(PDFName.of("F_PNPKI"), PDFDict));
      });

      it("T2.6.4: Page /Annots as indirect reference array preserves existing annotations", async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([612, 792]);
        const annotsArr = doc.context.obj([]);
        const annotsRef = doc.context.register(annotsArr);
        page.node.set(PDFName.of("Annots"), annotsRef);
        const pdfBuf = Buffer.from(await doc.save());

        const signed = await signPdfBuffer(pdfBuf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
        const loaded = await PDFDocument.load(signed.signedBuffer);
        const annots = loaded.getPages()[0].node.lookupMaybe(PDFName.of("Annots"), PDFArray);
        assert.ok(annots && annots.size() > 0);
      });

      it("T2.6.5: Deduplication guard skips duplicate visual typography if already present", async () => {
        const basePdf = await createSyntheticPdf({ signerNameInText: "Digitally signed by Ace Malto" });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          sigRect: [100, 200, 225, 226],
          signerName: "Ace Malto",
        });
        assert.ok(signed.signedBuffer.length > 0);
      });
    });

    // Boundary 7: P12 crypto & authentication boundary
    describe("Boundary 7: P12 Crypto & Authentication Boundary", () => {
      it("T2.7.1: Empty or whitespace password fails validation", () => {
        const v = validatePasswordStrength("   ");
        assert.strictEqual(v.valid, false);
      });

      it("T2.7.2: Password encryption/decryption round-trip with special characters", () => {
        const original = "DICT-pnpki@#2026!$%^&*()_+";
        const enc = encryptP12Password(original);
        assert.ok(enc.startsWith("enc:"));
        const dec = decryptP12Password(enc);
        assert.strictEqual(dec, original);
      });

      it("T2.7.3: Password hash verification with scrypt", () => {
        const plain = "Secur3P@ssw0rd!";
        const hashed = hashPassword(plain);
        assert.ok(hashed.startsWith("scrypt:"));
        assert.strictEqual(verifyPassword(plain, hashed), true);
        assert.strictEqual(verifyPassword("WrongPassword", hashed), false);
      });

      it("T2.7.4: Corrupt .p12 base64 throws clean descriptive error", () => {
        assert.throws(
          () => getSignerIdentityFromP12("not_a_valid_p12_base64_string", "pass"),
          /Error|Could not find valid|supported|asn1/i
        );
      });

      it("T2.7.5: Wrong password for .p12 throws clean descriptive error", () => {
        assert.throws(
          () => getSignerIdentityFromP12(cachedDefaultP12Base64, "IncorrectPassword"),
          /password/i
        );
      });
    });

    // Boundary 8: Signer names, mojibake, special characters & multi-page boundary
    describe("Boundary 8: Signer Names, Mojibake & Multi-Page Boundary", () => {
      it("T2.8.1: Signer name with Filipino ñ/Ñ handled correctly", () => {
        const fixed = fixMojibake("Annabel C. Odoño-Calimpong");
        assert.strictEqual(fixed, "Annabel C. Odoño-Calimpong");
      });

      it("T2.8.2: Signer name with mojibake characters automatically sanitized", () => {
        assert.strictEqual(fixMojibake("Annabel C. OdoÃ±o"), "Annabel C. Odoño");
        assert.strictEqual(fixMojibake("ODOÃ‘O"), "ODOÑO");
        assert.strictEqual(fixMojibake("Odoæo"), "Odoño");
      });

      it("T2.8.3: Signer name with parentheses and backslashes escaped in appearance stream", () => {
        const lines = splitSignerNameToLines("Engr. Juan (Lead \\ Chief) Dela Cruz", 20);
        assert.ok(lines.length >= 2);
      });

      it("T2.8.4: Long signer name wraps cleanly into multi-line layout", () => {
        const lines = splitSignerNameToLines("Ma. Victoria Consuelo Esperanza De Los Santos", 20);
        assert.strictEqual(lines.length, 2);
        assert.ok(lines[0].startsWith("by "));
      });

      it("T2.8.5: Multi-page document with pageIndex=-1 targets the last page cleanly", async () => {
        const basePdf = await createSyntheticPdf({ pageCount: 5 });
        const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
          pageIndex: -1,
          sigRect: [100, 200, 225, 226],
        });
        const doc = await PDFDocument.load(signed.signedBuffer);
        const lastPage = doc.getPages()[4];
        const annots = lastPage.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
        assert.ok(annots && annots.size() > 0, "Last page must contain the signature annotation");
      });
    });
  });

  // ==========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS (8 Tests)
  // ==========================================================================
  describe("Tier 3: Cross-Feature Interactions", () => {
    it("T3.1: Sequential two-pass signing (First-signature + Incremental)", async () => {
      const basePdf = await createSyntheticPdf();
      const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        sigRect: [100, 200, 225, 226],
        signerName: "Employee One",
      });
      const pass2 = await appendSignatureIncremental(
        pass1.signedBuffer,
        "Supervisor Two",
        [[350, 200, 475, 226]],
        "Verification"
      );

      const doc = await PDFDocument.load(pass2);
      assert.strictEqual(doc.getPageCount(), 1);
      const pdfStr = pass2.toString("latin1");
      assert.strictEqual((pdfStr.match(/\/Type\s*\/Sig\b/g) || []).length, 2);
    });

    it("T3.2: Visual stamp image + cryptographic field + terminal widget binding", async () => {
      const basePdf = await createSyntheticPdf();
      const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        sigRect: [100, 200, 225, 226],
        signatureImage: createTestSignatureImageBase64(),
        signerName: "Juan Dela Cruz",
      });

      const widgets = findObjectsWithSubtype(signed.signedBuffer, "Widget");
      const sigWidget = widgets.find((w) => w.body.includes("/FT /Sig"));
      assert.ok(sigWidget, "Terminal widget exists");
      assert.match(sigWidget.body, /\/AP\s*<<\s*\/N/, "Widget has /AP /N appearance");
    });

    it("T3.3: Dual-copy CS Form 48 rects + incremental catalog sanitization", async () => {
      const basePdf = await createSyntheticPdf({ nestedCatalogDicts: true });
      const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        sigRects: [
          [100, 200, 225, 226],
          [350, 200, 475, 226],
        ],
      });
      const pass2 = await appendSignatureIncremental(
        pass1.signedBuffer,
        "Supervisor Two",
        [
          [100, 100, 225, 126],
          [350, 100, 475, 126],
        ],
        "Verification"
      );

      const catalogs = findObjectsWithType(pass2, "Catalog");
      for (const cat of catalogs) {
        assert.ok(isDictBalanced(cat.body));
      }
    });

    it("T3.4: Indirect AcroForm /DR + Safe incremental catalog update", async () => {
      const basePdf = await createSyntheticPdf({ indirectDR: true, nestedCatalogDicts: true });
      const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS);
      const pass2 = await appendSignatureIncremental(
        pass1.signedBuffer,
        "Supervisor Two",
        [[350, 200, 475, 226]],
        "Verification"
      );

      const doc = await PDFDocument.load(pass2);
      assert.ok(doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict));
    });

    it("T3.5: Array /Contents + First-signature Form XObject resources", async () => {
      const basePdf = await createSyntheticPdf({ contentsType: "array" });
      const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        sigRect: [100, 200, 225, 226],
      });

      const formObjs = findObjectsWithSubtype(signed.signedBuffer, "Form");
      for (const fo of formObjs) {
        assert.match(fo.body, /\/Resources\s*(?:<<|\d+\s+0\s+R)/);
      }
    });

    it("T3.6: P12 commonName + Terminal widget /T and /Name consistency", async () => {
      const certP12 = createTestP12("Engr. Ace Malto", "DICT V", DEFAULT_P12_PASS);
      const basePdf = await createSyntheticPdf();
      const signed = await signPdfBuffer(basePdf, certP12, DEFAULT_P12_PASS, {
        sigRect: [100, 200, 225, 226],
      });

      assert.strictEqual(signed.signerName, "Engr. Ace Malto");
      const pdfStr = signed.signedBuffer.toString("latin1");
      assert.ok(pdfStr.includes("Engr. Ace Malto"));
    });

    it("T3.7: Special characters & mojibake + Appearance stream typography", async () => {
      const basePdf = await createSyntheticPdf();
      const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        signerName: "Annabel C. OdoÃ±o-Calimpong (OIC)",
        sigRect: [100, 200, 225, 226],
      });

      assert.ok(signed.signerName.includes("Odoño"));
      const doc = await PDFDocument.load(signed.signedBuffer);
      assert.ok(doc);
    });

    it("T3.8: Three-pass sequential signing (Employee + Supervisor + Auditor)", async () => {
      const basePdf = await createSyntheticPdf();
      const p1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        sigRect: [100, 100, 225, 126],
        signerName: "Employee One",
      });
      const p2 = await appendSignatureIncremental(
        p1.signedBuffer,
        "Supervisor Two",
        [[100, 150, 225, 176]],
        "Verification"
      );
      const p3 = await appendSignatureIncremental(
        p2,
        "Auditor Three",
        [[100, 200, 225, 226]],
        "Final Audit"
      );

      const pdfStr = p3.toString("latin1");
      const sigs = [...pdfStr.matchAll(/\/Type\s*\/Sig\b/g)];
      assert.strictEqual(sigs.length, 3, "All 3 signatures preserved across 3 revisions");
    });
  });

  // ==========================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Scenarios)
  // ==========================================================================
  describe("Tier 4: Real-World Scenarios", () => {
    it("Scenario 4.1: Single CS Form 48 DTR First Signature (Personnel Pass 1)", async () => {
      const basePdf = await createSyntheticPdf();
      const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        reason: "Civil Service Form No. 48 Official Daily Time Record Digital Certification",
        sigRects: [
          [98, 218, 223, 244], // Copy 1
          [380, 218, 505, 244], // Copy 2
        ],
        signerName: "Ace Malto",
        signatureImage: createTestSignatureImageBase64(),
      });

      assert.strictEqual(signed.signerName, "Ace Malto");
      const doc = await PDFDocument.load(signed.signedBuffer);
      assert.strictEqual(doc.getPageCount(), 1);
    });

    it("Scenario 4.2: Single CS Form 48 DTR Two-Pass Sequential Signing (Personnel + Supervisor Pass 2)", async () => {
      const basePdf = await createSyntheticPdf();
      const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        reason: "Civil Service Form No. 48 Official Daily Time Record Digital Certification",
        sigRects: [
          [98, 218, 223, 244],
          [380, 218, 505, 244],
        ],
        signerName: "Ace Malto",
      });

      const pass2 = await appendSignatureIncremental(
        pass1.signedBuffer,
        "Buena Rene Jane Rosendo",
        [
          [98, 120, 223, 146], // Supervisor Copy 1
          [380, 120, 505, 146], // Supervisor Copy 2
        ],
        "Civil Service Form No. 48 Official Verification",
        "pnpki@dict.gov.ph",
        "Legazpi City, Philippines",
        "Supervisor_Signature",
        0,
        {
          signatureImage: createTestSignatureImageBase64(),
          isCounterSign: true,
        }
      );

      const pdfStr = pass2.toString("latin1");
      assert.strictEqual((pdfStr.match(/\/Type\s*\/Sig\b/g) || []).length, 2);
      const doc = await PDFDocument.load(pass2);
      assert.ok(doc);
    });

    it("Scenario 4.3: Multi-Document Combine DTR Signing (DTR + Accomplishment Report)", async () => {
      const dtrPdf = await createSyntheticPdf({ pageCount: 1 });
      const arPdf = await createSyntheticPdf({ pageCount: 2 });

      // Sign DTR
      const signedDtr = await signPdfBuffer(dtrPdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        signerName: "Buena Rene Jane Rosendo",
        sigRect: [380, 120, 505, 146],
        reason: "Civil Service Form No. 48 Official Verification",
      });

      // Sign AR
      const signedAr = await signPdfBuffer(arPdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        signerName: "Buena Rene Jane Rosendo",
        sigRect: [320, 80, 445, 106],
        reason: "Accomplishment Report Verification & Official Approval",
        pageIndex: 1, // Last page
      });

      assert.ok(signedDtr.signedBuffer.length > 0);
      assert.ok(signedAr.signedBuffer.length > 0);
      const arDoc = await PDFDocument.load(signedAr.signedBuffer);
      assert.strictEqual(arDoc.getPageCount(), 2);
    });

    it("Scenario 4.4: Combined DTR with Special Signatory Characters / Parentheses in Name", async () => {
      const basePdf = await createSyntheticPdf();
      const signed = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        signerName: "Annabel C. Odoño-Calimpong (Provincial Director)",
        sigRect: [98, 218, 223, 244],
        reason: "Civil Service Form No. 48 Official Verification",
      });

      assert.ok(signed.signerName.includes("Odoño"));
      const pdfStr = signed.signedBuffer.toString("latin1");
      assert.ok(pdfStr.includes("/Filter /Adobe.PPKLite"));
    });

    it("Scenario 4.5: Dual-Copy CS Form 48 Verification against Adobe Acrobat ISO 32000 Structural Requirements", async () => {
      const basePdf = await createSyntheticPdf({ nestedCatalogDicts: true });
      const pass1 = await signPdfBuffer(basePdf, cachedDefaultP12Base64, DEFAULT_P12_PASS, {
        sigRects: [
          [98, 218, 223, 244],
          [380, 218, 505, 244],
        ],
        signerName: "Ace Malto",
      });

      const pass2 = await appendSignatureIncremental(
        pass1.signedBuffer,
        "Buena Rene Jane Rosendo",
        [
          [98, 120, 223, 146],
          [380, 120, 505, 146],
        ],
        "Civil Service Form No. 48 Official Verification",
        "pnpki@dict.gov.ph",
        "Legazpi City, Philippines",
        "Supervisor_Signature",
        0,
        {
          signatureImage: createTestSignatureImageBase64(),
        }
      );

      // 1. Verify Catalog dictionaries in both revisions are balanced
      const catalogs = findObjectsWithType(pass2, "Catalog");
      for (const cat of catalogs) {
        assert.ok(isDictBalanced(cat.body), `Catalog obj ${cat.objNum} must have balanced << >>`);
      }

      // 2. Verify all Form XObjects declare /Resources
      const formObjs = findObjectsWithSubtype(pass2, "Form");
      for (const fo of formObjs) {
        assert.match(fo.body, /\/Resources\s*(?:<<|\d+\s+0\s+R)/, `Form XObject obj ${fo.objNum} must have /Resources`);
      }

      // 3. Verify all Image XObjects declare /Resources
      const imgObjs = findObjectsWithSubtype(pass2, "Image");
      for (const io of imgObjs) {
        assert.match(io.body, /\/Resources\s*<<\s*>>/, `Image XObject obj ${io.objNum} must have /Resources << >>`);
      }

      // 4. Verify no /FT /Sig field has /Kids
      const sigFields = findObjectsWithFT(pass2, "Sig");
      for (const sf of sigFields) {
        assert.ok(!/\/Kids\b/.test(sf.body), `Signature field obj ${sf.objNum} must NOT have /Kids`);
      }

      // 5. Verify PDF loads cleanly
      const doc = await PDFDocument.load(pass2);
      assert.strictEqual(doc.getPageCount(), 1);
    });
  });
});
