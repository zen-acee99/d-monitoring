# Handoff Report: PDF Specification and Signing Investigation

## Observation
- PDF Samples found in: `c:\Users\Ace\Desktop\Project\DICT Sys\dict-monitoring\.agents\teamwork\spec_miner_survey_sign\samples\`
  - `irosin.pdf` (506KB)
  - `labo_signed.pdf` (597KB)
  - `sta_elena.pdf` (503KB)
  - `sta_elena_signed_test.pdf` (598KB)
- PDF signing service: `server/services/pnpkiSigningService.ts`.
- Libraries: `pdf-lib`, `node-forge`, `@signpdf/signpdf`, `@signpdf/signer-p12`, `zlib`.
- Certificate discovered: `scratch/rene_jane.p12`.
- `pnpkiSigningService.ts` contains:
  - `encryptP12Password`/`decryptP12Password` using AES-256-GCM.
  - `getSignerIdentityFromP12` using `node-forge` to parse PKCS#12 bags.
  - `parsePdfObjects`, `extractPageContentStreamBytes`, `loadPageFontCMaps` for PDF structure traversal and extraction.
  - `fixMojibake` to address character encoding issues specifically with 'ñ', 'Ñ', 'é', etc.
  - `normalizeSignatureBoundingBox` for PDF widget positioning.

## Logic Chain
1.  Target files were identified in the project's agent metadata folder (`samples`).
2.  Codebase investigation revealed `pnpkiSigningService.ts` as the central module for PDF signing and PKCS#12 handling.
3.  The service uses `node-forge` for ASN.1/PKCS#12 decoding and `pdf-lib` for document manipulation.
4.   Mojibake fixes are implemented directly in the service to handle common encoding mismatches (Mojibake) in signer names.
5.  Signature coordinates are normalized to guarantee minimum visual stamp bounds (min 125pt width, 26pt height).

## Caveats
- The investigation did not perform full PDF structure validation on all sample files due to complexity.
- Certificate `scratch/rene_jane.p12` was found, but its password was not investigated.
- No exhaustive error log analysis was performed against the samples, only code analysis.

## Conclusion
The project implements a custom PDF signing service leveraging `signpdf` libraries and `pdf-lib` for structure manipulation. It has specific robust handling for character encoding (Mojibake) and signature placement normalization. Certificates are likely stored with encrypted passwords using AES-GCM.

## Verification Method
- Use the existing `test_sign_probe.ts` to exercise the parsing and coordinate extraction routines on the sample PDFs.
- Run the `pnpkiSigningService` logic with the discovered `rene_jane.p12` certificate in a controlled test environment.
