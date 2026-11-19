import fs from "fs";
const c = fs.readFileSync("src/pages/SigningWorkspace.tsx", "utf8");
const lines = c.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("scanPdfForSigners")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
