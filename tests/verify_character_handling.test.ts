
import { toCompactName, matchNames } from "../src/utils/dtrVectorPdf";

console.log("Starting Character Handling Verification...");

const name1 = "ANNABEL C. ODOÑO-CALIMPONG";
const compact = toCompactName(name1);
console.log("Compact:", compact);
if (compact === "ANNABELCODONOCALIMPONG") {
    console.log("toCompactName test: PASS");
} else {
    console.error("toCompactName test: FAIL, expected ANNABELCODONOCALIMPONG, got", compact);
    process.exit(1);
}

const name2 = "ANNABEL C. ODONO-CALIMPONG";
const name3 = "ANNABEL C ODOÑO CALIMPONG";

if (matchNames(name1, name2) === true && matchNames(name1, name3) === true) {
    console.log("matchNames test: PASS");
} else {
    console.error("matchNames test: FAIL");
    process.exit(1);
}

console.log("All tests passed.");
