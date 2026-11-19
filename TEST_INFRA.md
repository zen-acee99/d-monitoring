# E2E Test Infra: Adobe Acrobat Digital Signature Verification

## Test Philosophy
- Opaque-box, requirement-driven per ISO 32000-1 / PDF 1.7 digital signature specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.
- Acceptance criteria: 100% clean validation in Adobe Acrobat without "Expected a dict object" modal error, valid `/Type /Sig`, `/ByteRange`, `/Contents`, `/AP`, and terminal `/FT /Sig` widget structure.

## Feature Inventory & Test Mapping
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| 1 | Form XObject `/Resources` Dictionary (Pass 1) | ORIGINAL_REQUEST R1, AC §3 | 5 | 5 | ✓ |
| 2 | Image XObjects `/Resources` Dictionary (Pass 2+) | ORIGINAL_REQUEST R1, AC §3 | 5 | 5 | ✓ |
| 3 | Single Terminal Widget `/FT /Sig` Field | ORIGINAL_REQUEST R1, AC §3 | 5 | 5 | ✓ |
| 4 | Safe Incremental Catalog Update | ORIGINAL_REQUEST R1, AC §3 | 5 | 5 | ✓ |
| 5 | AcroForm `/DR` Indirect Reference Handling | ORIGINAL_REQUEST R1, AC §3 | 5 | 5 | ✓ |
| 6 | Page `/Contents` Type Safety | ORIGINAL_REQUEST R1, AC §3 | 5 | 5 | ✓ |
| 7 | Cross-Repository Synchronization | ORIGINAL_REQUEST R2, AC §4 | 5 | 5 | ✓ |
| 8 | Single & Combined DTR Compliance | ORIGINAL_REQUEST R1, AC §1, §4 | 5 | 5 | ✓ |

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Single CS Form 48 DTR First Signature (Personnel) | F1, F3, F6, F8 | Medium |
| 2 | Single CS Form 48 DTR Two-Pass Sequential Signing (Personnel + Supervisor) | F1, F2, F3, F4, F5, F8 | High |
| 3 | Multi-Document Combine DTR Signing (DTR + Accomplishment Report) | F1, F2, F3, F4, F7, F8 | High |
| 4 | Combined DTR with Special Signatory Characters / Parentheses | F1, F2, F3, F4, F5 | Medium |
| 5 | Dual-Copy CS Form 48 Direct Verification in Adobe Acrobat DC | F1, F2, F3, F4, F7, F8 | Critical |

## Coverage Thresholds
- Tier 1 (Feature Coverage): ≥5 tests per feature (≥40 tests)
- Tier 2 (Boundary & Corner Cases): ≥5 tests per feature (≥40 tests)
- Tier 3 (Cross-Feature Combinations): ≥8 tests covering major feature pairs
- Tier 4 (Real-World Scenarios): ≥5 application scenarios
- **Total Suite Target**: ≥93 test cases
