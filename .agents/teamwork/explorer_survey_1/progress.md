# Progress - explorer_survey_1

Last visited: 2026-11-11T16:28:30Z

## Status: Investigation Complete, Writing Handoff Report
- [x] Initialized DISPATCH.md and BRIEFING.md
- [x] Read ORIGINAL_REQUEST.md and analyzed reference screenshot `media_1794401102272_2e3562e6.png`
- [x] Traced PDF signing workflow entry points:
  - Frontend: `src/pages/SigningWorkspace.tsx` (`signDocumentItem`, `handleSignSingle`, `handleFiles`)
  - Utility pipeline: `src/utils/dtrVectorPdf.ts` (`signUploadedPersonnelPdfBytes`, `scanPdfForSigners`, `findPersonnelSignatureCoordinates`)
  - API Client: `src/services/api.ts` (`dtrGeneratorApi.signPdfDocument`)
  - Backend Endpoint: `server/routes/dtrGenerator.ts` (`POST /api/dtr-generator/sign-pdf`)
  - Cryptographic Engine: `server/services/pnpkiSigningService.ts` (`signPdfBuffer`, `appendSignatureIncremental`, `getSignerIdentityFromP12`)
- [x] Traced active P12 keystore profile loading and certificate CN extraction:
  - Keystore table in Turso: `dtr_generator` (fields: `p12`, `p12_password`, `image_digiSigned`, `Name`)
  - Active profile state in `SigningWorkspace.tsx`: `activeKeystoreProfile`
  - Extraction via `node-forge` in `pnpkiSigningService.ts`: `getSignerIdentityFromP12` (X.509 subject `CN`)
- [x] Analyzed signatory identification logic and box placement:
  - `scanPdfForSigners` sorts by `b.y - a.y` descending, inappropriately picking top-most supervisor (`NORLY A. TABO`) as `primaryPersonnel`
  - `SigningWorkspace.tsx` saves `targetPersonnel = scan.primaryPersonnel`
  - `findPersonnelSignatureCoordinates` clusters lines and finds coordinates directly above target name
  - Heuristic fallback in `findPersonnelSignatureCoordinates` picks the first `Printed Name` label via `Array.prototype.find`, landing in the wrong section
- [x] Identified root cause of binding to keystore CN vs document signatory:
  - Conflation of cryptographic identity with document layout signatory in `server/routes/dtrGenerator.ts` (lines 656-669)
  - `signDocumentItem` target selection order (`signerInDocSigners || doc.targetPersonnel || ...`) defaults to `doc.targetPersonnel` ("NORLY A. TABO") when `signerToMatch` (Annabel) is not in required signers
  - `!asSigner` guard on line 4396 prevents Regional Director override when signing via active keystore
  - UI lacks granular "Sign for Signatory" targeting on multi-signatory forms
- [x] Documented data structures, request payloads, and cryptographic dictionaries
- [x] Formulated comprehensive architectural fixes and verification plan
- [/] Writing handoff report at `.agents/teamwork/explorer_survey_1/handoff.md`
