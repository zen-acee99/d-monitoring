import fs from "fs";

const buf = fs.readFileSync("scratch/test_pov.pdf");
const str = buf.toString("latin1");

// Look at the last 5000 characters of the file
console.log("=== Last 3000 chars of test_pov.pdf ===");
console.log(str.slice(-3000));
