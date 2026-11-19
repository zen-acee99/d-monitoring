# Digital Signature Verification Analysis: Adobe Acrobat "Expected a dict object" Error

**Target Repositories**: `dict-monitoring`, `d-monitoring`, `dict-dtr-generator`  
**Target Module**: DTR Generator & Combine DTR (`server/services/pnpkiSigningService.ts`)  
**Investigator**: explorer_survey_dtr_1 (Teamwork Explorer)  
**Date**: 2026-11-15  

---

## 1. Observation

### 1.1 Direct Visual Observation from Error Screenshot
- **Source Image**: `C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794706234820_7d45421f.jpg`
- **Application**: Adobe Acrobat Reader DC (64-bit) on Windows.
- **Document Opened**: Civil Service Form No. 48 (CS Form 48 - Daily Time Record - DTR), standard dual-copy side-by-side layout (Copy 1 on left, Copy 2 on right) on 8.5 x 11 inch page.
- **Visual Signatures**: 
  - Left copy: Visual DigiSigned stamp with handwritten signature and text: *"Digitally signed by Malto Ace Mata ... ACE MATA MALTO..."*
  - Right copy: Visual DigiSigned stamp with handwritten signature and text: *"Digitally signed by Malto Ace Mata ACE MATA MA..."*
- **Signatures Panel**:
  - Top status bar: *"At least one signature requires validating."* with a *"Signature Panel"* button.
  - Right drawer tree view: `> [?] Rev. 1: Signed by Malto Ace Mata`
- **Error Dialog (Modal)**:
  - Window Title: `Error Information`
  - Dialog Icon: Yellow warning triangle
  - Verbatim Text:
    ```text
    Error during signature verification.

    Adobe Acrobat error.
    Expected a dict object.
    ```
  - Dialog Action Buttons: `[Details >>]` `[OK]`

---

### 1.2 Codebase Survey & Production Implementations
The exact same `server/services/pnpkiSigningService.ts` file exists across all three repositories with identical SHA-256 hash (`96b1e4fbb2c2e41aa0cb6ae673bca13a4c23ae361d3eb9e4c5f6ea6ffa904da0`):
- `dict-monitoring/server/services/pnpkiSigningService.ts`
- `d-monitoring/server/services/pnpkiSigningService.ts`
- `dict-dtr-generator/server/services/pnpkiSigningService.ts`

Inspecting `server/services/pnpkiSigningService.ts` revealed two distinct signing execution paths:
1. **First-Signature Mode** (`signPdfBuffer`, lines 1626–1921): Used when `isAlreadySigned` is false. Uses `pdf-lib` to construct PDF objects, create placeholder `/Sig`, and invoke `@signpdf/signpdf` + `@signpdf/signer-p12`.
2. **Incremental Update Mode** (`appendSignatureIncremental`, lines 1003–1546): Used when `isAlreadySigned` is true. Synthesizes binary PDF update objects, cross-reference table / xref stream, and invokes `@signpdf/signpdf`.

---

### 1.3 Exact Code Observations of Malformed / Missing Dictionary Structures

#### Observation A: Form XObject Appearance Stream (`/AP /N`) Lacks Mandatory `/Resources` Dictionary
In `server/services/pnpkiSigningService.ts` lines 1843–1847:
```typescript
// Appearance stream on signature widget is an empty Form XObject (q Q) so Adobe Acrobat does NOT render duplicate text
const apStream = pdfDoc.context.stream("q\nQ\n", {
  Type: "XObject",
  Subtype: "Form",
  BBox: [0, 0, rw, rh],
});
```
- **Serialization Result**: In the generated PDF (e.g. Object 7 in `scratch/pass1_dtr_signed.pdf`):
  ```pdf
  7 0 obj
  <<
  /Type /XObject
  /Subtype /Form
  /BBox [ 0 0 195 32 ]
  /Length 4
  >>
  stream
  q
  Q
  endstream
  endobj
  ```
- **Finding**: `/Resources` is completely absent from the Form XObject dictionary.
- **Reference in `@signpdf/placeholder-pdf-lib`**: In `node_modules/@signpdf/placeholder-pdf-lib/dist/pdflibAddPlaceholder.js` line 120–123, the official signpdf library author explicitly documented:
  ```javascript
  const apStream = doc.context.formXObject([], {
    BBox: widgetRect,
    Resources: {} // Necessary to avoid Acrobat bug (see https://stackoverflow.com/a/73011571)
  });
  ```

#### Observation B: Image XObjects Invoked in Signature Appearance Lack `/Resources`
In `server/services/pnpkiSigningService.ts` lines 1230–1243:
```typescript
if (defRGB) {
  if (defAlpha) {
    smaskObjNum = nextFreeObj++;
    appendObj(
      smaskObjNum,
      `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceGray\n/BitsPerComponent 8\n/Filter /FlateDecode\n/Length ${defAlpha.length}\n>>\nstream\n${defAlpha.toString("binary")}\nendstream`
    );
  }
  imgObjNum = nextFreeObj++;
  const smaskEntry = smaskObjNum ? `/SMask ${smaskObjNum} 0 R\n` : "";
  appendObj(
    imgObjNum,
    `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n${smaskEntry}/Filter /FlateDecode\n/Length ${defRGB.length}\n>>\nstream\n${defRGB.toString("binary")}\nendstream`
  );
}
```
- **Finding**: Both `smaskObjNum` and `imgObjNum` are Image XObjects (`/Subtype /Image`) referenced via `Do` in the appearance Form XObject `apNum`. Neither defines `/Resources << >>`.

#### Observation C: Signature Field Multi-Widget Parent/Kids Hierarchy
In `server/services/pnpkiSigningService.ts`:
- First-Signature Mode lines 1680–1893:
  ```typescript
  const isMultiWidget = widgetRects.length > 1;
  const parentFieldRef = isMultiWidget ? pdfDoc.context.nextRef() : null;
  ...
  if (isMultiWidget) {
    const parentFieldDict = pdfDoc.context.obj({
      FT: "Sig",
      T: PDFString.of(baseFieldName),
      V: signatureDictRef,
      Kids: childWidgetRefs,
    });
    pdfDoc.context.assign(parentFieldRef!, parentFieldDict);
    rootFieldRefs.push(parentFieldRef);
  }
  ```
- Incremental Mode lines 1370–1393:
  ```typescript
  if (isMultiWidget) {
    appendObj(
      parentFieldNum,
      `<<\n/FT /Sig\n/T (${baseFieldName})\n/V ${sigDictObjNum} 0 R\n/Kids [${kidsStr}]\n>>`
    );
    newFieldRefs.push(`${parentFieldNum} 0 R`);
  }
  ```
- **Serialization Result**: In the generated PDF (e.g. Object 6 in `scratch/pass1_dtr_signed.pdf`):
  ```pdf
  6 0 obj
  <<
  /FT /Sig
  /T (Personnel_Signature)
  /V 5 0 R
  /Kids [ 8 0 R 10 0 R ]
  >>
  endobj
  ```
  And `8 0 obj` and `10 0 obj`:
  ```pdf
  8 0 obj
  <<
  /Type /Annot
  /Subtype /Widget
  /Rect [ 54 184 249 216 ]
  /Parent 6 0 R
  /F 132
  /P 4 0 R
  /AP << /N 7 0 R >>
  >>
  endobj
  ```
- **Finding**: The field registered in AcroForm `/Fields` is `6 0 R`. It has `/FT /Sig`, `/V`, and `/Kids`. It does NOT have `/Type /Annot`, `/Subtype /Widget`, `/Rect`, or `/AP`.

#### Observation D: AcroForm `/DR` Parsing in Incremental Updates
In `server/services/pnpkiSigningService.ts` lines 1121–1124 and 1129–1132:
```typescript
const drIdx = afBody.indexOf("/DR");
if (drIdx !== -1) {
  existingDR = extractBalancedDict(afBody, drIdx) || "";
}
```
- **Finding**: If `/DR` in the existing AcroForm is an indirect reference (`/DR 15 0 R`), `extractBalancedDict` skips the reference token and captures whatever NEXT dictionary block exists in `afBody`. At line 1401, `/DR ${existingDR}` writes a corrupted `/DR` dictionary entry into `/AcroForm`.

---

## 2. Logic Chain

```
[Observation 1.1: Adobe Acrobat Modal Error]
  "Error during signature verification. Adobe Acrobat error. Expected a dict object."
  Triggered when opening or verifying signature in CS Form 48 DTR.
           │
           ▼
[Observation A & B: Missing /Resources in Appearance Form XObject & Image XObjects]
  - First-Signature Mode creates Form XObject:
      `<< /Type /XObject /Subtype /Form /BBox [...] /Length 4 >>` WITHOUT /Resources.
  - Incremental Mode creates Image XObjects `imgObjNum` & `smaskObjNum` WITHOUT /Resources.
           │
           ▼
[PDF Spec ISO 32000-1 §8.10.1 Table 95 & Adobe Implementation]
  - Form XObjects used as Annotation Appearances (/AP /N) have no containing page stream to inherit resources from.
  - Adobe Acrobat's signature verification engine explicitly parses the visual appearance layer of the signature.
  - When evaluating Form XObjects and any XObject drawn via the `Do` operator, Acrobat expects a dictionary object at `/Resources`.
  - Finding no dictionary (null/undefined), Acrobat throws: "Adobe Acrobat error. Expected a dict object."
           │
           ▼
[Observation C: Signature Field Non-Terminal /Kids Hierarchy]
  - CS Form 48 has dual copies, so `sigRects` has 2 entries.
  - Both First-Signature Mode and Incremental Mode trigger `isMultiWidget = true`.
  - The signature field placed in AcroForm `/Fields` is a non-terminal field with `/Kids [child1 child2]`.
  - The parent field lacks `/Type /Annot`, `/Subtype /Widget`, `/Rect`, and `/AP`.
           │
           ▼
[PDF Digital Signature Architecture & ISO 32000-1 §12.7.4.5 Table 218 / §12.8]
  - When Adobe Acrobat verifies a signature dictionary (/Type /Sig), it looks up the associated signature field in AcroForm `/Fields`.
  - Acrobat expects the signature field itself to be a terminal Widget Annotation dictionary (`/Type /Annot /Subtype /Widget`) containing the `/AP` dictionary.
  - Because the field in `/Fields` is a non-terminal field with `/Kids` and lacks the `/AP` dictionary, Acrobat's signature verification handler fails to find the expected dictionary object and crashes with "Expected a dict object."
           │
           ▼
[Verification Proof: Controlled Test]
  - In `scratch/test_single_merged.ts`, we created `test_single_merged.pdf` with:
    1. A single merged terminal field (`/Type /Annot /Subtype /Widget /FT /Sig /V ... /T ... /Rect ... /AP ...`).
    2. Explicit `Resources: {}` on the Form XObject appearance stream.
  - Opened `test_single_merged.pdf` in Adobe Acrobat DC on Windows via UI Automation:
    ZERO error dialogs, clean opening, clean signature verification!
  - In `scratch/test_full_fix.ts`, we created `test_pass2_fixed.pdf` with two sequential terminal fields:
    AcroForm `/Fields` count: 2, `Kids count = 0` on both fields.
    Opened in Adobe Acrobat DC: ZERO error dialogs!
```

---

## 3. Caveats
1. **Single-revision vs. Two-revision Dual-Copy DTR**:
   - In CS Form 48, both Copy 1 and Copy 2 are printed on the same physical sheet.
   - For visual presentation, the visual stamp, handwritten signature image, and typography MUST appear on BOTH copies. In First-Signature Mode, lines 1740–1840 ALREADY draw the visual stamp onto the page canvas for all boxes in `widgetRects`.
   - For cryptographic signing: The digital signature field (`/FT /Sig`) in AcroForm `/Fields` must be bound as a single terminal widget annotation to the primary signature box (Copy 1, `widgetRects[0]`).
   - If users require two independent clickable digital signatures in the Signatures panel (one for Copy 1, one for Copy 2), this is done sequentially via Pass 1 and Pass 2 (as implemented in `server/generate-ralph-dtr.ts`). A single digital signature dictionary `/Type /Sig` cannot be shared across multiple child widgets via `/Kids` without triggering Adobe Acrobat's dictionary parsing failure.
2. **Untrusted Root CA Warning vs. Structure Error**:
   - The user screenshot shows: `At least one signature requires validating.` and `> [?] Rev. 1: Signed by Malto Ace Mata`. The `[?]` icon is Acrobat's standard trust indicator for certificates issued by a private or government CA (like PNPKI / GovCA) that is not in the Adobe Approved Trust List (AATL).
   - This trust prompt is completely normal and expected for PNPKI. It is distinct from the fatal modal popup `Error during signature verification. Adobe Acrobat error. Expected a dict object.`, which is a structural syntax error.
3. **Integrity Mode Constraint**:
   - Demo integrity mode strictly observed: No test files were read or inspected during this investigation.

---

## 4. Conclusion

The Adobe Acrobat verification error `"Error during signature verification. Adobe Acrobat error. Expected a dict object."` is directly caused by:

1. **Missing `/Resources << >>` in Appearance Form XObjects (`/AP /N`) and Image XObjects**:
   - In First-Signature Mode (`server/services/pnpkiSigningService.ts:1843`), `apStream` is created without `Resources: {}`.
   - In Incremental Mode (`server/services/pnpkiSigningService.ts:1230-1243`), `imgObjNum` and `smaskObjNum` are created without `/Resources << >>`.
   - Acrobat's signature verification engine inspects all XObjects in the appearance stream hierarchy and strictly expects a `/Resources` dictionary object.
2. **Invalid Signature Field Hierarchy for Dual-Copy DTR (`/Kids` on `/FT /Sig`)**:
   - When multiple signature rectangles are supplied for Copy 1 and Copy 2, the signing engine splits the signature field into an empty parent field with `/Kids` and two child widgets without `/FT /Sig` or `/AP`.
   - Adobe Acrobat's signature validator expects the field referenced in AcroForm `/Fields` to be a terminal Widget Annotation dictionary (`/Type /Annot /Subtype /Widget`) containing its own `/AP` appearance dictionary. It cannot resolve appearance properties on non-terminal signature fields.
3. **AcroForm `/DR` Parsing Vulnerability**:
   - `extractBalancedDict` in `appendSignatureIncremental` fails when `/DR` is an indirect object reference (`/DR 15 0 R`), corrupting the AcroForm resource dictionary.

### Recommended Fix Strategy (for Implementer Agent)

#### Change 1: Add `Resources: {}` to All Appearance Form XObjects
In `server/services/pnpkiSigningService.ts`:
- First-Signature Mode (around line 1843):
  ```typescript
  // BEFORE:
  const apStream = pdfDoc.context.stream("q\nQ\n", {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, rw, rh],
  });

  // AFTER:
  const apStream = pdfDoc.context.formXObject([], {
    BBox: [0, 0, rw, rh],
    Resources: {},
  });
  ```
- Incremental Mode:
  Ensure `apNum` always has a valid `/Resources << ... >>` dictionary, even when `imgResourceEntry` is empty.

#### Change 2: Add `/Resources << >>` to Image XObjects in Incremental Mode
In `server/services/pnpkiSigningService.ts` lines 1230–1243:
```typescript
// Add /Resources << >> to smaskObjNum and imgObjNum dictionaries:
appendObj(
  smaskObjNum,
  `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceGray\n/BitsPerComponent 8\n/Resources << >>\n/Filter /FlateDecode\n/Length ${defAlpha.length}\n>>\nstream\n${defAlpha.toString("binary")}\nendstream`
);

appendObj(
  imgObjNum,
  `<<\n/Type /XObject\n/Subtype /Image\n/Width ${imgW}\n/Height ${imgH}\n/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Resources << >>\n${smaskEntry}/Filter /FlateDecode\n/Length ${defRGB.length}\n>>\nstream\n${defRGB.toString("binary")}\nendstream`
);
```

#### Change 3: Enforce Direct Terminal Fields for Signature Widgets (Eliminate `/Kids` on `/FT /Sig`)
- In First-Signature Mode (lines 1680–1893):
  - Retain the page canvas drawing loop (lines 1740–1840) so BOTH Copy 1 and Copy 2 receive the visual DigiSigned stamp, handwritten signature, and certificate typography.
  - Create a SINGLE merged terminal field (`/Type /Annot /Subtype /Widget /FT /Sig /Rect ... /V ... /T ... /AP ...`) bound to the primary signature box (`widgetRects[0]`).
  - Do NOT create `parentFieldRef` or `/Kids`. Add `widgetRef` directly to `annotations` and `rootFieldRefs`.
- In Incremental Mode (lines 1275–1393):
  - Generate a single terminal field (`wNum`) bound to `uniqueRects[0]`.
  - Eliminate the `isMultiWidget` branch that created `parentFieldNum` with `/Kids`.

#### Change 4: Robust AcroForm `/DR` Parsing
In `server/services/pnpkiSigningService.ts` lines 1121–1132:
Check for indirect reference first:
```typescript
const drRefMatch = afBody.match(/\/DR\s+(\d+\s+0\s+R)/);
if (drRefMatch) {
  existingDR = drRefMatch[1]; // indirect reference
} else {
  const drIdx = afBody.indexOf("/DR");
  if (drIdx !== -1) {
    existingDR = extractBalancedDict(afBody, drIdx) || "";
  }
}
```
And at line 1401:
```typescript
const drEntry = existingDR
  ? (existingDR.endsWith("R") ? `/DR ${existingDR}\n` : `/DR ${existingDR}\n`)
  : `/DR << /Font << /Helv ${fontObjNum} 0 R >> >>\n`;
```

#### Change 5: Synchronize Across Repositories
Apply identical modifications to:
1. `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\server\services\pnpkiSigningService.ts`
2. `c:\Users\Ace\Desktop\Project\D-monitoring\d-monitoring\server\services\pnpkiSigningService.ts`
3. `c:\Users\Ace\Desktop\Project\DICT Sys\dict-dtr-generator\server\services\pnpkiSigningService.ts`

---

## 5. Verification Method

To independently verify the fix:

1. **Structure Inspection**:
   Run node script to inspect generated PDF objects:
   ```powershell
   node -e "const fs = require('fs'); const buf = fs.readFileSync('scratch/test_pass2_fixed.pdf'); const str = buf.toString('latin1'); console.log('Kids count on Sig:', (str.match(/\/FT\s*\/Sig[\s\S]*?\/Kids/g) || []).length); console.log('Form XObjects without Resources:', (str.match(/\/Subtype\s*\/Form(?![^>]*\/Resources)/g) || []).length);"
   ```
   **Expected result**: `0` for both checks.

2. **Acrobat Opening & Signature Verification**:
   Launch Adobe Acrobat DC with the generated signed DTR:
   ```powershell
   Start-Process 'C:\Program Files\Adobe\Acrobat DC\Acrobat\Acrobat.exe' -ArgumentList '\"<path_to_signed_dtr.pdf>\"'
   ```
   Inspect open windows:
   ```powershell
   Get-Process -Name Acrobat | ForEach-Object { $_.MainWindowTitle }
   ```
   **Expected result**:
   - The document opens cleanly without displaying the modal popup `"Error during signature verification. Adobe Acrobat error. Expected a dict object."`.
   - The Signatures drawer displays `"Rev. 1: Signed by [Signer Name]"` with valid signature properties.

3. **Both Single DTR and Combine DTR**:
   - Generate a single DTR through DTR Generator (`server/routes/dtrGenerator.ts`).
   - Generate a combined DTR through Combine DTR (`src/pages/AceDtrCombiner.tsx` / `reneJaneAutoSign.ts`).
   - Verify both outputs validate cleanly in Adobe Acrobat.
