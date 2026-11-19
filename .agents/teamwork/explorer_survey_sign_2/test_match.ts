import { matchNames, toCompactName, normalizeNameForMatch } from "../../../src/utils/dtrVectorPdf.js";

const name1 = "OdoÃ±o-Calimpong Annabel Cortez";
const name2 = "ANNABEL C. ODOÑO-CALIMPONG";

console.log("name1:", name1);
console.log("name2:", name2);
console.log("toCompactName(name1):", toCompactName(name1));
console.log("toCompactName(name2):", toCompactName(name2));
console.log("normalizeNameForMatch(name1):", normalizeNameForMatch(name1));
console.log("normalizeNameForMatch(name2):", normalizeNameForMatch(name2));
console.log("matchNames(name1, name2):", matchNames(name1, name2));
