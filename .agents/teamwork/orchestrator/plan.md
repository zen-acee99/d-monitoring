# Orchestration Plan: PDF Signing Failure Resolution for Uploaded Documents

## Objective
Investigate and resolve the root causes of PDF signing failures in the DICT Monitoring app for uploaded documents (specifically including `Municipality of Sta. Elena ...`, `Municipality of Labo - L...`, `LTR-to-Irosin_eLGU Ref...`) and personnel names with special characters and hyphens (such as `ANNABEL C. ODOÑO-CALIMPONG`), ensuring robust, resilient signing across documents without throwing exceptions or entering failed states.

## Phases
1. **Phase 0: Survey & Discovery**
   - Investigator 1 (`explorer_survey_sign_1` - teamwork_explorer): Investigate document upload handling, signing route/controller, where pending documents are stored/loaded, and error logging/failure states for uploaded documents in DICT Monitoring app.
   - Investigator 2 (`explorer_survey_sign_2` - teamwork_explorer): Investigate personnel name matching, certificate/keystore matching, special character handling (Ñ, hyphens, accented characters, whitespace, case normalization) in `pnpkiSigningService.ts`, personnel database/service, and signature box placement.
   - Investigator 3 (`spec_miner_survey_sign` - teamwork_spec_miner): Mine specifications, document formats of pending documents (`Municipality of Sta. Elena ...`, `Municipality of Labo - L...`, `LTR-to-Irosin_eLGU Ref...`), PDF parsing/sanitizing errors, and existing workspace files/configuration.
   - Output: Synthesized findings into `PROJECT.md` Feature Inventory & Architecture.

2. **Phase 1: Milestone Decomposition & Architecture Definition**
   - Define exact milestones (e.g. Personnel & Certificate Matching Normalization, PDF Parsing/Sanitization & Error Handling, Uploaded Document Signing Pipeline Integration).
   - Define Interface Contracts and E2E Testing Plan.

3. **Phase 2: Dual Track Execution**
   - E2E Testing Track (`test_writer_e2e_sign`): Comprehensive 4-tier test suite covering varied documents, special characters, error paths.
   - Implementation Track (`teamwork_worker`): Fix root causes in signing pipeline.

4. **Phase 3: Gate Verification**
   - 2 Reviewers (`teamwork_reviewer`)
   - 2 Challengers (`teamwork_challenger`)
   - 1 Forensic Auditor (`teamwork_auditor`)

5. **Phase 4: Final Verification & Reporting**
   - End-to-end verification run on pending uploaded documents.
   - Handoff report and completion signal to Sentinel.
