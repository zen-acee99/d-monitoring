import fs from "fs";

function search(file: string) {
  if (!fs.existsSync(file)) return;
  const c = fs.readFileSync(file, "utf8");
  if (c.includes("decryptP12Password")) console.log(`Found in ${file}`);
}

search("server/services/pnpkiSigningService.ts");
search("server/routes/dtrGenerator.ts");
search("server/utils/passwordUtils.ts");
