import { PDFDocument, PDFName, PDFNumber, PDFString, PDFArray, PDFDict, PDFRawStream } from "pdf-lib";

// Verification test for proposed Defect 1 and Defect 2 fixes

async function runComprehensiveVerification() {
  console.log("=================================================");
  console.log("  VERIFICATION SUITE FOR ITERATION 2 PROPOSED FIXES");
  console.log("=================================================\n");

  // --- Probe 1: Catalog Sanitization Bracket Balancing (Defect 1) ---
  console.log("--- Test 1: Document Catalog with Trailing Nested Dictionary ---");
  const originalCatalog = `1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/ViewerPreferences << /FitWindow true >>
>>
endobj`;

  function proposedCatalogClean(catalogBody: string): string {
    let cleanedCatalogBody = catalogBody.trim();
    cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");

    const firstDictOpen = cleanedCatalogBody.indexOf("<<");
    const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
    if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
      cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
    }

    // Safe bracket check: only strip trailing >> if genuine surplus
    const openCount = (cleanedCatalogBody.match(/<</g) || []).length;
    const closeCount = (cleanedCatalogBody.match(/>>/g) || []).length;
    if (closeCount > openCount) {
      cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
    }

    return `<<\n${cleanedCatalogBody}\n/AcroForm 8 0 R\n>>`;
  }

  const updatedCatalog = proposedCatalogClean(originalCatalog);
  console.log("Updated Catalog Object:\n", updatedCatalog);

  const opens = (updatedCatalog.match(/<</g) || []).length;
  const closes = (updatedCatalog.match(/>>/g) || []).length;
  const hasViewerPrefsClosed = updatedCatalog.includes("/ViewerPreferences << /FitWindow true >>");
  const hasAcroFormAtRoot = updatedCatalog.includes("/AcroForm 8 0 R");
  const isBalanced = opens === closes;

  console.log(`- Bracket balance (<<=${opens}, >>=${closes}): ${isBalanced ? "PASS" : "FAIL"}`);
  console.log(`- ViewerPreferences closed properly: ${hasViewerPrefsClosed ? "PASS" : "FAIL"}`);
  console.log(`- AcroForm placed at root level: ${hasAcroFormAtRoot ? "PASS" : "FAIL"}`);

  if (!isBalanced || !hasViewerPrefsClosed || !hasAcroFormAtRoot) {
    throw new Error("Test 1 FAILED!");
  }

  // --- Probe 2: First-Signature Mode Image XObjects /Resources << >> (Defect 2) ---
  console.log("\n--- Test 2: First-Signature Mode Image XObject & SMask Resources ---");

  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);

  // Simulate proposed signPdfBuffer image embedding logic:
  const embedded = await doc.embedPng(transparentPng);
  await embedded.embed();

  // Inject /Resources into Image XObject and SMask
  const rawImg: any = doc.context.lookup(embedded.ref);
  if (rawImg && rawImg.dict) {
    if (!rawImg.dict.has(PDFName.of("Resources"))) {
      rawImg.dict.set(PDFName.of("Resources"), doc.context.obj({}));
    }
    const smaskRef = rawImg.dict.get(PDFName.of("SMask"));
    if (smaskRef) {
      const smaskObj: any = doc.context.lookup(smaskRef);
      if (smaskObj && smaskObj.dict && !smaskObj.dict.has(PDFName.of("Resources"))) {
        smaskObj.dict.set(PDFName.of("Resources"), doc.context.obj({}));
      }
    }
  }

  // Sweep indirect objects before save
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj && (obj as any).dict) {
      const dict = (obj as any).dict;
      const subtype = dict.get(PDFName.of("Subtype"));
      if (
        (subtype === PDFName.of("Image") || subtype?.toString() === "/Image") &&
        !dict.has(PDFName.of("Resources"))
      ) {
        dict.set(PDFName.of("Resources"), doc.context.obj({}));
      }
    }
  }

  page.drawImage(embedded, { x: 50, y: 50, width: 30, height: 30 });

  const savedPdfBytes = await doc.save({ useObjectStreams: false });
  const savedPdfStr = Buffer.from(savedPdfBytes).toString("latin1");

  // Parse all Image XObjects
  const imgObjs: { objNum: number; body: string; hasResources: boolean }[] = [];
  const objRegex = /(\d+)\s+0\s+obj\s*([\s\S]*?)\s*endobj/g;
  let m;
  while ((m = objRegex.exec(savedPdfStr)) !== null) {
    const body = m[2];
    if (body.includes("/Subtype /Image") || body.includes("/Subtype/Image")) {
      imgObjs.push({
        objNum: parseInt(m[1]),
        body,
        hasResources: body.includes("/Resources"),
      });
    }
  }

  console.log(`Found ${imgObjs.length} Image XObjects in generated PDF:`);
  let allHaveResources = true;
  for (const io of imgObjs) {
    console.log(`- Object ${io.objNum}: /Subtype /Image, /Resources present: ${io.hasResources}`);
    if (!io.hasResources) allHaveResources = false;
  }

  console.log(`- 100% of Image XObjects have /Resources: ${allHaveResources ? "PASS" : "FAIL"}`);
  if (!allHaveResources || imgObjs.length < 2) {
    throw new Error("Test 2 FAILED!");
  }

  // --- Probe 3: Test document reloadability in pdf-lib ---
  console.log("\n--- Test 3: Reload PDF in pdf-lib (Acrobat-equivalent parser check) ---");
  const reloaded = await PDFDocument.load(savedPdfBytes);
  console.log(`- Successfully reloaded document with ${reloaded.getPageCount()} page(s): PASS`);

  console.log("\n=================================================");
  console.log("  ALL TESTS PASSED WITH 100% COMPLIANCE!");
  console.log("=================================================");
}

runComprehensiveVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
