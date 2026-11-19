# Progress — explorer_survey_2

Last visited: 2026-11-11T16:28:00Z
Current Status: Investigation complete. Preparing 5-component handoff report.

- [x] Read ORIGINAL_REQUEST.md
- [x] Initialized DISPATCH.md, BRIEFING.md, progress.md
- [x] Located PDF signing and coordinate resolution architecture across `src/pages/SigningWorkspace.tsx`, `src/utils/dtrVectorPdf.ts`, `server/services/pnpkiSigningService.ts`, and `server/routes/dtrGenerator.ts`.
- [x] Analyzed text anchor searching, CTM matrix tracking, vertical line parsing, and widget placement.
- [x] Analyzed visible DigiSigned stamp rendering vs cryptographic `/Sig` field placement (Form XObject `/AP /N` stream vs Widget Annotation `/Rect`).
- [x] Identified root causes of duplicate/stray signature widgets appearing above Norly A. Tabo and overlapping supervision text in Section A when signing for Acemata Malto in Section D.
- [x] Analyzed Section D vs Section A/Supervisor box geometry and detected line dividing boundaries (x=315.7 pt, y=269.3 pt).
- [x] Formulated generalized coordinate resolution and decoupled keystore-identity vs signatory-line architecture.
- [ ] Compile comprehensive handoff.md and notify parent.
