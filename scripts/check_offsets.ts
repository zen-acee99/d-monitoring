import fs from 'fs';
const buf = fs.readFileSync("scratch/debug_abstract.pdf");
const str = buf.toString("binary");
const idx156 = str.indexOf("156 0 obj");
console.log("Index of '156 0 obj':", idx156);
const matchStartxref = str.lastIndexOf("startxref");
console.log("Last startxref index:", matchStartxref);
console.log(str.slice(matchStartxref));
