## 2026-11-15T02:12:36Z
You are worker_m1_acrobat (teamwork_worker).
Your working directory is: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_m1_acrobat\
Your parent conversation ID: a1d81be9-1a5c-4cbf-a822-05c4ce7ad422

MANDATORY FIRST STEPS:
1. Read Authoritative User Request: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read Project Specification: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\PROJECT.md
3. Read Survey Reports for full context:
   - c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\spec_miner_survey_dtr\handoff.md
   - c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_survey_dtr_1\handoff.md
   - c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_survey_dtr_2\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

CRITICAL INTEGRITY CONSTRAINT:
Integrity mode: demo
The team must NOT: Read test source code to understand expected behaviour before implementing.
Do NOT read or inspect test files (e.g. in tests/ or any .test.ts / .spec.ts files). Rely strictly on authoritative specifications, production source code, and survey handoff findings.

EXCLUSIVE FILE WRITE OWNERSHIP:
You own exclusively:
`c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\server\services\pnpkiSigningService.ts`
Do NOT modify files outside your write ownership.

Assigned Milestone: Milestone 1 — Core PDF Signature Engine Dictionary Repair
Tasks:
1. In `server/services/pnpkiSigningService.ts`:
   a. Appearance Form XObject in First-Signature Mode (`signPdfBuffer`, around line 1843):
      Add `Resources: {}` (or pass `Resources: pdfDoc.context.obj({})`) to `apStream` so it serializes with `/Resources << >>`.
   b. Appearance Image XObjects in Incremental Mode (`appendSignatureIncremental`, around line 1230-1243):
      Add `/Resources << >>\n` to `imgObjNum` and `smaskObjNum` dictionary definitions.
   c. Enforce Single Terminal Widget Signature Field Architecture (Eliminate `/Kids` on `/FT /Sig`):
      - In First-Signature Mode (`signPdfBuffer`, lines 1680–1893):
        Retain page canvas drawing for all rects in `widgetRects` (so Copy 1 & Copy 2 both receive visual stamps).
        Create a SINGLE terminal widget annotation (`/Type /Annot /Subtype /Widget /FT /Sig /Rect ... /V ... /T ... /AP ...`) bound to `widgetRects[0]`.
        Eliminate `parentFieldRef` and `/Kids`. Register `widgetRef` directly in `annotations` and `rootFieldRefs`.
      - In Incremental Mode (`appendSignatureIncremental`, lines 1275–1394):
        Generate a single terminal widget annotation (`wNum`) bound to `uniqueRects[0]`.
        Eliminate `isMultiWidget` branch creating `parentFieldNum` with `/Kids`.
   d. Safe Incremental Catalog Sanitization:
      In `appendSignatureIncremental` (around line 1444):
      Replace destructive global regex `cleanedCatalogBody = cleanedCatalogBody.replace(/>{2,}/g, "").trim();`
      with safe closing bracket removal: `cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();`.
   e. Robust AcroForm `/DR` & Indirect Reference Support:
      In `appendSignatureIncremental` (around lines 1121–1134 & line 1401):
      Check for indirect reference first (`/\/DR\s+(\d+\s+0\s+R)/`), and fallback to default Helvetica font dictionary if missing.
   f. Page `/Contents` Type Safety:
      In `signPdfBuffer` (around line 1828):
      Safely handle `Contents` whether it is a `PDFArray` or `PDFRawStream`.
2. Compile/Typecheck and Verify:
   Run TypeScript compilation check (`npm run build` or `npx tsc --noEmit` on server).
   Run verification script to verify that generated PDFs contain 0 `/Kids` on `/FT /Sig` and 0 Form XObjects without `/Resources`.
3. Document all changes, exact diffs, commands run, and verification results in:
   `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_m1_acrobat\handoff.md`
4. Update `progress.md` in your working directory and notify parent via send_message when complete.
