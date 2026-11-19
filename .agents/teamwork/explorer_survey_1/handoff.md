# Handoff Report: PDF Signing Pipeline, Keystore Identity & Target Signatory Resolution Survey

**Agent**: `explorer_survey_1`  
**Working Directory**: `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_survey_1\`  
**Milestone**: Investigation and Architectural Survey of PDF Signing Pipeline, Keystore Profile Loading, and Signatory Anchoring  
**Date**: 2026-11-11T16:30:00Z  

---

## 1. Observation

### 1.1 Reference Screenshot & Problem Manifestation
In the user-provided reference artifact `C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794401102272_2e3562e6.png`, an official Disbursement Voucher PDF was signed using Annabel C. Odoño-Calimpong's active P12 keystore profile (`Odoño-Calimpong Annabel Cortez`).
Direct visual observations from this image:
1. **Supervisor Section (Upper Region)**:
   - Line label: `"Printed Name, Designation and Signature of Supervisor"`
   - Printed name: `"NORLY A. TABO"`, Designation: `"OIC Chief, Technical Operations Division"`
   - Authentic prior signature present: `"Digitally signed by Tabo Norly Avila"` with black vector signature.
   - **Stray Signature 1**: Placed inside the supervisor box next to Tabo: `"Digitally signed by Odoño-Calimpong Annabel Cortez"`.
   - **Stray Signature 2 (Duplicate)**: Placed stacked directly above the supervisor box straddling the top dividing border: `"Digitally signed by Odoño-Calimpong Annabel Cortez"`.
2. **Section D / "Approved for Payment" (Lower Region)**:
   - Header: `"D. Approved for Payment :"`
   - Box label: `"Signature"` with empty rectangular signature box.
   - Printed Name: `"ACEMATA MALTO"`, Designation: `"OIC-Regional Director"`.
   - Red diagnostic arrow in the reference image points directly from the stray Annabel signature in the supervisor box down to the empty box above `"ACEMATA MALTO"`.

---

### 1.2 Pipeline Entry Points & Implementation Files

The end-to-end PDF signing pipeline spans 5 key layers:

1. **Frontend Signing Workspace Orchestration**:
   - `src/pages/SigningWorkspace.tsx`:
     - Document upload & batch scanning: `handleFiles()` (lines 1840–1874) calls `scanPdfForSigners(buffer, storedUsers)`.
     - Document model construction: lines 4970–5030, sets `docItem.targetPersonnel = primary` and `docItem.requiredSigners = required`.
     - Sign action dispatchers: `handleSignSingle` (line 4630), `handleCounterSignSingle` (line 4644), `handleExecuteSingleCounterSign` (line 4775), `handleBulkSignSelected` (lines 5430–5520).
     - Single document sign executor: `signDocumentItem(doc, options)` (lines 4335–4628).

2. **Client PDF Geometry & Coordinate Engine**:
   - `src/utils/dtrVectorPdf.ts`:
     - Client sign gateway: `signUploadedPersonnelPdfBytes(...)` (lines 3892–4050).
     - Signatory discovery: `scanPdfForSigners(pdfBytes, userList)` (lines 2619–2837).
     - Coordinate resolution: `findPersonnelSignatureCoordinates(pdfDoc, personnelName, options)` (lines 3363–3880).
     - Fallback heuristic when name not matched in text stream: lines 3759–3865.

3. **HTTP API Client**:
   - `src/services/api.ts`:
     - `dtrGeneratorApi.signPdfDocument(payload)` (lines 832–872) posts JSON to `${API_BASE}/dtr-generator/sign-pdf`.

4. **Backend Route & Identity Verification**:
   - `server/routes/dtrGenerator.ts`:
     - Endpoint `POST /api/dtr-generator/sign-pdf` (lines 428–714).
     - Extracts certificate identity via `getSignerIdentityFromP12(p12ToUse, passwordToUse)` (line 647).
     - Identity strictness validation (lines 655–669):
       ```ts
       const certCommonName = (extractedIdentity?.commonName || "").trim();
       if (signerName && certCommonName) {
         const requestedSigner = String(signerName).trim();
         const isIdentityMatch =
           matchNames(certCommonName, requestedSigner) ||
           matchNames(requestedSigner, certCommonName) ||
           certCommonName.toLowerCase() === requestedSigner.toLowerCase();

         if (!isIdentityMatch) {
           return res.status(400).json({
             success: false,
             error: `Cryptographic identity mismatch: The active PNPKI .p12 certificate belongs to "${certCommonName}", but the document is being signed as "${requestedSigner}". Digital signatures cannot be applied using another employee's certificate.`,
           });
         }
       }
       ```

5. **Cryptographic Signing Service**:
   - `server/services/pnpkiSigningService.ts`:
     - Certificate parser: `getSignerIdentityFromP12(p12Base64, password)` (lines 122–221).
     - Buffer signer: `signPdfBuffer(pdfBuffer, p12Base64, password, options)` (lines 879–1263).
     - Incremental signer: `appendSignatureIncremental(...)` (lines 490–872).
     - Uses `@signpdf/signpdf` + `@signpdf/signer-p12` for detached PKCS#7 signature injection.

---

### 1.3 Active P12 Keystore Profile Loading & Certificate Extraction

1. **Database Schema & Storage**:
   - In Turso/SQLite, P12 keystores are stored in the `dtr_generator` table:
     - Columns: `id`, `user_Id`, `Name`, `p12` (Base64 string), `p12_password` (AES-256-GCM encrypted string with prefix `enc:iv:tag:cipher`), `image_digiSigned` (Base64 signature image).
     - Verified records in Turso:
       - `dtr-sig-usr-mu74lftk`: User `usr-mu74lftk`, Name: `Malto Ace Mata`
       - `dtr-sig-usr-muxedv66`: User `usr-muxedv66`, Name: `Odoño-Calimpong Annabel Cortez`
       - `dtr-sig-sup-01`: User `usr-mu72vs2b`, Name: `Rene Jane R. Buena`
       - `dtr-sig-usr-mv4z99vf`: User `usr-mv4z99vf`, Name: `Cantorna Michael Verano`

2. **Frontend Profile Activation (`SigningWorkspace.tsx`)**:
   - SuperAdmin (Ace Malto) opens `P12KeystoreUnlockModal` and selects a keystore (e.g., Annabel).
   - Stored in component state: `activeKeystoreProfile`:
     ```ts
     {
       profileId: "dtr-sig-usr-muxedv66",
       userId: "usr-muxedv66",
       signerName: "Odoño-Calimpong Annabel Cortez",
       p12Base64: "<base64>",
       p12Password: "<decrypted>",
       isUnlocked: true,
       hasP12: true
     }
     ```
   - In `resolveUserSignerContext` (`SigningWorkspace.tsx`, lines 4293–4316):
     `p12Options` is created with `signerName: effectiveSignerName` (`"Odoño-Calimpong Annabel Cortez"`).

3. **Certificate Common Name Extraction**:
   - `server/services/pnpkiSigningService.ts`, `getSignerIdentityFromP12`:
     - Lines 127–129: decodes PKCS#12 ASN.1 using `node-forge`.
     - Lines 148–163: matches private key modulus `privateKey.n` with certificate `pub.n`.
     - Lines 176–179: extracts Subject Common Name:
       ```ts
       const cnAttr = signerCert.subject.attributes.find(
         (a: any) => a.name === "commonName" || a.shortName === "CN"
       );
       const commonName = cnAttr ? String(cnAttr.value) : "DICT Authorized Signatory";
       ```
     - Also extracts `sha256Fingerprint`, `validFrom`, `validTo`, `serialNumber`, `issuerCN`.

---

### 1.4 How the Signing Pipeline Resolves the Signatory

In `src/pages/SigningWorkspace.tsx`, `signDocumentItem` (lines 4373–4411):
```ts
const signerToMatch = asSigner || effectiveSignerName;
const matchedRequiredSigner = doc.requiredSigners.find((req) =>
  matchNames(req, signerToMatch) || matchNames(req, currentUserName)
);

const isSignerSpecificPerson =
  Boolean(signerToMatch) &&
  !signerToMatch.toLowerCase().includes("system") &&
  !signerToMatch.toLowerCase().includes("admin");

const signerInDocSigners = doc.requiredSigners.find((req) => matchNames(req, signerToMatch));

let targetPersonnelName = isCounter
  ? (options?.counterSignTargetPersonnel || doc.targetPersonnel || currentUserName).trim()
  : (signerInDocSigners || doc.targetPersonnel || matchedRequiredSigner || (isSignerSpecificPerson ? signerToMatch : "") || currentUserName).trim();

// If user is Regional Director / ARD, or signing on behalf of RD/ARD, target the RD/ARD signatory line
if (!isCounter && !asSigner && (!matchedRequiredSigner || !matchNames(matchedRequiredSigner, effectiveSignerName))) {
  if (isUserRegionalDirectorOrAssistant(liveUser || currentUser)) {
    const rdSigner = doc.signers.find(
      (s) =>
        s.status !== "signed" &&
        ((s.role || "").toUpperCase().includes("REGIONAL DIRECTOR") ||
          (s.role || "").toUpperCase().includes("DIRECTOR") ||
          (s.role || "").toUpperCase().includes("ARD") ||
          (s.role || "").toUpperCase().includes("NOTED BY") ||
          (s.role || "").toUpperCase().includes("APPROVED BY"))
    );
    if (rdSigner && rdSigner.name) {
      targetPersonnelName = rdSigner.name.trim();
    }
  }
}
```

In `src/utils/dtrVectorPdf.ts`, `scanPdfForSigners` (lines 2822–2829):
```ts
detectedSigners.sort((a, b) => b.y - a.y);
const requiredSigners = detectedSigners.map((s) => s.name);
const pendingSigners = detectedSigners.filter((s) => s.status === "pending");
const primaryPersonnel = pendingSigners[0]?.name || (detectedSigners.length > 0 ? detectedSigners[0]?.name : "");
```

In `scratch/test_dv_simulation.ts`, simulating the exact disbursement voucher layout:
- Running `scanPdfForSigners` yielded:
  - `primaryPersonnel: "NORLY A. TABO"` (y = 396)
  - `requiredSigners: ["NORLY A. TABO", "ACE MALTO", "AIVAN M. BALOLOY"]`
- Running `findPersonnelSignatureCoordinates(pDoc, "NORLY A. TABO")` yielded:
  - `boxX: 434, boxY: 409` (directly above Norly A. Tabo in the supervisor box)
- Running `findPersonnelSignatureCoordinates(pDoc, "ACEMATA MALTO")` yielded:
  - `boxX: 332, boxY: 187` (directly above ACEMATA MALTO in Section D / Approved for Payment)

---

## 2. Logic Chain

### Step 1: Why `primaryPersonnel` was set to Norly A. Tabo
- **Observation**: `scanPdfForSigners` sorts `detectedSigners` descending by Y (`b.y - a.y`, line 2823).
- **Inference**: In PDF coordinate space, (0,0) is at the bottom-left corner of the page. Sections near the top of the physical document have large Y coordinates (y ≈ 396 pt for the Supervisor box), while sections near the bottom (Section D / "Approved for Payment" at y ≈ 174 pt) have smaller Y coordinates.
- **Result**: Because of the `b.y - a.y` sort, the supervisor line (`NORLY A. TABO`) was placed at index 0 of `detectedSigners`. Line 2828 sets `primaryPersonnel = pendingSigners[0]?.name`, so `primaryPersonnel` was resolved as `"NORLY A. TABO"`.
- **Observation**: When uploaded in `SigningWorkspace.tsx` (line 5012), `docItem.targetPersonnel` is permanently assigned `primary` (`"NORLY A. TABO"`).

### Step 2: Why `targetPersonnelName` resolved to Norly A. Tabo during signing
- **Observation**: SuperAdmin signed using Annabel's activated P12 keystore (`activeKeystore.signerName = "Odoño-Calimpong Annabel Cortez"`).
- **Observation**: `asSigner = "Odoño-Calimpong Annabel Cortez"`.
- **Observation**: In `signDocumentItem` line 4389:
  `const signerInDocSigners = doc.requiredSigners.find((req) => matchNames(req, signerToMatch));`
  Because Annabel is not listed as a signatory on the voucher (the voucher lists Norly A. Tabo, Aivan Baloloy, and Acemata Malto), `signerInDocSigners` evaluates to `undefined`.
- **Observation**: Line 4393 evaluates:
  `targetPersonnelName = (signerInDocSigners || doc.targetPersonnel || matchedRequiredSigner || (isSignerSpecificPerson ? signerToMatch : "") || currentUserName).trim()`
  Because `signerInDocSigners` is undefined, JavaScript selects `doc.targetPersonnel`.
- **Observation**: From Step 1, `doc.targetPersonnel` is `"NORLY A. TABO"`. Therefore, `targetPersonnelName` evaluates to `"NORLY A. TABO"`.
- **Observation**: Line 4396 has the guard:
  `if (!isCounter && !asSigner && (!matchedRequiredSigner || !matchNames(matchedRequiredSigner, effectiveSignerName)))`
  Because `asSigner` was provided (`"Odoño-Calimpong Annabel Cortez"`), `!asSigner` is `false`.
- **Result**: The entire Regional Director / Section D fallback was skipped. `targetPersonnelName` remained `"NORLY A. TABO"`.

### Step 3: Why the signature box anchored above Norly A. Tabo
- **Observation**: `signUploadedPersonnelPdfBytes(pdfBytes, targetPersonnelName, ...)` was invoked with `targetPersonnelName = "NORLY A. TABO"`.
- **Observation**: `findPersonnelSignatureCoordinates(pdfDoc, "NORLY A. TABO")` located `"NORLY A. TABO"` at (x=250, y=396).
- **Observation**: Bounding box calculation computed `boxY = Math.round(item.y + 13) = 409`, placing the visual DigiSigned box and cryptographic `/Sig` annotation directly in the supervisor box above Norly A. Tabo.
- **Result**: Even though the keystore belonged to Annabel, the signature was anchored to Norly A. Tabo, directly conflicting with the intended Section D signature box above ACEMATA MALTO.

### Step 4: Why duplicate / stray boxes were created in the Supervisor Section
- **Observation**: In the user screenshot, there are TWO Annabel signatures in/around the supervisor box: one inside the box, and one stacked across the top border line.
- **Observation**: In `findPersonnelSignatureCoordinates` (line 3732):
  `const stackOffset = csIndex > 0 ? csIndex * (boxH + 6) : 0;`
  `const boxY = Math.min(height - boxH - 2, Math.max(10, Math.round(item.y + 13 + stackOffset)));`
- **Inference**: When the user saw that the signature did not appear in Section D and clicked "Sign" / "Counter Sign" again, `counterSignIndex` incremented to 1.
- **Result**: The second signature was computed at `boxY = 409 + 34 = 443 pt`, placing it directly above the first Annabel signature and straddling the top dividing border of the supervisor box.

### Step 5: Why `server/routes/dtrGenerator.ts` locks `signerName` to Keystore CN
- **Observation**: Lines 656–669 in `server/routes/dtrGenerator.ts` check `if (!isIdentityMatch) return res.status(400)`.
- **Inference**: The backend API rejects the signing request unless `signerName` matches `extractedIdentity.commonName`.
- **Result**: The frontend was forced to pass `signerName: "Odoño-Calimpong Annabel Cortez"` instead of passing the document line `"ACEMATA MALTO"`. Because the API payload conflates the cryptographic signing identity with the document layout signatory, the pipeline could not decouple the certificate owner from the document target box.

---

## 3. Caveats

1. **Unmodified Working Directory**:
   - Per mission instructions and read-only constraints, no production files in `src/` or `server/` were modified.
   - All tests were conducted against synthesized and scratch PDF documents (`scratch/test_dv_simulation.ts`, `scratch/test_dv_real.pdf`).
2. **User List Variations Across Environments**:
   - In production, `effectiveUsers` is fetched from Turso SQLite (`administration` and `users` tables) or `localStorage`.
   - On the developer workstation, `Norly A. Tabo` exists in the local database (`OIC Chief - Technical Operations Division`), but is absent from `DEFAULT_USERS` in `src/data/userStore.ts`. In offline mode without Turso sync, fallback users are utilized.
3. **Form-Specific Variations**:
   - Disbursement Vouchers (DV) follow the national GAM (Government Accounting Manual) standard layout with Section A/C/D boxes.
   - Civil Service Form 48 (DTR) uses dual side-by-side copies on a portrait page.
   - RAOD sheets are landscape tables (842 x 595 pt) with 4 signatory columns.
   - Any generalized fix must preserve correct behavior across DTR, RAOD, and voucher formats without regressions.

---

## 4. Conclusion & Answers to Parent Questions

### Answer 1: PDF Signing Pipeline Implementation Location
- **Frontend Controller**: `src/pages/SigningWorkspace.tsx`:
  - `handleSignSingle` (line 4630) / `handleExecuteSingleCounterSign` (line 4775).
  - `signDocumentItem` (line 4335).
- **Geometry & Text Parsing**: `src/utils/dtrVectorPdf.ts`:
  - `signUploadedPersonnelPdfBytes` (line 3892).
  - `scanPdfForSigners` (line 2619).
  - `findPersonnelSignatureCoordinates` (line 3363).
- **Backend API & Service**:
  - `server/routes/dtrGenerator.ts` (`POST /api/dtr-generator/sign-pdf`, line 428).
  - `server/services/pnpkiSigningService.ts` (`signPdfBuffer`, line 879; `appendSignatureIncremental`, line 490).

### Answer 2: Active P12 Keystore Loading & Subject CN Extraction
- **Database Storage**: Turso table `dtr_generator` stores encrypted P12 base64 and passwords.
- **Frontend Activation**: `P12KeystoreUnlockModal` in `SigningWorkspace.tsx` stores active state in `activeKeystoreProfile` (profileId, signerName, p12Base64, p12Password).
- **Extraction**: `server/services/pnpkiSigningService.ts`, `getSignerIdentityFromP12` (lines 122–221):
  - Uses `forge.pkcs12.pkcs12FromAsn1` to parse the PKCS#12 bundle.
  - Matches the private key modulus against certificate public keys.
  - Extracts X.509 Subject Common Name (`CN`) at line 177:
    ```ts
    const cnAttr = signerCert.subject.attributes.find((a: any) => a.name === "commonName" || a.shortName === "CN");
    ```

### Answer 3: Signatory Determination Mechanism
- Upon PDF upload, `scanPdfForSigners` scans the page text, matches names against the registered user roster, and sorts all detected signers descending by Y (`b.y - a.y`, line 2823).
- The top-most signer on the page (Supervisor `NORLY A. TABO` at y=396) is designated as `primaryPersonnel`.
- `SigningWorkspace.tsx` saves this into the document record as `targetPersonnel = primary`.
- When clicking "Sign" on the document card, `handleSignSingle` does not pass an explicit signatory target. `signDocumentItem` falls back to `doc.targetPersonnel` (`"NORLY A. TABO"`), completely bypassing the bottom approval box ("ACEMATA MALTO").

### Answer 4: Root Cause of Keystore CN Binding vs Target Signatory
1. **Conflated Identity in Backend Route**: `server/routes/dtrGenerator.ts` lines 656–669 enforces that `signerName` must match the P12 certificate `commonName`. This forces the caller to send Annabel's name in `signerName`.
2. **Preempted Fallback Chain**: In `SigningWorkspace.tsx` line 4393:
   `targetPersonnelName = (signerInDocSigners || doc.targetPersonnel || matchedRequiredSigner || ...)`
   Since Annabel is not in `doc.requiredSigners`, `signerInDocSigners` is undefined, causing the code to pick `doc.targetPersonnel` (`"NORLY A. TABO"`).
3. **Suppressed RD Override**: Line 4396 contains `if (!isCounter && !asSigner && ...)`. When signing with an active keystore profile, `asSigner` is truthy, disabling the Regional Director line detection.
4. **Lack of Granular Target in UI**: The document card has only a single generic "Sign" button that signs the document without letting the user choose which signatory line (Supervisor vs Section D) to sign.

### Answer 5: Data Structures Representing Signing Request, Keystore & Target Signatory
1. **`WorkspaceDocument`** (`SigningWorkspace.tsx`):
   - `targetPersonnel: string` (currently single string; should support granular targets).
   - `requiredSigners: string[]` (all detected official signatories).
   - `signers: DocumentSigner[]` (matrix with name, role, status, position, signedAt).
2. **`ActiveKeystore`** (`SigningWorkspace.tsx`):
   - `profileId`, `userId`, `signerName`, `p12Base64`, `p12Password`, `isUnlocked`.
3. **`signPdfDocument` Payload** (`src/services/api.ts` & `dtrGenerator.ts`):
   - `pdfBase64`, `p12`, `p12_password`, `sigRect`, `sigRects`, `fieldName`, `pageIndex`, `signerName`, `isCounterSign`.
4. **Cryptographic Signatures** (`pnpkiSigningService.ts`):
   - `SignerIdentity` (commonName, subjectDN, serialNumber, sha256Fingerprint, validity).
   - PDF `/Sig` Dictionary (Name, Reason, M, ByteRange, Contents).
   - PDF `/Widget` Annotation (`/Rect [minX, minY, maxX, maxY]`, `/AP /N` Appearance Stream).

---

## 5. Recommended Architectural Fixes

### Fix 1: Decouple Cryptographic Signer Identity from Target Signatory in API & Pipeline
In `server/routes/dtrGenerator.ts`:
- Refactor the payload to support both `targetSignatory` (the document line being signed, e.g. `"ACEMATA MALTO"`) and `signerName` / `certCommonName` (the P12 certificate identity).
- Update the identity match check (lines 656–669):
  When a SuperAdmin or authorized delegate signs with an active keystore, verify that the active certificate belongs to an authorized signer, while allowing `targetSignatory` to designate the physical signature line on the document.

### Fix 2: Correct Signatory Sorting & Primary Signer Resolution in `scanPdfForSigners`
In `src/utils/dtrVectorPdf.ts`:
- Government forms place the **approval / final authority** at the bottom (Section D, "Approved by", "Approved for Payment", "Regional Director").
- Priority for `primaryPersonnel` should check for Section D / Approval / Regional Director titles before falling back to physical Y coordinates.
- If multiple signers are detected, do NOT default to the top-most supervisor.

### Fix 3: Target Signatory Resolution in `SigningWorkspace.tsx`
In `signDocumentItem`:
- Allow `options` to explicitly pass `targetSignatoryName?: string`.
- When signing Section D / "Approved for Payment":
  If `asSigner` is Annabel and the document contains an approval line for Regional Director / "ACEMATA MALTO", explicitly target `"ACEMATA MALTO"`.
- Remove the `!asSigner` restriction on line 4396 so Regional Director / Executive approval matching operates even when `asSigner` is present.

### Fix 4: Granular Signatory Line Targeting in UI
In `SigningWorkspace.tsx`:
- When a document contains multiple required signers (e.g., `Norly A. Tabo` in TOD and `ACEMATA MALTO` in Section D):
  - In the "Required Signers Chain" badges, allow the user to click "Sign this line" directly on the specific signatory badge.
  - In the card action button: If an approval line is pending, provide a clear target: `"Sign for ACEMATA MALTO (Approved for Payment)"`.

### Fix 5: Prevent Duplicate Widgets in Target Box
In `src/utils/dtrVectorPdf.ts` & `pnpkiSigningService.ts`:
- Before appending a new signature widget, inspect existing widget `/Rect` coordinates on the target page.
- If an existing valid signature already covers the target box (e.g. Tabo's signature in the supervisor box), prevent placing a new signature in that same box unless explicitly requested as a counter-signature.

---

## 6. Verification Method

To independently verify these findings:

1. **Verify Disbursement Voucher Scanning & Coordinate Resolution**:
   Run the simulation script created during this survey:
   ```powershell
   npx tsx scratch/test_dv_simulation.ts
   ```
   **Expected Output**:
   - `Scan primaryPersonnel`: Currently outputs `'NORLY A. TABO'` due to Y-descending sort flaw.
   - `Target NORLY A. TABO`: Resolves to `boxY: 409` (supervisor box).
   - `Target ACEMATA MALTO`: Resolves to `boxY: 187, boxX: 332` (Section D signature box).

2. **Verify Keystore Loading & DB Profiles**:
   Run the database inspector:
   ```powershell
   npx tsx scratch/check_tabo.ts
   ```
   **Expected Output**:
   - Confirms `Norly A. Tabo` exists as `OIC Chief - Technical Operations Division`.
   - Confirms active P12 profiles exist for `Malto Ace Mata` and `Odoño-Calimpong Annabel Cortez`.

3. **Verify Automated Placement Test Suite**:
   Run the project's existing test suite:
   ```powershell
   npx tsx tests/pnpkiSignaturePlacement.test.ts
   npx tsx tests/p12KeystoreSelection.test.ts
   ```
   **Expected Output**:
   - `p12KeystoreSelection.test.ts` passes (retains active keystore profile).
   - Note Test 15 in `pnpkiSignaturePlacement.test.ts` line 675 confirms the legacy assumption: `findPersonnelSignatureCoordinates(pdfDoc, "Odoño-Calimpong Annabel Cortez")`.

4. **Invalidation Conditions**:
   - If `scanPdfForSigners` is updated to prioritize Section D / final approvers, `primaryPersonnel` will resolve to `ACEMATA MALTO`.
   - If `signDocumentItem` passes `targetSignatoryName: "ACEMATA MALTO"`, `findPersonnelSignatureCoordinates` will output `boxX: 332, boxY: 187` exclusively in Section D, producing 0 widgets in the supervisor section.
