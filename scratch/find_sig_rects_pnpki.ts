import fs from "fs";
const c = fs.readFileSync("server/services/pnpkiSigningService.ts", "utf8");
const lines = c.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("sigRect") || lines[i].includes("sigRects")) {
    console.log(`Line ${i+1}: ${lines[i].trim()}`);
  }
}
