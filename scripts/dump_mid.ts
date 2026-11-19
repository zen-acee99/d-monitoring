import fs from 'fs';
const buf = fs.readFileSync("scratch/debug_abstract.pdf");
const str = buf.toString("binary");
console.log(str.slice(771500, 773000));
