## 2026-11-17T12:43:28Z
Investigate certificate/key matching, personnel identity resolution, and special character handling in the DICT Monitoring app (dict-monitoring).
1. Look into how personnel names containing special characters, diacritics, and hyphens (specifically ANNABEL C. ODOÑO-CALIMPONG, Ñ, accents, etc.) are processed, sanitized, matched against certificates/p12 keystores, or passed into PDF signing functions.
2. Check how certificates/p12 keystores are retrieved, matched with personnel (common names, email, serial numbers, keystore filenames, or profile mappings).
3. Check how signature box coordinate resolution, text search, or OCR/text extraction handles special characters like Ñ vs N, hyphens, case differences, or UTF-8 / Latin-1 encoding issues in PDF strings.
4. Identify exact failure points and mismatches when signing for ANNABEL C. ODOÑO-CALIMPONG or other personnel names with special characters or hyphens.
5. Provide concrete file paths, line numbers, code snippets, and failure mechanism explanations.
