# Adversarial Stress Testing Handoff Report

**Agent**: `challenger_acrobat_1` (teamwork_challenger)  
**Roles**: critic, specialist  
**Working Directory**: `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\challenger_acrobat_1\`  
**Target File Under Test**: `server/services/pnpkiSigningService.ts`  
**Date**: 2026-11-15T02:49:00Z  
**Verdict**: **REJECT** (2 Critical Structural Vulnerabilities Found, 28/30 Probes Passed, 93.3% Pass Rate)

---

## 1. Observation

### 1.1 Test Suite Execution
- **Harness Command**:
  ```bash
  npx tsx scripts/adversarial_pnpki_stress_harness.ts
  ```
- **Harness Artifact**: `scripts/adversarial_pnpki_stress_harness.ts`
- **Machine-Readable Report**: `scratch/adversarial_probe_report.json`
- **Execution Summary**:
  - Total Adversarial Stress Probes Executed: **30**
  - Passed: **28** (93.3%)
  - Failed: **2** (6.7%)

### 1.2 Verbatim Probe Results by Category

| ID | Category | Description | Status | Diagnostics / Verbatim Error |
|---|---|---|---|---|
| **A1** | Catalog Nesting | Catalog with `/MarkInfo << /Marked true >>` survives incremental update | **PASS** | Intact |
| **A2** | Catalog Nesting | 3-level deeply nested dictionary preserves inner keys | **PASS** | DeepKey preserved |
| **A3** | Catalog Nesting | Sibling nested dictionaries (`/MarkInfo` & `/ViewerPreferences`) both preserved | **PASS** | Both retained |
| **A4** | Catalog Nesting | Nested dictionary immediately before closing `>>` (`/Perms << >>`) not truncated by sanitizer | **FAIL** | `Unbalanced dictionary brackets in Catalog: << count=1, >> count=1. Line 1449 replace(/>>\s*$/, "") stripped closing >> from nested dictionary!` |
| **A5** | Catalog Nesting | String with embedded `>>` delimiter in document info does not trick regex | **PASS** | Title preserved |
| **A6** | Catalog Nesting | Catalog with comments and trailing whitespace before `>>` parses cleanly | **PASS** | Parsed cleanly |
| **B1** | Sequential Multi-Pass | All 4 sequential passes sign cleanly without unhandled exception | **PASS** | Monotonically growing revisions |
| **B2** | Sequential Multi-Pass | Pass 4 document contains 4 distinct incremental revision boundaries (`%%EOF`) | **PASS** | Exactly 4 `%%EOF` markers |
| **B3** | Sequential Multi-Pass | `/Prev` pointer in revisions 2, 3, 4 links precisely to previous `startxref` offsets | **PASS** | Strict xref chain linkage |
| **B4** | Sequential Multi-Pass | All 4 revisions maintain valid `/ByteRange` enclosing cryptographic contents | **PASS** | Offsets & lengths cover exact bytes |
| **B5** | Sequential Multi-Pass | 4 distinct terminal `/FT /Sig` widgets created with unique `/T` names and no `/Kids` | **PASS** | 4 distinct terminal widgets |
| **B6** | Sequential Multi-Pass | AcroForm `/Fields` array preserves all 4 terminal widget references across passes | **PASS** | 4 refs accumulated |
| **B7** | Sequential Multi-Pass | AcroForm `/SigFlags` is 3 (`SIGNATURES_EXIST \| APPEND_ONLY`) in Pass 4 | **PASS** | `/SigFlags 3` verified |
| **C1** | Dual-Copy CS Form 48 | Dual signature rects (Copy 1 + Copy 2) produce exactly 1 terminal `/FT /Sig` with 0 `/Kids` | **PASS** | Exactly 1 field, zero `/Kids` |
| **C2** | Dual-Copy CS Form 48 | Identical duplicate rects deduplicated cleanly to 1 terminal widget | **PASS** | Deduplicated to 1 |
| **C3** | Dual-Copy CS Form 48 | Degenerate zero-dimension rect normalizes to min bounds (w >= 125, h >= 26) | **PASS** | Auto-expanded |
| **C4** | Dual-Copy CS Form 48 | Inverted coordinates `[max, max, min, min]` properly re-ordered to `[llx, lly, urx, ury]` | **PASS** | Strict non-negative order |
| **C5** | Dual-Copy CS Form 48 | Empty `sigRects []` falls back to standard default rect without error | **PASS** | Default rect used |
| **C6** | Dual-Copy CS Form 48 | Quad-copy rects (4 boxes) produces exactly 1 terminal `/FT /Sig` and 0 `/Kids` | **PASS** | Single terminal `/FT /Sig` |
| **D1** | Form XObjects | First-signature appearance Form XObject (`/AP /N`) contains valid `/Resources << >>` | **PASS** | Balanced `/Resources` |
| **D2** | Form XObjects | Incremental update Form XObjects (Pass 1 & Pass 2) 100% contain valid `/Resources << >>` | **PASS** | Balanced `/Resources` |
| **D3** | Form XObjects | Form XObject with `skipVisualText: true` retains `/Resources << >>` | **PASS** | Balanced `/Resources` |
| **D4** | Form XObjects | Appearance Form XObjects define strictly positive bounding box `/BBox [llx lly urx ury]` | **PASS** | Valid `BBox` |
| **E1** | Image XObjects | Transparent PNG in incremental update generates both RGB and SMask Image XObjects with `/Resources << >>` | **PASS** | Both have `/Resources << >>` |
| **E2** | Image XObjects | 1x1 minimal PNG embeds cleanly with `/Resources << >>` | **PASS** | Balanced `/Resources` |
| **E3** | Image XObjects | Incremental update without image omits Image XObjects cleanly with zero broken references | **PASS** | Zero dangling `/SigImg` |
| **F1** | AcroForm `/DR` | AcroForm indirect `/DR` reference (`/DR 99 0 R`) preserved in incremental update without corruption | **PASS** | `/DR 99 0 R` preserved |
| **F2** | AcroForm `/DR` | AcroForm existing `/DA` string (`/Courier 12 Tf 0 g`) preserved alongside indirect `/DR` | **PASS** | `/DA` preserved |
| **F3** | AcroForm `/DR` | Existing non-signature form fields (`98 0 R`) preserved in AcroForm `/Fields` | **PASS** | Non-sig field retained |
| **G1** | Real-World CS Form 48 | Dual-copy CS Form 48 two-pass signing satisfies 100% Adobe Acrobat ISO 32000 structural requirements | **FAIL** | `termCount=2, zeroKids=true, formResOk=true, imgResOk=false, brOk=true, reloadOk=true` |

---

## 2. Logic Chain

### 2.1 Failure Mode 1: Catalog Trailing Nested Dictionary `>>` Truncation (Probe A4)
1. **Target Location**: `server/services/pnpkiSigningService.ts`, lines 1441–1449.
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
2. **Mechanism**:
   - Lines 1442–1445 slice off the outer `<<` and the outer `>>` from the Catalog body.
   - At line 1445, `cleanedCatalogBody` contains only the interior key-value pairs of the Document Catalog.
   - If the Document Catalog contains a trailing nested dictionary (e.g. `/ViewerPreferences << /FitWindow true >>` or `/Perms << /DocMDP 4 0 R >>`), the final characters of `cleanedCatalogBody` are the closing `>>` of that nested dictionary.
   - At line 1449, `cleanedCatalogBody.replace(/>>\s*$/, "")` unconditionally matches the end of the string and **strips the nested dictionary's closing `>>`**.
3. **Resulting Emitted Object**:
   - Line 1476 emits:
     ```pdf
     1 0 obj
     <<
     /Type /Catalog
     /Pages 2 0 R
     /ViewerPreferences << /FitWindow true
     /AcroForm 8 0 R
     >>
     endobj
     ```
   - Notice: `/ViewerPreferences` has an opening `<<` but NO closing `>>`.
   - `/AcroForm 8 0 R` is swallowed into `/ViewerPreferences`.
   - The Document Catalog dictionary itself is unbalanced and missing its closing `>>`.
4. **Impact on Adobe Acrobat**:
   - When Adobe Acrobat parses `/Root` to inspect the document structure, the catalog dictionary syntax error triggers:  
     `"Error during signature verification. Adobe Acrobat error. Expected a dict object."`
   - In `pdf-lib`, this causes:
     `Invalid object ref: 1 0 R`
     `p2Doc.catalog: object PDFInvalidObject`
   - Verified empirically via `scripts/test_viewer_preferences.ts`.

---

### 2.2 Failure Mode 2: First-Signature Mode Image XObjects Lack `/Resources << >>` (Probe G1)
1. **Target Location**: `server/services/pnpkiSigningService.ts`, lines 1748–1755.
   ```typescript
   1748:         const embedded = isPng ? await pdfDoc.embedPng(imgBuf) : await pdfDoc.embedJpg(imgBuf);
   1749:         page.drawImage(embedded, {
   1750:           x: minX + 2,
   1751:           y: minY + 1.5,
   1752:           width: 30,
   1753:           height: Math.max(10, rh - 3),
   1754:         });
   ```
2. **Mechanism**:
   - In `appendSignatureIncremental` (Incremental Mode), lines 1251 and 1258 explicitly inject `/Resources << >>` into both `imgObjNum` and `smaskObjNum` Image XObjects:
     ```pdf
     <<
     /Type /XObject
     /Subtype /Image
     /Width 16
     /Height 16
     /ColorSpace /DeviceRGB
     /BitsPerComponent 8
     /Resources << >>
     ...
     >>
     ```
   - In `signPdfBuffer` (First-Signature Mode), when `options.signatureImage` is passed, it calls `pdfDoc.embedPng(imgBuf)`.
   - `pdf-lib` creates the Image XObject and SMask XObject per ISO 32000 Table 89, which does **NOT** include `/Resources << >>`.
3. **Specification & Compliance Divergence**:
   - Feature 2 of `PROJECT.md` specifies that Image XObjects must contain `/Resources << >>`. While incremental update mode (`appendSignatureIncremental`) adheres to this, first-signature mode (`signPdfBuffer`) does not inject `/Resources << >>` into its image objects.
   - When an empirical oracle audits 100% of Image XObjects across a multi-pass signed document where Pass 1 contains an image, Pass 1 Image XObjects fail the `/Resources << >>` requirement.

---

## 3. Caveats

1. **Robustness of Unaffected Components**:
   - The terminal widget architecture (`/FT /Sig` with `/Subtype /Widget`, zero `/Kids`, proper binding to primary box) is 100% sound and passed all 6 dual-copy adversarial probes (C1–C6).
   - AcroForm `/DR` handling correctly preserves indirect references (`/DR 99 0 R`), default appearance strings (`/DA`), and existing non-signature form fields (F1–F3 passed).
   - Multi-pass sequential revision chaining (Revisions 1 to 4) preserves `/Prev` cross-reference pointers, trailers, distinct `/T` field names, and strict `/ByteRange` offsets (B1–B7 passed).
   - Form XObjects (`/AP /N`) in both first-signature and incremental modes 100% contain valid `/Resources << >>` (D1–D4 passed).
2. **Scope of Rejection**:
   - This rejection is scoped strictly to the two specific defect areas identified above. It does not mean the entire architecture is flawed; the single terminal widget design and `/DR` indirect reference handling are solid improvements.
   - Per the adversarial challenger mandate ("Review-only — do NOT modify implementation code"), no code modifications have been made by this agent.

---

## 4. Conclusion

**Verdict: REJECT.**

The implementation in `server/services/pnpkiSigningService.ts` fails empirical stress testing under two specific conditions:
1. **Critical Defect**: Line 1449 (`replace(/>>\s*$/, "")`) blindly strips the closing `>>` bracket of any nested dictionary positioned at the end of the Document Catalog (such as `/ViewerPreferences << /FitWindow true >>` or `/Perms << /DocMDP 4 0 R >>`), emitting a syntactically invalid catalog dictionary where `/AcroForm` is swallowed into the nested dictionary. This directly reproduces the Adobe Acrobat "Expected a dict object" failure.
2. **Defect**: In first-signature mode (`signPdfBuffer`), embedded signature images generated via `pdfDoc.embedPng` lack the mandatory `/Resources << >>` dictionary specified in Project Feature 2.

The implementation must resolve these two defects before receiving final approval.

---

## 5. Verification Method

To independently reproduce both failure modes and verify the probe results:

### Step 1: Run the Full 30-Probe Adversarial Test Suite
```bash
npx tsx scripts/adversarial_pnpki_stress_harness.ts
```
*Expected Result*: 28 probes pass, 2 probes fail (A4 and G1). Exit code: 1.

### Step 2: Reproduce Catalog Trailing Dictionary Truncation (Defect 1) in Isolation
```bash
npx tsx scripts/test_viewer_preferences.ts
```
*Expected Output*:
```
Updated obj 1 definition:

<<
/Type /Catalog
/Pages 2 0 R
/ViewerPreferences << /FitWindow true
/AcroForm 8 0 R
>>
```
*Verification Check*: Inspect the output above. Notice that `/ViewerPreferences << /FitWindow true` is missing its closing `>>`, and `/AcroForm` is swallowed inside `/ViewerPreferences`.

### Step 3: Reproduce Pass 1 Image XObject Missing `/Resources` (Defect 2) in Isolation
```bash
npx tsx scripts/debug_image_xobjects.ts
```
*Verification Check*: Inspect Image 3 (obj 19) in Pass 1. Notice it has `/Subtype /Image` but lacks `/Resources << >>`, whereas P2 Image 5 (obj 23) in Pass 2 has `/Resources << >>`.
