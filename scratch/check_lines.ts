import fs from "fs";
const c = fs.readFileSync("src/utils/dtrVectorPdf.ts", "utf8");
const lines = c.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("let empFontSize = 6.8")) {
    console.log(`Line ${i+1}: ${lines[i]}`);
  }
}
