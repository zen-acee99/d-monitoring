import fs from "fs";
import path from "path";

function searchServer(dir: string) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchServer(full);
    } else if (f.endsWith(".ts") || f.endsWith(".js")) {
      const c = fs.readFileSync(full, "utf8");
      if (c.includes("signing_workspace_documents") || c.includes("/api/pnpki/sign") || c.includes("sign-dtr")) {
        console.log(`Found in ${full}`);
      }
    }
  }
}

searchServer("server");
