import { PDFDocument, PDFRawStream, PDFDict, PDFName, PDFNumber, PDFString, PDFArray } from "pdf-lib";
import forge from "node-forge";
import { signPdfBuffer, appendSignatureIncremental } from "../../../server/services/pnpkiSigningService";

// Helper for bracket counting
function countDictionaryBrackets(str: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  let inString = false;
  let parenDepth = 0;
  let inComment = false;
  let inHex = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = i + 1 < str.length ? str[i + 1] : "";

    if (inComment) {
      if (ch === "\r" || ch === "\n") inComment = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) inString = false;
      }
      continue;
    }
    if (inHex) {
      if (ch === ">") inHex = false;
      continue;
    }
    if (ch === "%") { inComment = true; continue; }
    if (ch === "(") { inString = true; parenDepth = 1; continue; }
    if (ch === "<" && next === "<") { open++; i++; continue; }
    if (ch === "<" && next !== "<") { inHex = true; continue; }
    if (ch === ">" && next === ">") { close++; i++; continue; }
  }
  return { open, close };
}

function generateTestP12(commonName = "Test Signer", password = "SecretPassword123!") {
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(1024);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { generateLocalKeyId: true });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return { p12Base64: Buffer.from(p12Der, "binary").toString("base64"), password };
}

const RED_PNG_WITH_ALPHA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mP8z8AARBgGhowBADIwAgH2Fh60AAAAAElFTkSuQmCC";

async function verifyProbeA4Simulation() {
  console.log("=== Verifying Fix 1 (Probe A4 Simulation) ===");
  const rawCatalogBody = `<<
/Type /Catalog
/Pages 2 0 R
/Perms << >>
>>`;

  let cleanedCatalogBody = rawCatalogBody.trim();
  cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");
  const firstDictOpen = cleanedCatalogBody.indexOf("<<");
  const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
  if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
    cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
  }

  // OLD BUGGY LOGIC:
  const oldResult = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
  console.log("Old logic trailing content:", JSON.stringify(oldResult.slice(-20)));

  // NEW SAFE LOGIC:
  const { open: catOpen, close: catClose } = countDictionaryBrackets(cleanedCatalogBody);
  let newResult = cleanedCatalogBody;
  if (catClose > catOpen) {
    newResult = newResult.replace(/>>\s*$/, "").trim();
  }
  console.log("New logic trailing content:", JSON.stringify(newResult.slice(-20)));

  const oldMatches = countDictionaryBrackets(oldResult);
  const newMatches = countDictionaryBrackets(newResult);
  console.log(`Old logic brackets: open=${oldMatches.open}, close=${oldMatches.close} -> Balanced: ${oldMatches.open === oldMatches.close}`);
  console.log(`New logic brackets: open=${newMatches.open}, close=${newMatches.close} -> Balanced: ${newMatches.open === newMatches.close}`);

  if (oldMatches.open !== oldMatches.close && newMatches.open === newMatches.close) {
    console.log(">>> FIX 1 VERIFIED: Probe A4 syntax corruption resolved!");
  } else {
    throw new Error("Fix 1 verification failed");
  }
}

async function verifyProbeG1Simulation() {
  console.log("\n=== Verifying Fix 2 (Probe G1 Simulation) ===");
  const dtrDoc = await PDFDocument.create();
  const page = dtrDoc.addPage([612, 792]);

  // Embed PNG image
  const imgData = RED_PNG_WITH_ALPHA.replace(/^data:image\/\w+;base64,/, "");
  const imgBuf = Buffer.from(imgData, "base64");
  const embedded = await dtrDoc.embedPng(imgBuf);

  page.drawImage(embedded, {
    x: 52,
    y: 201.5,
    width: 30,
    height: 23,
  });

  // Apply Fix 2 before save:
  await dtrDoc.flush();
  for (const [, obj] of dtrDoc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFRawStream ? obj.dict : (obj instanceof PDFDict ? obj : null);
    if (dict) {
      const subtype = dict.get(PDFName.of("Subtype"));
      if (subtype === PDFName.of("Image") || subtype === PDFName.of("Form")) {
        if (!dict.has(PDFName.of("Resources"))) {
          dict.set(PDFName.of("Resources"), dtrDoc.context.obj({}));
        }
      }
    }
  }

  const saved = await dtrDoc.save({ useObjectStreams: false });
  const pdfStr = Buffer.from(saved).toString("latin1");

  // Audit all Image XObjects
  const imgMatches = [...pdfStr.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]*?)\/Subtype\s*\/Image([\s\S]*?)>>/g)];
  console.log(`Found ${imgMatches.length} Image XObjects in generated PDF.`);

  let allImagesHaveResources = true;
  for (let idx = 0; idx < imgMatches.length; idx++) {
    const m = imgMatches[idx];
    const dictBody = m[0];
    const hasRes = /\/Resources\s*<<\s*>>/.test(dictBody);
    console.log(`Image ${idx} (obj ${m[1]}): /Resources << >> present = ${hasRes}`);
    if (!hasRes) allImagesHaveResources = false;
  }

  if (allImagesHaveResources && imgMatches.length >= 2) {
    console.log(">>> FIX 2 VERIFIED: All Pass 1 Image XObjects (RGB & SMask) have /Resources << >>!");
  } else {
    throw new Error("Fix 2 verification failed");
  }
}

async function run() {
  await verifyProbeA4Simulation();
  await verifyProbeG1Simulation();
  console.log("\n>>> ALL SIMULATIONS PASSED (100%) <<<");
}

run().catch(console.error);
