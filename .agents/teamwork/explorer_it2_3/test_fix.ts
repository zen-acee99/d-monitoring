import { PDFDocument, PDFRawStream, PDFDict, PDFName, PDFNumber, PDFString, PDFArray } from "pdf-lib";

function countDictionaryBrackets(str: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  let inString = false;
  let parenDepth = 0;
  let inComment = false;
  let inHex = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = i + 1 < str.length ? str[i + 1] : "";

    if (inComment) {
      if (ch === "\r" || ch === "\n") inComment = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) inString = false;
      }
      continue;
    }
    if (inHex) {
      if (ch === ">") inHex = false;
      continue;
    }
    if (ch === "%") { inComment = true; continue; }
    if (ch === "(") { inString = true; parenDepth = 1; continue; }
    if (ch === "<" && next === "<") { open++; i++; continue; }
    if (ch === "<" && next !== "<") { inHex = true; continue; }
    if (ch === ">" && next === ">") { close++; i++; continue; }
  }
  return { open, close };
}

function sanitizeCatalog(catalogBody: string): string {
  let cleanedCatalogBody = catalogBody.trim();
  cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");

  const firstDictOpen = cleanedCatalogBody.indexOf("<<");
  const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
  if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
    cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
  }

  // Safe dangling >> cleanup: ONLY strip trailing >> if close brackets exceed open brackets
  const { open, close } = countDictionaryBrackets(cleanedCatalogBody);
  if (close > open) {
    cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
  }

  return cleanedCatalogBody;
}

// Test Case 1: Trailing ViewerPreferences
const cat1 = `<<\n/Type /Catalog\n/Pages 2 0 R\n/ViewerPreferences << /FitWindow true >>\n>>`;
const res1 = sanitizeCatalog(cat1);
console.log("Test 1 (ViewerPreferences intact):", res1.endsWith(">>"), res1);

// Test Case 2: Trailing Perms (Probe A4)
const cat2 = `<<\n/Type /Catalog\n/Pages 2 0 R\n/Perms << >>\n>>`;
const res2 = sanitizeCatalog(cat2);
console.log("Test 2 (Perms intact):", res2.endsWith(">>"), res2);

// Test Case 3: Embedded >> in string
const cat3 = `<<\n/Type /Catalog\n/Title (Doc >> Ver 1)\n>>`;
const res3 = sanitizeCatalog(cat3);
console.log("Test 3 (Embedded string):", res3);

// Test Case 4: Corrupt extra dangling >>
const cat4 = `<<\n/Type /Catalog\n/Pages 2 0 R\n>> >>`;
const res4 = sanitizeCatalog(cat4);
console.log("Test 4 (Corrupt dangling stripped):", !res4.endsWith(">>"), res4);
