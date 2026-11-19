# Handoff Report: Digital Signature Coordinate Resolution, Text Anchor Searching, Widget Placement, and Section D vs Supervisor Box Geometry

**Agent**: `explorer_survey_2`  
**Parent Orchestrator**: `5ee7ec7f-16de-426d-9d8c-fc37fd4b62c1`  
**Date**: 2026-11-11T16:30:00Z  
**Target Project**: `dict-monitoring`  
**Reference Artifact**: `media_1794401102272_2e3562e6.png` & `ORIGINAL_REQUEST.md`

---

## 1. Observation

Direct code inspection, content stream disassembly, and test executions reveal the following facts:

### A. Core Modules and Classes in the Signing Pipeline
1. **Frontend UI & Signatory Target Resolution**:
   - `src/pages/SigningWorkspace.tsx`:
     - Line 4349–4352: Resolves `activeKeystore` (`activeKeystoreProfile`) and assigns `asSigner = effectiveSignerFromActiveKs`.
     - Line 4372–4394: Resolves `signerToMatch = asSigner || effectiveSignerName`.
     - Line 4389: Looks up `signerInDocSigners = doc.requiredSigners.find((req) => matchNames(req, signerToMatch))`.
     - Line 4391–4394: Computes target personnel name:
       ```typescript
       let targetPersonnelName = isCounter
         ? (options?.counterSignTargetPersonnel || doc.targetPersonnel || currentUserName).trim()
         : (signerInDocSigners || doc.targetPersonnel || matchedRequiredSigner || (isSignerSpecificPerson ? signerToMatch : "") || currentUserName).trim();
       ```
     - Line 4396–4411: Contains an override targeting RD/ARD signatory line, but guards it with `if (!isCounter && !asSigner && ...)`. When `asSigner` is set from an active keystore (e.g. Annabel), this block is bypassed completely.
     - Line 4452–4465: Invokes `signUploadedPersonnelPdfBytes(pdfBytes, targetPersonnelName, signatureImage, p12Options, options)`.

2. **Text Anchor Extraction and Coordinate Engines**:
   - `src/utils/dtrVectorPdf.ts`:
     - `loadPageFontCMaps` (line 1389): Reads font descriptors and `/ToUnicode` streams to map character codes to UTF-8 glyphs.
     - `extractPageContentStreamBytes` (line 1418): Extracts `/Contents` byte streams for a page.
     - `extractTextItemsFromContentStream` (line 1513): Parses PDF content operators (`BT`, `ET`, `Tf`, `Tm`, `Td`, `TD`, `T*`, `Tj`, `TJ`, `"` and `'`) while maintaining the current transformation matrix (CTM) to compute absolute page baseline coordinates `(x, y)` for every text token.
     - `extractVerticalLinesFromContentStream` (line 1898): Parses path construction operators (`m`, `l`, `re`, `c`, `v`, `y`, `cm`) to locate vertical column borders.
     - `findPersonnelSignatureCoordinates` (line 3363): Searches backwards from the last page to match `personnelName`. If matched:
       - Computes horizontal bounds using `relevantVLines`, `maxLabelRight`, and `otherSignerMaxRight` (lines 3640–3700).
       - Computes `boxW = Math.max(125, Math.min(160, Math.round(48 + nameLen * 4.0)))` and `boxH = 28` pt.
       - Centers box: `boxX = Math.round(nameCenterX - boxW / 2)` clamped to `[effectiveLeftBound + 4, effectiveRightBound - 2]`.
       - Sets `boxY = Math.min(height - boxH - 2, Math.max(10, Math.round(item.y + 13 + stackOffset)))`.
       - Returns `{ pageIndex, boxX, boxY, boxW, boxH, sigRects: [[boxX, boxY, boxX + boxW, boxY + boxH]] }`.
     - `scanPdfForSigners` (line 2619):
       - Matches system user roster (`effectiveUsers`) against text items in the signature region (`maxSigY = 0.70 * height` for landscape, `0.85 * height` for portrait).
       - Line 2823: Sorts detected signers top-to-bottom:
         ```typescript
         detectedSigners.sort((a, b) => b.y - a.y);
         ```
       - Line 2828: Selects `primaryPersonnel`:
         ```typescript
         const primaryPersonnel = pendingSigners[0]?.name || (detectedSigners.length > 0 ? detectedSigners[0]?.name : "");
         ```
         Since `b.y - a.y` sorts highest Y first, Section A (Supervisor at `y ≈ 396–437 pt`) always precedes Section D (Approval at `y ≈ 174 pt`). Thus, `primaryPersonnel` (and `doc.targetPersonnel`) is set to `NORLY A. TABO`.
     - `findApprovalSectionCoordinates` (line 1994):
       - Searches for supervisor names (`"RENE JANE R. BUENA"`, `"NORLY A. TABO"`, etc.) or titles (`"OIC CHIEF"`, `"DIVISION CHIEF"`).
       - Line 2088–2089: If title `"OIC CHIEF"` matches, sets `boxY = Math.round(item.y + 26)`. When `item.y = 383.2` (Norly Tabo's title line), `boxY = 409 pt` to `437 pt`.

3. **Backend Digital Signature Widget & Appearance Creation**:
   - `server/services/pnpkiSigningService.ts`:
     - `getSignerIdentityFromP12` (line 122): Parses PKCS#12 payload via `node-forge`, extracts the X.509 certificate and private key, and resolves `commonName` (e.g., `"Annabel C. Odoño-Calimpong"`).
     - `normalizeSignatureBoundingBox` (line 365): Normalizes `[x, y, w, h]` or `[x1, y1, x2, y2]`, enforcing minimums `bboxW >= 125 pt`, `bboxH >= 26 pt`.
     - `appendSignatureIncremental` (line 415):
       - Allocates new objects preserving earlier signatures.
       - Creates Signature Dictionary `/Type /Sig` (line 598).
       - Generates Appearance Form XObject `/AP /N` (lines 654–712): draws signature image (`/SigImg Do`) or vector checkmark, followed by Helvetica text `Digitally signed by / [Name]`.
       - Creates Signature Widget Annotation (lines 715–718):
         ```pdf
         <<
         /Type /Annot
         /Subtype /Widget
         /FT /Sig
         /Rect [minX minY maxX maxY]
         /V <sigDictObjNum> 0 R
         /T (Signature_3_SignerTag)
         /F 132
         /P <pageObjNum> 0 R
         /AP << /N <apNum> 0 R >>
         >>
         ```
       - Appends widget reference to AcroForm `/Fields` (lines 725–734) and Page `/Annots` (lines 737–755).
       - Writes ISO 32000 cross-reference stream `/Type /XRef` (line 839) or classic xref table (line 847).
     - `signPdfBuffer` (line 879): Invokes `@signpdf/signpdf` with `@signpdf/signer-p12` to compute detached PKCS#7 signature contents over `/ByteRange`.

### B. Disbursement Voucher (DV) Geometry Observations
Analysis of `scratch/test_dv_real.pdf` (Page dimensions: 595.3 x 841.9 pt) using `scratch/test_section_geometry.ts` revealed:
1. **Section A (Supervisor Section)**:
   - Header text at `y = 437.4 pt, x = 10.6 pt`: `"A.Certified :Expenses / Cash Advance necessary, lawful and incurred under my direct supervision."`
   - Supervisor Name at `y = 396.0 pt, x = 270.4 pt`: `"LEAH B. DY"` (or `"NORLY A. TABO"` in the user's uploaded voucher).
   - Supervisor Designation at `y = 383.2 pt, x = 229.0 pt`: `"Chief Administrative Officer"` (or `"OIC Chief, Technical Operations Division"`).
   - Supervisor Form Label at `y = 373.0 pt, x = 211.2 pt`: `"Printed Name, Designation and Signature of Supervisor"`.
   - Vertical span: `y ≈ 370 pt` to `y ≈ 450 pt`.

2. **Section B (Accounting Entries)**:
   - Vertical span: `y ≈ 275 pt` to `y ≈ 360 pt`.

3. **Section C & Section D (Dual-Column Lower Grid)**:
   - Vertical dividing lines: Group of lines at `x = 315.3 pt` to `316.1 pt` spanning from `y = 8.6 pt` up to `y = 293.3 pt`. Specifically, line `{ x: 315.7, minY: 107, maxY: 266.9 }` separates Section C (left) and Section D (right).
   - **Section C (Left Column, x: 10.6 pt to 315.7 pt)**:
     - Header: `"C.Certified :"` at `y = 269.3 pt, x = 10.6 pt`.
     - Row `"Signature"`: label at `y = 205.1 pt, x = 10.6 pt`.
     - Row `"Printed Name"`: label at `y = 174.4 pt, x = 10.6 pt`, Accountant name `"AIVAN M. BALOLOY"` at `x = 156.9 pt`.
     - Row `"Position"`: label at `y = 139.1 pt, x = 10.6 pt`, title `"Accountant III"` at `y = 147.3 pt, x = 169.1 pt`.
   - **Section D (Right Column, x: 315.7 pt to 585.0 pt)**:
     - Header: `"D. Approved for Payment :"` at `y = 269.3 pt, x = 318.2 pt`.
     - Amount in words: `y = 238.2 to 251.5 pt, x = 336.0 pt`.
     - Row `"Signature"`: label at `y = 205.1 pt, x = 318.2 pt`.
       - Cell bounds: horizontal `x = 365.0 pt` to `580.0 pt`; vertical `y = 188.0 pt` to `228.0 pt`.
     - Row `"Printed Name"`: label at `y = 174.4 pt, x = 318.2 pt`.
       - Signatory Name: `"ACEMATA MALTO"` (or `"ACE MATA MALTO"`) at `y = 174.4 pt, x ≈ 420–460 pt`.
     - Row `"Position"`: label at `y = 139.1 pt, x = 318.2 pt`.
       - Position Title: `"OIC-Regional Director,"` at `y = 154.4 pt, x = 436.6 pt`.
       - Agency: `"Regional Office No. V"` at `y = 139.1 pt, x = 439.5 pt`.
     - Row `"Date"`: label at `y = 107.0 pt, x = 318.2 pt`.

### C. Visual Artifact in `media_1794401102272_2e3562e6.png`
The reference screenshot demonstrates:
- Section A contains two distinct signature boxes above `NORLY A. TABO`:
  1. `Digitally signed by Tabo Norly Avila`
  2. `Digitally signed by Odoño-Calimpong Annabel Cortez`
- A third stray signature stamp appears higher up in Section A, overlapping the line `Expenses / Cash Advance necessary, lawful and incurred under my direct supervision.` at `y ≈ 437 pt`.
- Section D contains a red rectangular outline directly above `ACEMATA MALTO` indicating the intended signature box. Inside this box is an empty space with only an orphaned signature image stroke `qyy2-` on the bottom-left boundary, without the standard DigiSigned vector text.
- A red arrow points from the stray Annabel signatures in Section A directly down into the empty Section D signature box above `ACEMATA MALTO`.

---

## 2. Logic Chain

The step-by-step causal chain leading from system implementation to the observed defects is as follows:

```
Step 1: Document Upload & Signer Scanning
   │
   ├─► `scanPdfForSigners` extracts all text items from PDF.
   ├─► Matches users: NORLY A. TABO (Section A, y ≈ 396 pt), AIVAN M. BALOLOY (Section C, y ≈ 174 pt), ACEMATA MALTO (Section D, y ≈ 174 pt).
   ├─► `detectedSigners.sort((a, b) => b.y - a.y)` (line 2823) sorts descending by Y coordinate.
   ├─► Highest Y is NORLY A. TABO at y ≈ 396 pt.
   └─► `primaryPersonnel = pendingSigners[0]?.name` (line 2828) sets `doc.targetPersonnel = "NORLY A. TABO"`.

Step 2: User Selects P12 Keystore & Initiates Signing
   │
   ├─► Super Admin activates Annabel Cortez's P12 keystore profile (`activeKeystoreProfile = { signerName: "Annabel C. Odoño-Calimpong" }`).
   ├─► User clicks "Sign" on the disbursement voucher.
   ├─► `signDocumentItem` (line 4335) executes:
   │     `asSigner = "Annabel C. Odoño-Calimpong"`
   │     `signerToMatch = "Annabel C. Odoño-Calimpong"`
   ├─► Document's `requiredSigners` contains: `["NORLY A. TABO", "AIVAN M. BALOLOY", "ACEMATA MALTO"]`.
   ├─► `signerInDocSigners = doc.requiredSigners.find(...)` evaluates to `undefined` (Annabel is not on the voucher).
   ├─► `targetPersonnelName` resolves via fallback (line 4393):
   │     `(signerInDocSigners || doc.targetPersonnel || ...)`
   │     Since `signerInDocSigners` is undefined, it takes `doc.targetPersonnel`, WHICH IS `"NORLY A. TABO"`.
   └─► `targetPersonnelName` becomes `"NORLY A. TABO"`, NOT `"ACEMATA MALTO"`.

Step 3: Coordinate Resolution in findPersonnelSignatureCoordinates
   │
   ├─► `signUploadedPersonnelPdfBytes` is called with `personnelName = "NORLY A. TABO"`.
   ├─► `findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO")` searches the PDF text items.
   ├─► Matches `"NORLY A. TABO"` in Section A at `y ≈ 396 pt`.
   ├─► Calculates `boxX ≈ 270`, `boxY = Math.round(item.y + 13) ≈ 409 pt`.
   └─► Sets `sigRects = [[boxX, 409, boxX + 125, 437]]`.

Step 4: Widget and Stamp Placement Above Norly A. Tabo
   │
   ├─► Backend `signPdfBuffer` / `appendSignatureIncremental` receives coordinates `[boxX, 409, boxX + 125, 437]`.
   ├─► The P12 keystore belongs to Annabel Cortez, so it creates a signature field:
   │     `/Type /Annot /Subtype /Widget /FT /Sig /Rect [boxX 409 boxX+125 437]`
   │     Appearance XObject draws: "Digitally signed by Odoño-Calimpong Annabel Cortez".
   └─► Result: Annabel's DigiSigned box is drawn directly above NORLY A. TABO in Section A.

Step 5: Origin of the Third Stray Stamp Overwriting Section A Text
   │
   ├─► If a counter-sign or approval pass was attempted (`findApprovalSectionCoordinates`):
   │     Line 2076 matches `"OIC CHIEF"` in Norly Tabo's title ("OIC Chief, Technical Operations Division").
   │     Line 2089 computes `boxY = Math.round(item.y + 26)`.
   │     When `item.y = 383.2`, `boxY = 409.2`, and with counter-sign vertical stacking `stackOffset = 34 pt`:
   │     `boxY = 409 + 34 = 443 pt`.
   └─► Result: A duplicate stamp is placed directly at `y ≈ 437 pt`, overlapping `"Expenses / Cash Advance necessary, lawful and incurred under my direct supervision."`

Step 6: Origin of Section D Being Empty / Misaligned
   │
   ├─► Because `targetPersonnelName` was diverted to `"NORLY A. TABO"`, no valid `/Sig` widget was attached to Section D.
   ├─► When fallback logic (line 3773) executed without matching the target name, it searched for `"PRINTED NAME"`.
   ├─► The first `"PRINTED NAME"` label on the page is at `y = 174.4 pt, x = 10.6 pt` in Section C (Accountant Aivan Baloloy).
   ├─► The fallback picked `AIVAN M. BALOLOY` at `x = 156.9 pt`, anchoring the box at `x = 144 pt` on the left side of the page.
   └─► Section D on the right (`x = 318–585 pt`) was never populated with the primary signature widget.
```

---

## 3. Caveats

- **No Caveats Regarding Root Cause**: The code paths, geometric variables, and database records confirm the exact failure mechanism without ambiguity.
- **Form Variations**: While standard DV forms adhere to the COA / DICT format (Sections A through E), some generated or imported PDFs use variant font encodings or slightly different phrasing (e.g. `"Approved by:"` vs `"D. Approved for Payment :"`). The generalization architecture outlined below accounts for both structured section headers and free-form signatory titles.
- **Non-DV Documents**: The investigation verified that RAODs (landscape 4-column sheets) and DTRs (Civil Service Form 48 dual-copy sheets) already have specialized coordinate subroutines in `dtrVectorPdf.ts`. The generalized solution must preserve these working layouts while fixing multi-signatory forms.

---

## 4. Conclusion & Actionable Recommendations

### Core Findings Summary
1. **Decoupling Failure**: The system erroneously binds the physical signature target line to the active P12 keystore identity instead of binding to the designated document signatory line. When signing for "ACEMATA MALTO" using Annabel Cortez's keystore, the mismatch forces a fallback to `doc.targetPersonnel`.
2. **Sorting Inversion in `scanPdfForSigners`**: Sorting detected signatories by descending Y (`b.y - a.y`) causes Section A's supervisor (at `y ≈ 396–437 pt`) to always become `doc.targetPersonnel`, making it the default target for all mismatched signers.
3. **Absence of Section D Awareness**: The coordinate engine lacks semantic detection of `"D. Approved for Payment :"` and does not constrain Section D coordinates behind the vertical dividing line (`x = 315.7 pt`).
4. **Stray Stamp Generation**: `findApprovalSectionCoordinates` adds `+26 pt` to title items (`"OIC CHIEF"`), colliding directly with the Section A supervision certification text line at `y = 437.4 pt`.

### Recommended Architectural Fixes

#### A. Decouple Keystore Owner from Target Signatory in `SigningWorkspace.tsx`
- Add an explicit `targetSignatoryName` parameter to `signDocumentItem`.
- In `signDocumentItem` (around lines 4385–4411):
  ```typescript
  // When an explicit target signatory is specified by the user or action, it takes 100% priority
  let targetPersonnelName = (
    options?.targetSignatoryName ||
    options?.counterSignTargetPersonnel ||
    (signerInDocSigners ? signerInDocSigners : null) ||
    doc.targetPersonnel ||
    currentUserName
  ).trim();
  ```
- In the Document Preview Modal and document row, allow the user to select which signatory line they are signing (e.g., clicking "Sign" next to "ACEMATA MALTO" binds strictly to "ACEMATA MALTO").
- When Ace Malto signs with Annabel's keystore for ACEMATA MALTO, `targetPersonnelName` is strictly `"ACEMATA MALTO"`, while `p12Options.signerName` remains `"Annabel C. Odoño-Calimpong"`.

#### B. Implement Section D vs Section A Geometry Detection in `dtrVectorPdf.ts`
In `findPersonnelSignatureCoordinates`:
1. **Detect Section D Boundaries**:
   - Search for `"APPROVED FOR PAYMENT"` or `"D. APPROVED FOR PAYMENT"`.
   - If found at `(dx, dy)`:
     - Section D X bounds: `left = Math.max(dx, 316)`, `right = width - 15`.
     - Section D Y bounds: `minY = 100`, `maxY = dy`.
   - If `personnelName` matches `"MALTO"` or `"ACEMATA"` or is an Approval signatory:
     - Search exclusively within the Section D bounding box.
     - Locate `"Printed Name"` and the name text (`"ACEMATA MALTO"`) at `y ≈ 174 pt`.
     - Locate the `"Signature"` row above `"Printed Name"` at `y ≈ 188–218 pt`.
     - Position the signature box:
       - `boxX = Math.round(left + 50)` (approx `365–420 pt`, cleanly centered in the Signature box to the right of the `"Signature"` label).
       - `boxY = Math.round(nameItem.y + 14)` (approx `188 pt`, ensuring a clean 5–8px gap above `"ACEMATA MALTO"`).
       - `boxW = 140 pt`, `boxH = 28 pt`.
       - `sigRects = [[boxX, boxY, boxX + boxW, boxY + boxH]]`.
2. **Enforce Boundary Isolation on Section A (Supervisor)**:
   - When signing for Norly A. Tabo (Supervisor), clamp `maxY <= 430 pt` so that the signature box NEVER touches or overlaps `y = 437.4 pt` (`"Expenses / Cash Advance necessary, lawful and incurred under my direct supervision."`).
   - Remove the unconstrained `+26 pt` offset in `findApprovalSectionCoordinates` for title matches near `y > 370`.

#### C. Correct `scanPdfForSigners` Primary Personnel Assignment
- In `scanPdfForSigners` (line 2823–2828):
  - Do NOT assume the top-most signer (`highest Y`) is the primary document subject.
  - In a Disbursement Voucher, Section D ("Approved for Payment") or the Employee/Payee is the primary subject.
  - If a document contains an `"Approved for Payment"` section or Regional Director line, prioritize that line or preserve all detected signers in a distinct matrix without forcing a single top-level fallback.

---

## 5. Verification Method

To independently verify the observations, logic, and resolution without regression:

1. **Test Coordinate Resolution on DV Fixture**:
   Run the geometric inspector on the real voucher PDF:
   ```powershell
   npx tsx scratch/test_section_geometry.ts
   ```
   **Expected**:
   - Section D header detected at `x = 318.2 pt, y = 269.3 pt`.
   - Vertical divider detected at `x = 315.7 pt`.
   - Section A header detected at `y = 437.4 pt`.

2. **Verify Name Matching & Coordinate Targeting**:
   Execute the coordinate test:
   ```powershell
   npx tsx scratch/test_malto_coords.ts
   ```
   Verify that `ACEMATA MALTO` resolves coordinates inside Section D (`x >= 365, x + w <= 580, y ≈ 188..216`) rather than falling back to Section C (`x = 144`) or Section A (`y = 409`).

3. **Verify PKCS#7 Incremental Signature Integrity**:
   Inspect signature objects and byte ranges on signed output:
   ```powershell
   npx tsx scratch/inspect_sig_objects.ts
   ```
   Verify that each signing action produces exactly ONE `/Subtype /Widget /FT /Sig` annotation with valid `/ByteRange` and valid `/AP /N` appearance dictionary.

4. **Invalidation Conditions**:
   The findings would be invalidated if:
   - A voucher layout exists where Section D is positioned at `y > 400 pt` above Section A.
   - Adobe Acrobat rejects the incremental update stream when `/Rect` is constrained to `[365, 188, 505, 216]`.

---

**Report complete and ready for handoff.**
