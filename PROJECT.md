# Project: PDF Signing Failure Resolution

## Architecture
- **Cryptographic PDF Signing Engine (`server/services/pnpkiSigningService.ts`)**:
  - Handles signature injection, PKCS#12 identity extraction (via `node-forge`), and PDF coordinate normalization.
  - Contains `fixMojibake` for handling diacritics/special characters in names.
- **Frontend Workspace (`src/pages/SigningWorkspace.tsx`)**:
  - Initiates signing; handles status updates (`failed`) to Turso database via `signing_workspace_documents` table.
- **Repository**: `dict-monitoring`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Uploaded Document Handling | Resolve failures in `signDocumentItem` pipeline | M1 | Survey |
| 2 | Special Character Robustness | Enhance Mojibake/Name normalization logic | M1 | Survey |
| 3 | Certificate/Identity Matching | Improve robust P12 parsing and matching | M1 | Survey |
| 4 | Error Visibility & Recovery | Enhance failure diagnostic logging for signatures | M2 | Survey |
| 5 | E2E Testing | Validate signing across varied document formats | M2 | Survey |

## Milestones
| # | Name | Scope | Status |
|---|------|-------|--------|
| M1 | Core Signing Engine Hardening | Implement robust encoding/normalization and error handling in `pnpkiSigningService.ts` & `SigningWorkspace.tsx` | PLANNED |
| M2 | Verification & Resilience | E2E validation with varied documents, failure recovery testing | PLANNED |
