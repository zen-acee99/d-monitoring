import fs from "fs";

function checkFile(path: string) {
  if (!fs.existsSync(path)) return;
  const c = fs.readFileSync(path, "utf8");
  const lines = c.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Digitally signed") || lines[i].includes("certify on my honor")) {
      console.log(`${path}:${i+1}: ${lines[i].trim()}`);
    }
  }
}

checkFile("src/pages/DtrGenerator.tsx");
checkFile("src/pages/AceDtrCombiner.tsx");
checkFile("src/utils/dtrVectorPdf.ts");
