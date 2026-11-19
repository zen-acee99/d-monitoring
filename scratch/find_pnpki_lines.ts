import fs from "fs";
const content = fs.readFileSync("server/services/pnpkiSigningService.ts", "utf8");
const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("Digitally signed") || lines[i].includes("Helv") || lines[i].includes("Bold") || lines[i].includes("createVisualSignatureAppearance")) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
