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

const v5 = `<</AcroForm<</DA(/Helv 0 Tf 0 g )/DR<</Font<</Helv 38 0 R/MyriadPro-Regular 44 0 R/ZaDb 39 0 R>>/XObject<</FRM 35 0 R>>>>/Fields[37 0 R 47 0 R 69 0 R 75 0 R 84 0 R]/SigFlags 3>>/Dests 15 0 R/Lang(en)/Metadata 45 0 R/Pages 14 0 R/Type/Catalog/Version/1.6/ViewerPreferences<</DisplayDocTitle true/Type/ViewerPreferences>>>>`;

let cleaned = v5.trim();
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
console.log(`<<\n${cleaned}\n/AcroForm 103 0 R\n>>`);
