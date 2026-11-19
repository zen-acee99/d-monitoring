import fs from "fs";
const c = fs.readFileSync("server/services/pnpkiSigningService.ts", "utf8");
const lines = c.split("\n");
for (let i = 890; i < 925; i++) {
  console.log(`Line ${i+1}: ${lines[i]}`);
}
