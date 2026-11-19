# Dispatch for worker_it2

## Mission
Implement the verified fixes for Defect 1 (Catalog trailing nested dictionary truncation in appendSignatureIncremental) and Defect 2 (Missing /Resources << >> on Pass 1 Image XObjects in signPdfBuffer) in `server/services/pnpkiSigningService.ts`, and synchronize the updated file across all three repositories (`dict-monitoring`, `dict-dtr-generator`, and `d-monitoring`).

## Mandatory Constraints
- DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
- Integrity mode: demo. The team must NOT: Read test source code to understand expected behaviour before implementing.
- Confine all code modifications strictly to `server/services/pnpkiSigningService.ts` in the three repositories. Do not modify unrelated files.

## Reference Documents
- ORIGINAL_REQUEST.md: `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\ORIGINAL_REQUEST.md`
- Explorer Reports:
  - `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_1\handoff.md`
  - `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_2\handoff.md`
  - `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_3\handoff.md`
- Adversarial Stress Harness: `scripts/adversarial_pnpki_stress_harness.ts`
- Isolated Tests: `scripts/test_viewer_preferences.ts`, `scripts/debug_image_xobjects.ts`


## 2026-11-15T03:11:59Z
You are `worker_it2`.
Working Directory: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_it2\
Project Root Workspace: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

INTEGRITY MODE: demo. The team must NOT: Read test source code to understand expected behaviour before implementing.

AUTHORITATIVE USER REQUEST:
Read `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\ORIGINAL_REQUEST.md` before starting work.
Also read `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_it2\DISPATCH.md`.

OBJECTIVE:
Implement the verified fixes for Iteration 2 defects in `server/services/pnpkiSigningService.ts` and synchronize across all three repositories (`dict-monitoring`, `dict-dtr-generator`, and `d-monitoring`).

DEFECT DETAILS & RESEARCH:
Read the Explorer reports and unified patch:
- `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_1\handoff.md`
- `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_1\pnpki_iteration2.patch`
- `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_2\handoff.md`
- `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_it2_3\handoff.md`

SUMMARY OF REQUIRED CODE CHANGES IN `server/services/pnpkiSigningService.ts`:
1. Change A: Add `countDictionaryBrackets` helper function near line 250 (next to `extractBalancedDict`):
```typescript
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
```

2. Change B: In `appendSignatureIncremental` (around lines 1448–1450), replace unconditional `replace(/>>\s*$/, "")`:
```typescript
    // Clean dangling >> if any safely without stripping nested dictionaries
    const { open: catOpen, close: catClose } = countDictionaryBrackets(cleanedCatalogBody);
    if (catClose > catOpen) {
      cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
    }
```

3. Change C: In `signPdfBuffer` (around lines 1894–1897, right before `const savedBytes = await pdfDoc.save({ useObjectStreams: false });`):
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

VERIFICATION REQUIREMENTS:
1. In `dict-monitoring`:
   - Run `npx tsx scripts/test_viewer_preferences.ts` (verify `/ViewerPreferences` retains closing `>>` and `/AcroForm` is at catalog root).
   - Run `npx tsx scripts/debug_image_xobjects.ts` (verify Pass 1 Image XObjects have `/Resources << >>`).
   - Run `npx tsx scripts/adversarial_pnpki_stress_harness.ts` (all 30 probes must PASS, 100%).
   - Run `npx tsx --test tests/adobeAcrobatSignatureCompliance.test.ts` (93/93 tests pass).
   - Run `npm run build` (must compile cleanly with 0 errors).
2. Synchronization:
   - Copy the exact updated `server/services/pnpkiSigningService.ts` to:
     - `c:\Users\Ace\Desktop\Project\DICT Sys\dict-dtr-generator\server\services\pnpkiSigningService.ts`
     - `c:\Users\Ace\Desktop\Project\D-monitoring\d-monitoring\server\services\pnpkiSigningService.ts`
   - Compute and document SHA-256 hash of `pnpkiSigningService.ts` across all three repos to confirm 100% byte-for-byte identity.
   - Run `npm run build` in `dict-dtr-generator` and `d-monitoring` (verify clean compilation).


## 2026-11-15T03:22:22Z
**Context**: Status check on Iteration 2 implementation in `server/services/pnpkiSigningService.ts`.
**Content**: Checking in on your progress regarding Steps 2-8. Please provide a brief update on which changes have been applied and current verification results.
**Action**: Reply with your current status and continue with your execution.
