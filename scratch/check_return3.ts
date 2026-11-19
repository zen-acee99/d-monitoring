import fs from "fs";
const c = fs.readFileSync("server/services/pnpkiSigningService.ts", "utf8");
const lines = c.split("\n");
for (let i = 970; i < 1010; i++) {
  console.log(`Line ${i+1}: ${lines[i]}`);
}
