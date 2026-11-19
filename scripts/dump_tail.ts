import fs from 'fs';

const buf = fs.readFileSync("scratch/debug_abstract.pdf");
const str = buf.toString("binary");
console.log("=== Last 3000 bytes ===");
console.log(str.slice(-3000));
