import fs from "fs";
import path from "path";

function search(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) search(full);
    else if (f.endsWith(".ts")) {
      const c = fs.readFileSync(full, "utf8");
      if (c.includes("pnpkiSigningService")) console.log(`Import in ${full}`);
    }
  }
}

search("server");
search("src");
