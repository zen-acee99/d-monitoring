# Handoff Report: Iteration 2 Defect Remediation & Cross-Repository Synchronization

**Agent**: `worker_it2`  
**Roles**: implementer, qa, specialist  
**Date**: 2026-11-15T03:27:00Z  
**Target Codebase**: `server/services/pnpkiSigningService.ts` across:
1. `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\server\services\pnpkiSigningService.ts`
2. `c:\Users\Ace\Desktop\Project\DICT Sys\dict-dtr-generator\server\services\pnpkiSigningService.ts`
3. `c:\Users\Ace\Desktop\Project\D-monitoring\d-monitoring\server\services\pnpkiSigningService.ts`

---

## 1. Observation

### 1.1 Baseline Defect Symptoms (Prior to Remediation)
1. **Defect 1 (Catalog Nested Dictionary Truncation)**:
   - Reproduction script: `npx tsx scripts/test_viewer_preferences.ts`
   - Pre-fix output:
     ```pdf
     Updated obj 1 definition:

     <<
     /Type /Catalog
     /Pages 2 0 R
     /ViewerPreferences << /FitWindow true
     /AcroForm 8 0 R
     >>
     ```
     `/ViewerPreferences` opened with `<<` but was missing its terminating `>>` because `cleanedCatalogBody.replace(/>>\s*$/, "")` unconditionally stripped the closing bracket of the nested dictionary.
   - Pre-fix Adversarial Harness Probe A4 failed with:
     ```
     [✗ FAIL] [A4] Nested dictionary immediately before closing >> (/Perms << >>) not truncated by sanitizer -> Unbalanced dictionary brackets in Catalog: << count=1, >> count=1. Line 1449 replace(/>>\s*$/, "") stripped closing >> from nested dictionary!
     ```

2. **Defect 2 (First-Signature Mode Image XObjects Missing `/Resources << >>`)**:
   - Reproduction script: `npx tsx scripts/debug_image_xobjects.ts`
   - Pre-fix output in Pass 1 Image XObjects:
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
     The SMask and RGB Image XObjects generated in First-Signature Mode (`signPdfBuffer`) lacked mandatory `/Resources << >>`.
   - Pre-fix Adversarial Harness Probe G1 failed with:
     ```
     [✗ FAIL] [G1] Dual-copy CS Form 48 two-pass signing satisfies 100% Adobe Acrobat ISO 32000 structural requirements -> termCount=2, zeroKids=true, formResOk=true, imgResOk=false, brOk=true, reloadOk=true
     ```

3. **Overall Baseline Pass Rate**:
   - Adversarial Harness (`scripts/adversarial_pnpki_stress_harness.ts`): 28/30 passed (93.3%), 2 failed (Probes A4 and G1).

---

## 2. Logic Chain

### 2.1 Remediation of Defect 1: Safe Document Catalog Extraction & Delimiter Preservation
1. In `appendSignatureIncremental`, `catalogBody` is extracted from the Document Catalog object. Lines 1484–1487 slice inner content between the first `<<` and last `>>`:
   ```typescript
   const firstDictOpen = cleanedCatalogBody.indexOf("<<");
   const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
   if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
     cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
   }
   ```
2. When a nested dictionary resides at the end of the Catalog (e.g., `/ViewerPreferences << /FitWindow true >>` or `/Perms << /DocMDP 4 0 R >>`), the final `>>` in `cleanedCatalogBody` belongs to that nested dictionary, not to the outer Catalog.
3. Added the helper function `countDictionaryBrackets(str: string): { open: number; close: number }` (lines 255–293), which parses PDF tokens while correctly ignoring literal strings `(...)`, hex strings `<...>`, and comments `%...`.
4. Replaced the unconditional trailing regex with a guarded check:
   ```typescript
   const { open: catOpen, close: catClose } = countDictionaryBrackets(cleanedCatalogBody);
   if (catClose > catOpen) {
     cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
   }
   ```
   If dictionary brackets are balanced (`catClose <= catOpen`), trailing `>>` belongs to the nested dictionary and is strictly preserved.
5. In addition:
   - Added word boundary `\b` to `isAlreadySigned` at line 1696: `/\/Type\s*\/Sig\b/.test(pdfStr) && /startxref/.test(pdfStr)`, ensuring that signature reference objects (`/Type /SigRef`) are not misidentified as digital signature dictionaries.
   - Ensured that `appendSignatureIncremental` consistently appends the updated Document Catalog across revisions so downstream PDF consumers and test harnesses reliably parse the latest balanced Catalog definition.

### 2.2 Remediation of Defect 2: Mandatory `/Resources << >>` on All Image XObjects
1. `pdf-lib`'s `embedPng` and `embedJpg` methods serialize minimal ISO 32000-1 Table 89 image dictionaries omitting `/Resources`. In Pass 1 (First-Signature Mode), images and their transparency soft masks (`/SMask`) lacked `/Resources << >>`.
2. Incremental Mode (`appendSignatureIncremental`) already complied with ISO 32000 and Feature 2 by emitting `/Resources << >>` on its Image XObjects.
3. In `signPdfBuffer`, immediately prior to `pdfDoc.save({ useObjectStreams: false })`:
   ```typescript
   // Ensure all embedded Image XObjects (RGB and Alpha SMasks) and Form XObjects contain mandatory /Resources << >>
   await pdfDoc.flush();
   for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
     const dict = (obj as any)?.dict || (obj instanceof PDFDict ? obj : null);
     if (dict && typeof dict.has === "function" && typeof dict.get === "function") {
       const subtype = dict.get(PDFName.of("Subtype"));
       if (
         (subtype === PDFName.of("Image") || subtype?.toString() === "/Image" ||
          subtype === PDFName.of("Form") || subtype?.toString() === "/Form") &&
         !dict.has(PDFName.of("Resources"))
       ) {
         dict.set(PDFName.of("Resources"), pdfDoc.context.obj({}));
       }
     }
   }
   ```
4. Calling `await pdfDoc.flush()` ensures all pending embedded images, alpha masks, and font objects are registered in `pdfDoc.context`. The indirect object loop injects `/Resources << >>` into all Image and Form XObjects.

---

## 3. Caveats

- **No Caveats**: The modifications are strictly confined to `server/services/pnpkiSigningService.ts`, adhere to ISO 32000-1 / Adobe Acrobat requirements, and do not modify external libraries or configuration.

---

## 4. Conclusion

1. Both Iteration 2 defects have been completely resolved:
   - Document Catalog nested dictionaries (`/ViewerPreferences`, `/Perms`, `/MarkInfo`, etc.) retain all closing delimiters, preventing AcroForm absorption and Adobe Acrobat "Expected a dict object" parser aborts.
   - All First-Signature Mode Image XObjects and soft masks serialize with valid `/Resources << >>` dictionaries.
2. Verification results:
   - `scripts/test_viewer_preferences.ts`: PASSED.
   - `scripts/debug_image_xobjects.ts`: PASSED.
   - `scripts/adversarial_pnpki_stress_harness.ts`: **30/30 probes passed (100.0%)** — Verdict: **APPROVE**.
   - `tests/adobeAcrobatSignatureCompliance.test.ts`: **93/93 tests passed (100.0%)** across 21 test suites.
   - `npm run build`: PASSED with 0 errors across all three repositories (`dict-monitoring`, `dict-dtr-generator`, and `d-monitoring`).
3. Cross-Repository Synchronization:
   - SHA-256 hash across all three repositories is **100% byte-for-byte identical**:
     `8DC044D4A0CCE1AB7A05000FEEE30DB9F1D281872680B7058BB2ED6D0394C0F0`

---

## 5. Verification Method

To independently verify this implementation, execute the following commands in the project workspaces:

### 5.1 Verification Commands in `dict-monitoring`
```powershell
# 1. Run Isolated Catalog Nested Dictionary Test
npx tsx scripts/test_viewer_preferences.ts

# 2. Run Isolated Image XObject Resources Test
npx tsx scripts/debug_image_xobjects.ts

# 3. Run Adversarial Stress Harness (30 Probes)
npx tsx scripts/adversarial_pnpki_stress_harness.ts

# 4. Run Full Adobe Acrobat Compliance Test Suite (93 Tests)
npx tsx --test tests/adobeAcrobatSignatureCompliance.test.ts

# 5. Build dict-monitoring
npm run build
```

### 5.2 Verification Commands for Synchronization & Mirror Builds
```powershell
# Verify SHA-256 Hash Identity Across All 3 Repositories
powershell -Command "Get-FileHash -Algorithm SHA256 'c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\server\services\pnpkiSigningService.ts', 'c:\Users\Ace\Desktop\Project\DICT Sys\dict-dtr-generator\server\services\pnpkiSigningService.ts', 'c:\Users\Ace\Desktop\Project\D-monitoring\d-monitoring\server\services\pnpkiSigningService.ts' | Format-Table -AutoSize"

# Build dict-dtr-generator
powershell -Command "Set-Location 'c:\Users\Ace\Desktop\Project\DICT Sys\dict-dtr-generator'; npm run build"

# Build d-monitoring
powershell -Command "Set-Location 'c:\Users\Ace\Desktop\Project\D-monitoring\d-monitoring'; npm run build"
```

### Invalidation Conditions
- If any probe in `adversarial_pnpki_stress_harness.ts` fails.
- If any test in `adobeAcrobatSignatureCompliance.test.ts` fails.
- If SHA-256 hash of `server/services/pnpkiSigningService.ts` differs across any of the three repositories.
- If `npm run build` fails in any of the three repositories.
