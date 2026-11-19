# Investigation & Root Cause Resolution Report: Iteration 2 Defects

**Agent**: `explorer_it2_1` (teamwork_explorer)  
**Roles**: investigation, synthesis  
**Target File**: `server/services/pnpkiSigningService.ts`  
**Working Directory**: `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_1\`  
**Date**: 2026-11-15T03:10:00Z  

---

## 1. Observation

### 1.1 Direct Observations on Defect 1: Catalog Nested Dictionary Truncation
- **Location**: `server/services/pnpkiSigningService.ts`, lines 1441–1449:
  ```typescript
  1441:     // Cleanly extract inner dictionary content if enclosed in << ... >>
  1442:     const firstDictOpen = cleanedCatalogBody.indexOf("<<");
  1443:     const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
  1444:     if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
  1445:       cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
  1446:     }
  1447: 
  1448:     // Clean dangling >> if any safely without stripping nested dictionaries
  1449:     cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
  ```
- **Verbatim Error in Adversarial Probe A4**:
  ```
  [✗ FAIL] [A4] Unbalanced dictionary brackets in Catalog: << count=1, >> count=1.
  Line 1449 replace(/>>\s*$/, "") stripped closing >> from nested dictionary!
  ```
- **Empirical Execution of `scripts/test_viewer_preferences.ts`**:
  ```
  Updated obj 1 definition:

  <<
  /Type /Catalog
  /Pages 2 0 R
  /ViewerPreferences << /FitWindow true
  /AcroForm 8 0 R
  >>
  ```
  Note: `/ViewerPreferences` opened with `<<` but lacks closing `>>`. `/AcroForm 8 0 R` is swallowed into `/ViewerPreferences`.

### 1.2 Direct Observations on Defect 2: Missing `/Resources` on Pass 1 Image XObjects
- **Location**: `server/services/pnpkiSigningService.ts`, lines 1748–1755:
  ```typescript
  1748:         const embedded = isPng ? await pdfDoc.embedPng(imgBuf) : await pdfDoc.embedJpg(imgBuf);
  1749:         page.drawImage(embedded, {
  1750:           x: minX + 2,
  1751:           y: minY + 1.5,
  1752:           width: 30,
  1753:           height: Math.max(10, rh - 3),
  1754:         });
  ```
- **Verbatim Error in Adversarial Probe G1**:
  ```
  [✗ FAIL] [G1] Dual-copy CS Form 48 two-pass signing satisfies 100% Adobe Acrobat ISO 32000 structural requirements -> termCount=2, zeroKids=true, formResOk=true, imgResOk=false, brOk=true, reloadOk=true
  ```
- **Empirical Execution of `scripts/debug_image_xobjects.ts`**:
  Pass 1 Image 3 (`obj 19`, SMask) and main image (`obj 18`/`obj 23`):
  ```pdf
  19 0 obj
  <<
  /Type /XObject
  /Subtype /Image
  /Height 16
  /Width 16
  /BitsPerComponent 8
  /ColorSpace /DeviceGray
  /Decode [ 0 1 ]
  /Filter /FlateDecode
  /Length 125
  >>
  ```
  Notice: Pass 1 Image XObjects lack `/Resources << >>`, whereas Incremental update mode (Pass 2, `obj 23`) explicitly emits `/Resources << >>`.

---

## 2. Logic Chain

### 2.1 Logic Chain for Defect 1: Safe Document Catalog Extraction
1. **Extraction Mechanism**:
   - Lines 1442–1445 locate `firstDictOpen` (the first `<<` of the outermost Catalog dictionary) and `lastDictClose` (the last `>>` of the outermost Catalog dictionary).
   - Line 1445 computes `cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim()`.
   - By definition of `slice(firstDictOpen + 2, lastDictClose)`:
     - The outermost `<<` is stripped.
     - The outermost `>>` is stripped.
     - The returned substring contains *only* the inner key-value pairs of the Document Catalog.
2. **Why Line 1449 was present**:
   - In earlier legacy iterations, catalog sanitization used `replace(/^\s*<<\s*/, "").replace(/\s*>>\s*$/, "")` (identical to line 1425 for `cleanedPageBody`).
   - When outer boundary slicing (`indexOf("<<")` and `lastIndexOf(">>")`) was added, line 1449 was left behind under the mistaken assumption that a "dangling >>" might still exist.
3. **The Root Cause of Truncation**:
   - Because `lastDictClose` was the *very last* `>>` in the object body, there are zero characters equal to `>>` after `lastDictClose`.
   - Any `>>` that remains inside `cleanedCatalogBody` after line 1445 is strictly *prior* to `lastDictClose`, which means it is an essential delimiter belonging to an internal nested dictionary (e.g., `/ViewerPreferences << ... >>` or `/Perms << ... >>`).
   - If that nested dictionary is the final entry in the Catalog, its closing `>>` sits at the very end of `cleanedCatalogBody`.
   - Line 1449 `replace(/>>\s*$/, "")` unconditionally matches that closing delimiter and deletes it.
   - When line 1476 wraps `cleanedCatalogBody` in `<<\n${cleanedCatalogBody}\n/AcroForm ${acroFormObjNum} 0 R\n>>`, the unclosed nested dictionary swallows `/AcroForm` and consumes the Catalog's closing delimiter. Adobe Acrobat attempts to parse `/Root` and triggers `"Expected a dict object"`.
4. **The Safe Resolution**:
   - If bracket counts (`(match(/<</g) || []).length` vs `(match(/>>/g) || []).length`) are equal, every `>>` corresponds to an inner `<<`. Stripping is forbidden.
   - Only if `closeCount > openCount` (a true surplus closing bracket) should `replace(/>>\s*$/, "")` ever execute.
   ```typescript
   // Only strip trailing >> if dictionary brackets are genuinely unbalanced (extra closing >>)
   const openCount = (cleanedCatalogBody.match(/<</g) || []).length;
   const closeCount = (cleanedCatalogBody.match(/>>/g) || []).length;
   if (closeCount > openCount) {
     cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
   }
   ```

### 2.2 Logic Chain for Defect 2: First-Signature Mode Image XObject Resources
1. **Embedding Mechanism in `pdf-lib`**:
   - In First-Signature Mode (`signPdfBuffer`), `pdfDoc.embedPng(imgBuf)` creates an instance of `PDFImage`.
   - `pdf-lib` defers the generation and registration of the actual `PDFRawStream` objects in `pdfDoc.context` until `embedded.embed()` or `pdfDoc.save()` is invoked.
   - When `embedded.embed()` runs, it registers:
     - The main Image XObject (`embedded.ref`), a `PDFRawStream` with `/Type /XObject /Subtype /Image`.
     - If the PNG has an alpha channel, the soft mask Image XObject referenced by `/SMask` in the main image dictionary.
   - `pdf-lib`'s `PngEmbedder` and `JpegEmbedder` adhere to standard minimal ISO 32000 Table 89 dictionaries and do not populate `/Resources << >>`.
2. **The Compliance Divergence**:
   - `PROJECT.md` Feature 2 and ISO 32000 Adobe Acrobat compliance require that Form XObjects and Image XObjects contain valid `/Resources << >>` dictionaries.
   - Incremental Mode (`appendSignatureIncremental`) adheres to this at lines 1251 and 1258. However, First-Signature Mode (`signPdfBuffer`) does not inject `/Resources << >>`.
   - In a dual-copy CS Form 48 two-pass signing flow (Probe G1), Pass 1 signs with an image in first-signature mode. When the challenger audits Image XObjects in the signed PDF, Pass 1 Image XObjects lack `/Resources`, causing `imgResOk=false` and failing Probe G1.
3. **The Clean Resolution**:
   - Immediately after embedding:
     ```typescript
     const embedded = isPng ? await pdfDoc.embedPng(imgBuf) : await pdfDoc.embedJpg(imgBuf);
     await embedded.embed();

     const rawImg: any = pdfDoc.context.lookup(embedded.ref);
     if (rawImg && rawImg.dict) {
       if (!rawImg.dict.has(PDFName.of("Resources"))) {
         rawImg.dict.set(PDFName.of("Resources"), pdfDoc.context.obj({}));
       }
       const smaskRef = rawImg.dict.get(PDFName.of("SMask"));
       if (smaskRef) {
         const smaskObj: any = pdfDoc.context.lookup(smaskRef);
         if (smaskObj && smaskObj.dict && !smaskObj.dict.has(PDFName.of("Resources"))) {
           smaskObj.dict.set(PDFName.of("Resources"), pdfDoc.context.obj({}));
         }
       }
     }
     ```
   - Before `pdfDoc.save({ useObjectStreams: false })` (line 1896):
     Add a comprehensive sweep across all indirect objects in `pdfDoc.context` to guarantee 100% of Image XObjects in Pass 1 have `/Resources << >>`:
     ```typescript
     for (const [ref, obj] of pdfDoc.context.enumerateIndirectObjects()) {
       if (obj && (obj as any).dict) {
         const dict = (obj as any).dict;
         const subtype = dict.get(PDFName.of("Subtype"));
         if (
           (subtype === PDFName.of("Image") || subtype?.toString() === "/Image") &&
           !dict.has(PDFName.of("Resources"))
         ) {
           dict.set(PDFName.of("Resources"), pdfDoc.context.obj({}));
         }
       }
     }
     ```

---

## 3. Caveats

1. **No Scope Creep**: The single terminal widget architecture (`/FT /Sig`, `/Subtype /Widget`, zero `/Kids`, secondary copy as `/Subtype /Stamp`), `/DR` indirect reference handling (`/DR 99 0 R`), and revision chaining are fully functional and passed 28/30 probes in Iteration 1. No alterations should be made to those proven systems.
2. **Read-Only Explorer Discipline**: As a teamwork explorer, no production files in `dict-monitoring`, `dict-dtr-generator`, or `d-monitoring` have been modified. All proposed changes are documented via unified diff in `pnpki_iteration2.patch` for implementation by the builder.

---

## 4. Conclusion

Both defects identified by `challenger_acrobat_1` have clear, deterministic root causes and minimal, non-regressing fixes:

1. **Defect 1**: Replace unconditional line 1449 `replace(/>>\s*$/, "")` with a bracket balance check `if (closeCount > openCount)`. This completely prevents truncation of nested dictionaries at the end of the Document Catalog (`/ViewerPreferences`, `/Perms`, `/MarkInfo`), ensuring Adobe Acrobat parses `/Root` without "Expected a dict object" errors.
2. **Defect 2**: In `signPdfBuffer`, call `await embedded.embed()`, inject `Resources: {}` into `embedded.ref` and any referenced `/SMask`, and sweep `pdfDoc.context.enumerateIndirectObjects()` before `pdfDoc.save()`. This ensures 100% of Image XObjects in Pass 1 contain `/Resources << >>`.

A complete unified patch has been prepared at:
`c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_1\pnpki_iteration2.patch`

---

## 5. Verification Method

### 5.1 Standalone Test Scripts
Run the comprehensive verification test suite:
```bash
npx tsx .agents/teamwork/explorer_it2_1/test_proposed_signing_service.ts
```
Expected output:
- `Bracket balance (<<=2, >>=2): PASS`
- `ViewerPreferences closed properly: PASS`
- `AcroForm placed at root level: PASS`
- `100% of Image XObjects have /Resources: PASS`
- `ALL TESTS PASSED WITH 100% COMPLIANCE!`

### 5.2 Verification with Target Test Scripts
After the builder applies `pnpki_iteration2.patch`:
1. Run `test_viewer_preferences.ts`:
   ```bash
   npx tsx scripts/test_viewer_preferences.ts
   ```
   *Expected Output*: `/ViewerPreferences << /FitWindow true >>` is closed, followed cleanly by `/AcroForm 8 0 R`.
2. Run `adversarial_pnpki_stress_harness.ts`:
   ```bash
   npx tsx scripts/adversarial_pnpki_stress_harness.ts
   ```
   *Expected Result*: 30/30 probes pass (100% pass rate). Exit code: 0.

### 5.3 Invalidation Conditions
- If any probe in Category A (Catalog Nesting) fails or reports unbalanced brackets.
- If any Image XObject in Pass 1 or Pass 2 lacks `/Resources << >>`.
- If Adobe Acrobat reports "Expected a dict object" upon opening any signed document.
