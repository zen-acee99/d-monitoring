function extractBalancedDict(str, startIndex) {
  const dictStart = str.indexOf("<<", startIndex);
  if (dictStart === -1) return null;
  let depth = 0;
  let i = dictStart;
  while (i < str.length) {
    if (str[i] === "<" && str[i + 1] === "<") {
      depth++;
      i += 2;
    } else if (str[i] === ">" && str[i + 1] === ">") {
      depth--;
      i += 2;
      if (depth === 0) {
        return str.slice(dictStart, i);
      }
    } else {
      i++;
    }
  }
  return null;
}

const catalogBody = `<</Dests 17 0 R/Type/Catalog/Lang(en)/AcroForm<</SigFlags 3/Fields[51 0 R 65 0 R]/DA(/Helv 0 Tf 0 g )/DR<</XObject<</FRM 49 0 R>>/Font<</ZaDb 53 0 R/Helv 52 0 R>>>>>>/Pages 16 0 R/ViewerPreferences<</Type/ViewerPreferences/DisplayDocTitle true>>>>`;

let cleaned = catalogBody.trim();
if (cleaned.startsWith("<<")) cleaned = cleaned.slice(2);
if (cleaned.endsWith(">>")) cleaned = cleaned.slice(0, -2);
cleaned = cleaned.replace(/\/AcroForm\s+\d+\s+0\s+R/g, "").trim();

const afIdx = cleaned.indexOf("/AcroForm");
if (afIdx !== -1) {
  const balanced = extractBalancedDict(cleaned, afIdx);
  if (balanced) {
    const dictStart = cleaned.indexOf(balanced, afIdx);
    cleaned = (cleaned.slice(0, afIdx) + cleaned.slice(dictStart + balanced.length)).trim();
  }
}

console.log("Cleaned:", cleaned);
console.log("Full catalog:");
console.log(`<<\n${cleaned}\n/AcroForm 76 0 R\n>>`);
