// Test verification of Defect 1 fix
const catalogBodyWithViewerPrefs = `1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/ViewerPreferences << /FitWindow true >>
>>
endobj`;

function sanitizeCatalogOld(catalogBody: string): string {
  let cleanedCatalogBody = catalogBody.trim();
  cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");

  const firstDictOpen = cleanedCatalogBody.indexOf("<<");
  const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
  if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
    cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
  }

  // Old defective line:
  cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();

  return `<<\n${cleanedCatalogBody}\n/AcroForm 8 0 R\n>>`;
}

function sanitizeCatalogProposed(catalogBody: string): string {
  let cleanedCatalogBody = catalogBody.trim();
  cleanedCatalogBody = cleanedCatalogBody.replace(/^\d+\s+\d+\s+obj\s*/, "");

  const firstDictOpen = cleanedCatalogBody.indexOf("<<");
  const lastDictClose = cleanedCatalogBody.lastIndexOf(">>");
  if (firstDictOpen !== -1 && lastDictClose !== -1 && lastDictClose > firstDictOpen) {
    cleanedCatalogBody = cleanedCatalogBody.slice(firstDictOpen + 2, lastDictClose).trim();
  }

  // Proposed safe line:
  const openCount = (cleanedCatalogBody.match(/<</g) || []).length;
  const closeCount = (cleanedCatalogBody.match(/>>/g) || []).length;
  if (closeCount > openCount) {
    cleanedCatalogBody = cleanedCatalogBody.replace(/>>\s*$/, "").trim();
  }

  return `<<\n${cleanedCatalogBody}\n/AcroForm 8 0 R\n>>`;
}

console.log("=== OLD DEFECTIVE OUTPUT ===");
console.log(sanitizeCatalogOld(catalogBodyWithViewerPrefs));

console.log("\n=== PROPOSED SAFE OUTPUT ===");
console.log(sanitizeCatalogProposed(catalogBodyWithViewerPrefs));

// Verification of brackets
const oldOutput = sanitizeCatalogOld(catalogBodyWithViewerPrefs);
const oldOpen = (oldOutput.match(/<</g) || []).length;
const oldClose = (oldOutput.match(/>>/g) || []).length;
console.log(`Old brackets: << = ${oldOpen}, >> = ${oldClose} (Balanced: ${oldOpen === oldClose})`);

const newOutput = sanitizeCatalogProposed(catalogBodyWithViewerPrefs);
const newOpen = (newOutput.match(/<</g) || []).length;
const newClose = (newOutput.match(/>>/g) || []).length;
console.log(`New brackets: << = ${newOpen}, >> = ${newClose} (Balanced: ${newOpen === newClose})`);
