import fs from "fs";

const buf = fs.readFileSync("scratch/test_pov.pdf");
const str = buf.toString("latin1");

// Find all trailers
const trailers = [...str.matchAll(/trailer[\s\S]*?startxref/g)];
console.log(`Found ${trailers.length} trailers:`);
trailers.forEach((t, i) => console.log(`--- Trailer ${i} ---\n${t[0]}`));

// Find /Root references
const roots = [...str.matchAll(/\/Root\s+(\d+)\s+(\d+)\s+R/g)];
console.log("Root refs:", roots.map(r => `${r[1]} ${r[2]} R`));

// Find the objects for those roots
for (const r of roots) {
  const objNum = r[1];
  const objRegex = new RegExp(`${objNum}\\s+0\\s+obj[\\s\\S]*?endobj`);
  const match = str.match(objRegex);
  console.log(`=== Object ${objNum} 0 obj ===\n${match ? match[0] : "NOT FOUND"}`);
}

const obj16 = str.match(/16\s+0\s+obj[\s\S]*?endobj/);
console.log("=== Object 16 0 obj ===");
console.log(obj16 ? obj16[0] : "NOT FOUND");

// Also check all xref sections
const xrefs = [...str.matchAll(/xref\s+0\s+\d+[\s\S]*?(?=trailer)/g)];
console.log(`Found ${xrefs.length} xrefs`);
xrefs.forEach((x, i) => console.log(`--- Xref ${i} ---\n${x[0]}`));
