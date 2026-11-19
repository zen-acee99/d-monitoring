import fs from "fs";
import path from "path";

function searchDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (f !== "node_modules" && f !== ".git" && f !== "dist" && f !== "scratch") {
        searchDir(full);
      }
    } else if (f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".tsx")) {
      const c = fs.readFileSync(full, "utf8");
      if (c.includes("Helvetica-Bold") || c.includes("font-bold") || c.includes("Font-Bold") || c.includes("Helv-Bold")) {
        console.log(`Match in ${full}`);
      }
    }
  }
}

searchDir(".");
