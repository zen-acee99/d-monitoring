# Specification Survey Report: PDF Signing & Disbursement Voucher Layout

**Agent**: `spec_miner_survey_1`  
**Working Directory**: `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\spec_miner_survey_1\`  
**Date**: 2026-11-11  
**Milestone**: M1 Specification Mining & Survey  
**Parent Orchestrator ID**: `5ee7ec7f-16de-426d-9d8c-fc37fd4b62c1`

---

## Executive Summary & Answers to Mission Questions

### 1. Visual Layout of Reference Screenshot (`media_1794401102272_2e3562e6.png`)
The reference image depicts an official Philippine Government **Disbursement Voucher (DV)** (COA Circular 2015-07 / Government Accounting Manual Appendix 37) in standard A4 Portrait (`595 x 842 pt`), showing three major vertical sections:

1. **Supervisor Section (Section A - Upper Region, Y ≈ 370–450 pt)**:
   - **Certification statement**: `"A. Certified: Expenses / Cash Advance necessary, lawful and incurred under my direct supervision."` at baseline `y ≈ 437 pt`, `x ≈ 11 pt`.
   - **Supervisor Name**: `"NORLY A. TABO"` in bold uppercase at `x ≈ 260 pt`, `y ≈ 396 pt`.
   - **Designation**: `"OIC Chief, Technical Operations Division"` at `x ≈ 230 pt`, `y ≈ 383 pt`.
   - **Section footer label**: `"Printed Name, Designation and Signature of Supervisor"` at `x ≈ 211 pt`, `y ≈ 373 pt`.
   - **Prior Valid Signature**: Black pen stroke + text `"Digitally signed by Tabo Norly Avila"` at `x ≈ 260 pt`, `y ≈ 410 pt`.
   - **Observed Defect (Stray Stamps)**:
     - **Stray Stamp 1 (Top red box)**: At `y ≈ 443 pt`, overlapping the supervisory certification text (`"... lawful and incurred under my direct supervision"`), containing the blue DigiSigned signature and `"Digitally signed by Odoño-Calimpong Annabel Cortez"`.
     - **Stray Stamp 2 (Middle red box)**: To the right of Norly Tabo's signature at `x ≈ 463 pt`, `y ≈ 409 pt`, containing a second duplicate stamp `"Digitally signed by Odoño-Calimpong Annabel Cortez"`.
     - **Red Arrow**: Drawn by the user pointing from these two stray supervisor stamps down to Section D.

2. **Accounting Entry Table (Section B - Middle Region, Y ≈ 280–355 pt)**:
   - Header: `"B. Accounting Entry :"` with columns `Account Title`, `UACS Code`, `Debit`, `Credit`.
   - Contains rows for Franchise Tax, MDS Regular, and Total row (`P 1,200.46`).

3. **Section C (Accounting Certification - Bottom-Left Region, X ≈ 11–316 pt, Y ≈ 107–269 pt)**:
   - Header: `"C. Certified :"` with checkboxes for Cash Available, Debit Account, and Supporting Documents.
   - Column 1 labels: `"Signature"` (`y ≈ 205 pt`), `"Printed Name"` (`y ≈ 174 pt`), `"Position"` (`y ≈ 139 pt`).
   - Column 2 signatory: Prior valid signature (`"Baloloy Aivan Morcoso"` with seal), printed name `"AIVAN M. BALOLOY"` (`x ≈ 157 pt`, `y ≈ 174 pt`), title `"Accountant III"` (`x ≈ 169 pt`, `y ≈ 147 pt`).

4. **Section D ("Approved for Payment" - Bottom-Right Region, X ≈ 318–587 pt, Y ≈ 107–269 pt)**:
   - Header: `"D. Approved for Payment :"` at `x ≈ 318 pt`, `y ≈ 269 pt`.
   - Amount in words: `"One Thousand One Hundred Seventy Six Pesos and Forty Five Centavos Only"` centered across Section D at `y ≈ 245 pt`.
   - Two sub-columns divided by vertical divider at `x ≈ 390 pt`:
     - **Left Sub-Column (Labels, x ≈ 318–390 pt)**:
       - Row 1: `"Signature"` (`y ≈ 205 pt`).
       - Row 2: `"Printed Name"` (`y ≈ 174 pt`).
       - Row 3: `"Position"` (`y ≈ 139 pt`).
     - **Right Sub-Column (Signatory Block, x ≈ 390–587 pt)**:
       - **Row 1 (Designated Signature Box)**: Empty rectangular cell bounded by table gridlines `[x: 390 to 585 pt, y: 185 to 235 pt]`. **This is the exact intended location for the DigiSigned signature stamp.**
       - **Row 2**: `"ACEMATA MALTO"` at `x ≈ 430 pt`, `y ≈ 174 pt` (enclosed in red rectangle in the screenshot).
       - **Row 3**: `"OIC-Regional Director"` at `x ≈ 437 pt`, `y ≈ 154 pt`.

---

### 2. Inventory of Test Files, Disbursement Vouchers, and Test Suites

| Location | File Name | Size | Type / Description |
|---|---|---|---|
| `tests/` | `pnpkiSignaturePlacement.test.ts` | 42.8 KB (699 lines) | Automated placement test suite (15 test groups). Covers multi-column, dual-copy DTR, RAOD landscape, counter-sign stacking, and cryptographic signing. |
| `tests/` | `p12KeystoreSelection.test.ts` | 4.8 KB (120 lines) | Automated test suite for keystore selection preservation and mojibake name repair (`fixMojibake`). |
| `tests/` | `signingWorkspaceOrderAndDownload.test.ts` | 13.7 KB (277 lines) | Automated test suite for workspace document ordering, timestamp parsing, fallback PDF, and 5-min highlight. |
| `scratch/` | `test_dv_real.pdf` | 635.6 KB | Real vector Disbursement Voucher PDF (A4 Portrait, 595 x 842 pt, 81 text items) matching Section A, B, C, D structure. |
| `scratch/` | `test_dv_corrected.pdf` | 635.6 KB | Verified duplicate of `test_dv_real.pdf`. |
| `scratch/` | `signed_dv_perfect.pdf` | 635.6 KB | DV with sample signature overlays. |
| `scratch/` | `test_dv.pdf` | 432.5 KB | Landscape payroll/bonus voucher sheet (842 x 595 pt, 67 items). |
| `scratch/` | `rene_jane.p12` | 7.4 KB | Authentic PKCS#12 test keystore for Buena Rene Jane Rosendo (pw: `1234567890Aa!`). |
| `user_uploaded/` | `media_1794401102272_2e3562e6.png` | 96.6 KB | The primary reference screenshot depicting the stray signature defect on the DV. |
| `user_uploaded/` | `media_1794390299905_f288aa95.png` | 64.9 KB | Reference screenshot: Table with vertical column divider non-overlapping rule. |
| `user_uploaded/` | `media_1794380078101_c30e299d.png` | 125.5 KB | Reference screenshot: Side-by-side dual personnel (Aivan left vs Annabel right). |
| `user_uploaded/` | `media_1794374637435_fe4e4b01.png` | 29.6 KB | Reference screenshot: Multi-column form with table labels. |

---

### 3. Inventory of P12 Keystores & Test Certificates

All keystores were extracted directly from SQLite database table `dtr_generator` in `local.db` and verified using `node-forge`:

| Profile ID | User ID | Name / CN | P12 Source | Size | Decrypted Password | Certificate Subject DN & Details |
|---|---|---|---|---|---|---|
| `dtr-sig-usr-muxedv66` | `usr-muxedv66` | **Odoño-Calimpong Annabel Cortez** (Annabel) | `dtr_generator.p12` (base64) | 8,328 B | In db (`enc:...`) | `CN=OdoÃ±o-Calimpong Annabel Cortez, serialNumber=001AN06056dS, OU=Procurement Service, O=DICT, C=PH`. Validated with signature stroke image in db. |
| `dtr-sig-sup-01` | `usr-mu72vs2b` | **Buena Rene Jane Rosendo** (Rene Jane) | `dtr_generator.p12` & `scratch/rene_jane.p12` | 7,412 B | `1234567890Aa!` | `CN=Buena Rene Jane Rosendo, serialNumber=001AN0001523S, OU=GDTB-DTPMT, O=DICT, C=PH`. Government Signing CA - G2. |
| `dtr-sig-usr-mu74lftk` | `usr-mu74lftk` | **Malto Ace Mata** (Ace) | `dtr_generator.p12` (base64) | 8,255 B | In db (`enc:...`) | `CN=Malto Ace Mata, serialNumber=008AN06a3c1S, OU=Technical Operations Division, O=DICT V, C=PH`. |
| `dtr-sig-usr-mudrq46b` | `usr-mudrq46b` | **Dela Torre Ralph Bitome** | `dtr_generator.p12` (base64) | 8,298 B | In db (`enc:...`) | `CN=Dela Torre Ralph Bitome, serialNumber=008AN05c4b7S, OU=Technical Operations Division, O=DICT, C=PH`. |
| `dtr-sig-usr-mv4z99vf` | `usr-mv4z99vf` | **Cantorna Michael Verano** | `dtr_generator.p12` (base64) | 8,298 B | In db (`enc:...`) | `CN=Cantorna Michael Verano, serialNumber=008EN004b50S, OU=Technical Operations Division, O=DICT, C=PH`. |
| `dtr-sig-usr-mucat4r6` | `usr-mucat4r6` | John Stephen D. Moral | None (`has_p12: 0`) | 0 B | N/A | Signature image only, no cryptographic keystore. |

---

### 4. Requirements, Root Cause Analysis, and Edge Cases

#### Root Causes of the Misplaced / Stray Signature Defect:
1. **Target Signatory Resolution in `SigningWorkspace.tsx` (Lines 4385–4411)**:
   - When Annabel's keystore was activated by the user, `asSigner` was set to `"Odoño-Calimpong Annabel Cortez"`.
   - `signerInDocSigners = doc.requiredSigners.find(...)` failed because Annabel was not in `doc.requiredSigners` (`["NORLY A. TABO", "AIVAN M. BALOLOY", "ACEMATA MALTO"]`).
   - `targetPersonnelName` took `doc.targetPersonnel`. However, during document upload, `scanPdfForSigners` sorted detected signers top-to-bottom (`b.y - a.y`), assigning `primaryPersonnel = "NORLY A. TABO"` (the top-most section at `y = 396 pt`).
   - The Regional Director override check at line 4396 (`if (!isCounter && !asSigner ...)`) was skipped because `!asSigner` evaluated to `false` when `asSigner` was populated.
   - Consequently, `targetPersonnelName` was erroneously passed as `"NORLY A. TABO"`, instructing coordinate resolution to target the Supervisor section instead of Section D.

2. **Counter-Sign Stacking in `findPersonnelSignatureCoordinates` (Lines 3732, 3835)**:
   - When targeting Norly Tabo with counter-signing flags, `csIndex = 0` produced `boxY = 409` (next to Norly Tabo at `boxX = 463`), and `csIndex = 1` produced `boxY = 443` (overlapping the text at `y = 437`).
   - This exactly produced the **two stray boxes** seen in `media_1794401102272_2e3562e6.png`.

3. **Fallback Coordinate Resolution Flaw in `dtrVectorPdf.ts` (Lines 3772–3793)**:
   - When searching for a name that does not exist in the document text (e.g. Annabel on a document listing `ACEMATA MALTO`), `lastPageItems.find(...)` picks the **first** `"Printed Name"` label in the text stream.
   - In `test_dv_real.pdf`, the first `"Printed Name"` label is in Section C (`x = 10.6, y = 174.4` - Accountant Aivan Baloloy), rather than Section D (`x = 318.2, y = 174.4` - Section D).
   - Furthermore, `findApprovalSectionCoordinates` contains hardcoded `upper.includes("NORLY A. TABO")` (line 2028), causing any approval fallback to falsely bind to Norly Tabo.

4. **Cryptographic Identity Gate in `server/routes/dtrGenerator.ts` (Lines 655–669)**:
   - The server strictly enforces: `certCommonName` must match `requestedSigner`.
   - If the frontend attempts to pass `signerName = "ACEMATA MALTO"` to `/api/sign-pdf` while using Annabel's keystore, the server throws a `Cryptographic identity mismatch` (HTTP 400).
   - The architecture must separate:
     - `targetSignatoryName` (who is being signed for on the document, e.g. `"ACEMATA MALTO"` -> drives coordinate resolution `[boxX, boxY, boxW, boxH]`).
     - `signerName` / `p12SignerName` (who is signing cryptographically, e.g. `"Odoño-Calimpong Annabel Cortez"` -> drives PKCS#7 detached signature and DigiSigned stamp text).

---

### 5. Faithful Test Replication Strategy

We can replicate and verify this scenario 100% faithfully:

1. **Synthetic Fixture (`tests/fixtures/disbursement_voucher_fixture.pdf` or programmatic in `tests/pnpkiSignaturePlacement.test.ts`)**:
   - Create a clean Disbursement Voucher PDF matching `media_1794401102272_2e3562e6.png`:
     - Section A: Supervisor `"NORLY A. TABO"` (`x=260, y=396`) with existing signature `"Digitally signed by Tabo Norly Avila"`.
     - Section B: Accounting Entry table.
     - Section C: Accountant `"AIVAN M. BALOLOY"` (`x=157, y=174`) with existing signature.
     - Section D: `"D. Approved for Payment :"` (`x=318, y=269`), amount text (`x=320, y=245`), `"Signature"` (`x=318, y=205`), `"Printed Name"` (`x=318, y=174`), `"ACEMATA MALTO"` (`x=430, y=174`), `"OIC-Regional Director"` (`x=437, y=154`), vertical divider at `x=390`.
2. **Automated Assertions**:
   - Coordinate Resolution for Section D:
     - Target: `"ACEMATA MALTO"` (or `"ACE MATA MALTO"`).
     - Expected: `boxX ≈ 411..430`, `boxY ≈ 187` (between name baseline 174 and header 245), `boxW ≈ 125`, `boxH = 28`.
     - `boxX` must be strictly right of vertical divider `x = 390` (`boxX >= 394`).
     - `boxX + boxW` must stay within `585`.
     - Supervisor section (`y > 350`) must have **0** signature widgets and **0** rect coordinates.
   - End-to-End Cryptographic Signing:
     - Sign using `scratch/rene_jane.p12` or Annabel's keystore base64 with target `"ACEMATA MALTO"`.
     - Verify resulting PDF contains `/ByteRange` and detached PKCS#7 signature.
     - Verify widget `/Rect` annotation matches Section D coordinates.
     - Verify supervisor section remains pristine with no stray stamps.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Signature Placement | `findPersonnelSignatureCoordinates` | Locates signature box directly above target personnel in document | `pdfDoc`, `personnelName`, `options` | `{ pageIndex, boxX, boxY, boxW, boxH, sigRects, appliedPosition }` | Falls back to generic footer / last page when name not found | `src/utils/dtrVectorPdf.ts:3363` |
| 2 | Approval Placement | `findApprovalSectionCoordinates` | Locates supervisor / PO approval section across document | `pdfDoc`, `supervisorName` | `{ pageIndex, boxX, boxY, boxW, boxH }` | Falls back to default coordinates `(320, 80)` | `src/utils/dtrVectorPdf.ts:1994` |
| 3 | PDF Scanning | `scanPdfForSigners` | Extracts all official signatories and existing cryptographic signatures from PDF | `pdfBytes`, `userList` | `ScanPdfResult` (`signers`, `primaryPersonnel`, `requiredSigners`) | Returns empty array if no text in signature region | `src/utils/dtrVectorPdf.ts:2619` |
| 4 | Client Signing | `signUploadedPersonnelPdfBytes` | Orchestrates coordinate resolution, appearance stream, and incremental P12 signing | `existingPdfBytes`, `personnelName`, `signatureImage`, `p12Options`, `options` | `{ bytes, resolvedSignerName, signatureCoordinates }` | Throws error if backend signing fails | `src/utils/dtrVectorPdf.ts:3892` |
| 5 | Server Signing | `signPdfBuffer` | Cryptographic PKCS#7 signing using `@signpdf` with visual appearance | `pdfBuffer`, `p12Base64`, `password`, `options` | `{ signedBuffer, signerName, certificateInfo, signerIdentity }` | Throws if P12 password wrong or corrupt | `server/services/pnpkiSigningService.ts:879` |
| 6 | Server Route | `POST /api/sign-pdf` | Validates certificate identity against requested signer and delegates to `signPdfBuffer` | JSON with `pdfBase64`, `p12`, `p12_password`, `signerName`, `sigRects` | JSON with `signedPdfBase64`, `signerIdentity` | HTTP 400 on identity mismatch or missing P12 | `server/routes/dtrGenerator.ts:600` |
| 7 | Workspace Target Resolution | Signatory Line Target Resolution | Resolves which signatory line on document to sign for | `doc`, `activeKeystore`, `currentUser`, `asSigner` | `targetPersonnelName` | Can misidentify target if document signers list does not match keystore | `src/pages/SigningWorkspace.tsx:4372` |
| 8 | Keystore Vault | `dtr_generator` Table Storage | Stores AES-256-GCM encrypted P12 keystores and passwords in SQLite | Keystore upload form / Turso | SQLite rows with `p12`, `p12_password`, `image_digiSigned` | Unlocks only with correct account password | `server/db.ts`, `server/services/pnpkiSigningService.ts` |
| 9 | Incremental Chaining | `appendSignatureIncremental` | Appends ISO 32000 incremental update revision to preserve prior signatures | `pdfBuffer`, `signerName`, `sigRects`, `options` | PDF Buffer with appended cross-reference and trailer | Retains earlier `/ByteRange` validity | `server/services/pnpkiSigningService.ts:415` |
| 10 | Text Normalization | `matchNames` & `normalizeNameForMatch` | Flexible Philippine name matching across Middle Initials, Mojibake, and formatting | Two name strings | `boolean` (true if match) | Returns false for empty or non-matching names | `src/utils/dtrVectorPdf.ts:804` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Target Resolution | Active P12 is Annabel, doc target is ACEMATA MALTO | If `targetPersonnelName` takes `doc.targetPersonnel` which was set to Norly Tabo during upload, signature lands in Norly Tabo's box instead of Section D. |
| 2 | Name Spacing | `"ACEMATA MALTO"` vs `"ACE MATA MALTO"` | Must match identically via `matchNames` regardless of whether "ACE" and "MATA" are combined or separated. |
| 3 | Table Divider Boundary | Section D with column divider at `x = 390` | `boxX` must be `>= 394 pt` to strictly prevent the DigiSigned stamp from invading the left `"Signature"` / `"Printed Name"` label column. |
| 4 | Multiple "Printed Name" Labels | Form has Section C and Section D, both with `"Printed Name"` | `lastPageItems.find` returns Section C (Accountant Aivan Baloloy) because it appears first in the stream. Section D must be explicitly isolated. |
| 5 | Hardcoded Supervisor Match | `findApprovalSectionCoordinates` searching for supervisor | Hardcoded `upper.includes("NORLY A. TABO")` at line 2028 causes supervisor coordinate search to latch onto Norly Tabo even on documents meant for other approvals. |
| 6 | Identity Mismatch Gate | Server `/api/sign-pdf` receives `signerName = "ACEMATA MALTO"` with Annabel P12 | Throws HTTP 400 identity mismatch. Server must understand that `signerName` is the certificate holder, while `sigRect` is the target location on the document. |
| 7 | Counter-Sign Stacking | Multiple signatures on the same line (`counterSignIndex >= 1`) | Stacks boxes vertically by `csIndex * (boxH + 6)`. When misapplied to Norly Tabo, box 1 lands beside Norly and box 2 overlaps the certification text above. |

---

## 5-Component Handoff Report

### 1. Observation
- **Screenshot `media_1794401102272_2e3562e6.png`**:
  - Two red rectangles in the Supervisor section: one overlapping `"A. Certified: Expenses / Cash Advance necessary, lawful and incurred under my direct supervision."` (`y ≈ 443`), one to the right of Norly Tabo's signature (`x ≈ 463, y ≈ 409`).
  - Red arrow drawn from supervisor section to Section D directly above `"ACEMATA MALTO"`.
  - Section D signature box `[x: 390–585, y: 185–235]` is empty.
- **`src/pages/SigningWorkspace.tsx:4389-4394`**:
  ```ts
  const signerInDocSigners = doc.requiredSigners.find((req) => matchNames(req, signerToMatch));
  let targetPersonnelName = isCounter
    ? (options?.counterSignTargetPersonnel || doc.targetPersonnel || currentUserName).trim()
    : (signerInDocSigners || doc.targetPersonnel || matchedRequiredSigner || (isSignerSpecificPerson ? signerToMatch : "") || currentUserName).trim();
  ```
- **`src/utils/dtrVectorPdf.ts:2823`**:
  `detectedSigners.sort((a, b) => b.y - a.y);` sorts signers top-to-bottom upon upload.
- **`server/routes/dtrGenerator.ts:664-668`**:
  Server rejects signing if `matchNames(certCommonName, requestedSigner)` fails.
- **`tests/` Test Suites**:
  `pnpkiSignaturePlacement.test.ts` (141 assertions, 0 failed), `p12KeystoreSelection.test.ts` (0 failed), `signingWorkspaceOrderAndDownload.test.ts` (0 failed).

### 2. Logic Chain
1. When a DV is uploaded, `scanPdfForSigners` detects `NORLY A. TABO` (`y=396`), `AIVAN M. BALOLOY` (`y=174`), and `ACEMATA MALTO` (`y=174`). Sorting by `b.y - a.y` puts `NORLY A. TABO` as `primaryPersonnel` and `doc.targetPersonnel`.
2. When the user activates Annabel's keystore to sign Section D for ACEMATA MALTO, `SigningWorkspace.tsx` sets `asSigner = "Odoño-Calimpong Annabel Cortez"`.
3. Because Annabel is not in `doc.requiredSigners`, `signerInDocSigners` is undefined, and the logic falls back to `doc.targetPersonnel` (`"NORLY A. TABO"`).
4. `findPersonnelSignatureCoordinates` is therefore called with `"NORLY A. TABO"`, placing the signature widgets directly above and beside Norly Tabo in the supervisor section.
5. In addition, when counter-signing or fallback scanning runs, the first `"Printed Name"` label found is in Section C (Accountant) rather than Section D (Approval), and hardcoded supervisor checks latch onto Norly Tabo.
6. The target signatory resolution must explicitly allow targeting a designated line (e.g. `ACEMATA MALTO` in Section D) while using the active P12 certificate of the authorized signer (Annabel Cortez).

### 3. Caveats
- No production files were modified (Specification Mining mode is strictly read-only).
- SQLite database `local.db` is operational and was inspected without making schema changes.
- Scratch scripts created during survey: `scratch/survey_miner.ts`, `scratch/list_keystores.ts`, `scratch/list_documents.ts`, `scratch/dump_dv.ts`, `scratch/probe_dv_placement.ts`, `scratch/test_both.ts`.

### 4. Conclusion
The defect in `media_1794401102272_2e3562e6.png` is completely understood, reproduced, and documented:
1. Target resolution in `SigningWorkspace.tsx` must decouple the certificate holder identity (Annabel) from the document signature line (`ACEMATA MALTO`).
2. Coordinate resolution (`findPersonnelSignatureCoordinates`) must anchor strictly to the target signatory line, isolating Section D from the supervisor section.
3. Automated test fixtures and existing P12 keystores (Annabel in `dtr_generator`, Rene Jane in `scratch/rene_jane.p12`) are ready for regression verification.

### 5. Verification Method
To independently verify all findings and test suite behavior:
1. **Run existing test suites**:
   - `npx tsx tests/p12KeystoreSelection.test.ts`
   - `npx tsx tests/signingWorkspaceOrderAndDownload.test.ts`
   - `npx tsx tests/pnpkiSignaturePlacement.test.ts`
2. **Run coordinate probe on DV**:
   - `npx tsx scratch/probe_dv_placement.ts`
   - `npx tsx scratch/test_both.ts`
3. **Inspect Keystore Database**:
   - `npx tsx scratch/list_keystores.ts`
