## 2026-11-11T16:50:58Z
You are worker_m3, an implementation worker.
Your working directory is: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_m3\
Your parent orchestrator conversation ID is: 5ee7ec7f-16de-426d-9d8c-fc37fd4b62c1

MANDATORY FIRST STEP:
Read c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\ORIGINAL_REQUEST.md before doing anything else.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have write permission ONLY for:
- `src/pages/SigningWorkspace.tsx`
- metadata files in your working directory (`c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_m3\`)
You MUST NOT edit any other production files or test files.

CONTEXT & SURVEY FINDINGS:
- Project architecture: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\PROJECT.md
- Completed handoffs:
  - Backend API: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_m1\handoff.md
  - Coordinate Resolution: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\worker_m2\handoff.md
  - Pipeline Survey: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_survey_1\handoff.md
  - Coordinate Survey: c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\explorer_survey_2\handoff.md

MISSION — Milestone 3: Frontend Signatory Targeting & Keystore Decoupling:
In `src/pages/SigningWorkspace.tsx`:
1. **Decouple Active Keystore Profile from Document Target Signatory**:
   - In `signDocumentItem` (around lines 4370–4430):
     - Support an explicit `targetSignatoryName?: string` on options. If specified, it takes precedence as `targetPersonnelName`.
     - When an active keystore profile is active (e.g., Annabel Cortez), `asSigner` is set.
     - Remove the `!asSigner` restriction on line 4396:
       `if (!isCounter && (!matchedRequiredSigner || !matchNames(matchedRequiredSigner, effectiveSignerName)))`
       so that Regional Director / Section D / approval matching is NEVER suppressed when signing via an active keystore profile!
     - When the document has an unfulfilled Section D / Regional Director / Approval signatory (e.g. "ACEMATA MALTO"), ensure `targetPersonnelName` resolves to that approval line rather than falling back to `doc.targetPersonnel` ("NORLY A. TABO").
     - Pass `targetSignatoryName: targetPersonnelName` into `signUploadedPersonnelPdfBytes(pdfBytes, targetPersonnelName, signatureImage, p12Options, { ...options, targetSignatoryName: targetPersonnelName })`.
2. **Granular Signatory Line Targeting in UI**:
   - Allow signing specific signatory lines when clicking on pending signer badges or actions.
   - When signing for "ACEMATA MALTO", explicitly pass `targetSignatoryName: "ACEMATA MALTO"`.
3. **Verification**:
   - Run typecheck: `npx tsc --noEmit`.
   - Run workspace tests: `npx tsx tests/signingWorkspaceOrderAndDownload.test.ts`.
   - Run existing placement tests: `npx tsx tests/pnpkiSignaturePlacement.test.ts`.

OUTPUT REQUIREMENTS:
- Update progress.md in your working directory as you work.
- Write handoff.md in your working directory with Observation, Logic Chain, Caveats, Conclusion, and Verification Method.
- Send a completion message to your parent orchestrator (Recipient: 5ee7ec7f-16de-426d-9d8c-fc37fd4b62c1).
