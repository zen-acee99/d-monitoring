import fs from "fs";

function checkFile(p: string) {
  if (!fs.existsSync(p)) return;
  const c = fs.readFileSync(p, "utf8");
  const lines = c.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("signPdfBuffer") || lines[i].includes("/api/pnpki/sign") || lines[i].includes("/api/sign-dtr") || lines[i].includes("applyDigitalSignature")) {
      console.log(`${p}:${i+1}: ${lines[i].trim()}`);
    }
  }
}

checkFile("src/pages/SigningWorkspace.tsx");
checkFile("server/routes/signingWorkspace.ts");
checkFile("server/index.ts");
