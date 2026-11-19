# Handoff Report: PDF Signing Character Encoding Remediation

## 1. Observation
- **Root Cause Identified**: The application uses regex hacks (`fixMojibake`, `sanitizeForStandardPdf`) to correct Mojibake. 
- **Evidence**: `server/services/pnpkiSigningService.ts` (lines 370-390) and `src/pages/SigningWorkspace.tsx` (lines 151-160) explicitly contain hardcoded regex replacements to fix character misinterpretation.
- **Root Trigger**: `server/services/pnpkiSigningService.ts` (line 300: `pdfBuf.toString("latin1")`) and similar code in `parsePdfCMap` (line 551: `new TextDecoder("latin1")`) explicitly use `latin1` for decoding buffers that likely contain UTF-8 encoded text in the PDF stream.

## 2. Logic Chain
1.  The issue is fundamentally a character encoding mismatch (UTF-8 bytes being treated as Latin1).
2.  `latin1` (ISO-8859-1) treats every byte as a single character. If a UTF-8 multi-byte character (like 'ñ' in `ñ` which is `0xC3 0xB1`) is interpreted as Latin1, it becomes `Ã` `±`.
3.  The existing `fixMojibake` is simply a reverse-engineering attempt of this specific byte-interpretation mismatch.
4.  Removing `fixMojibake` and `sanitizeForStandardPdf` requires fixing the *source* of the misinterpretation.
5.  **Remediation**:
    - Change decoding of PDF content streams and CMaps from `latin1` to `utf8` in `pnpkiSigningService.ts`.
    - Ensure all string inputs in `SigningWorkspace.tsx` are treated consistently as UTF-8 when converted to `Uint8Array` for PDF creation.
    - If `pdf-lib` continues to have issues with standard fonts rendering extended Unicode, embed a Unicode-compliant font (e.g., standard `pdf-lib` font support or custom TTF embedding) to properly render characters like 'Ñ', 'ñ', 'é'.

## 3. Caveats
- I have not executed the build/run, only analyzed the codebase as requested.
- I have not implemented the font embedding; this is a recommendation for the implementing agent to ensure full rendering compatibility.

## 4. Conclusion
The "regex shortcut" approach is invalid. The signing pipeline must treat all text data as UTF-8 throughout the entire lifecycle (React app → Server → PDF lib). The fix involves removing the hacks and updating the decoding strategy to `utf8`.

## 5. Verification Method
1.  Run the application build command.
2.  Run the test suite (if available, otherwise manual check) using a document with personnel names containing `Ñ`, `ñ`, `é`, `ó`.
3.  Verify the PDF contains the correct characters, *not* the Mojibake versions (`Ã±`).
4.  Ensure `fixMojibake` and `sanitizeForStandardPdf` are completely removed from the codebase.
