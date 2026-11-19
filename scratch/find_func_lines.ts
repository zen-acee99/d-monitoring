import fs from "fs";
const content = fs.readFileSync("src/utils/dtrVectorPdf.ts", "utf8");
const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("findPersonnelSignatureCoordinates")) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
