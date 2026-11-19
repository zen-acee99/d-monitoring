# Handoff Report - explorer_survey_sign_2

## Observation
- Personnel name processing and certificate matching:
  - `src/services/pnpkiCertificateService.ts`: `inspectP12Keystore` extracts `commonName` directly from the certificate's subject attributes.
  - `src/utils/dtrVectorPdf.ts`: `toCompactName` normalizes names by removing diacritics and normalizing hyphens.
  - `src/pages/SigningWorkspace.tsx`: `matchNames` uses `toCompactName` to perform name comparison.
- PDF Text extraction and matching:
  - `src/utils/dtrVectorPdf.ts`: `scanPdfForSigners` extracts text from PDFs.
  - `sanitizeForStandardPdf` in `src/pages/SigningWorkspace.tsx` removes characters outside the `\x20-\x7E\xA0-\xFF` range, which may conflict with non-Latin-1 characters.

## Logic Chain
1. `toCompactName` correctly normalizes names by removing diacritics, allowing `ODOÑO` to match `ODONO`.
2. Certificate identity matching depends on the exact `commonName` in the P12 file. If `node-forge` does not parse the CN as the application expects (e.g., encoding issues), `matchNames` may fail.
3. PDF signature box scan (`scanPdfForSigners`) relies on text clustering on baselines. If text extraction (`extractTextItemsFromContentStream`) returns fragmented text where `Ñ` is not recognized, or if the PDF text uses a different encoding for `Ñ` (e.g., as separate characters), clustering might still work, but subsequent matching with `matchNames` might fail if the extracted text does not match the normalized name.
4. `sanitizeForStandardPdf` is potentially over-aggressive in removing characters outside the ASCII/Latin-1 range.

## Caveats
- I did not run the code. All analysis is based on code inspection.
- The exact encoding used in the P12 files for `Ñ` is unknown.
- The exact PDF text stream representation of `Ñ` in the documents causing failures is unknown.

## Conclusion
- The system has mechanisms to handle special characters (`toCompactName`), but they rely on robust text extraction and `node-forge`'s certificate parsing.
- Failure points are likely:
  1. Inconsistent parsing of `commonName` from P12 files.
  2. Fragmented or corrupted text extraction from the PDF for names with diacritics/hyphens.
  3. `sanitizeForStandardPdf` stripping characters incorrectly.

## Verification Method
- Reproduce: Upload a test PDF with the specific name "ANNABEL C. ODOÑO-CALIMPONG" and a corresponding dummy P12 keystore.
- Verify: Observe the logs for matching results in `SigningWorkspace`.
- Debug: Inspect the output of `extractTextItemsFromContentStream` for the specific name.
