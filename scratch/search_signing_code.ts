import fs from "fs";

function checkCode(path: string) {
  if (!fs.existsSync(path)) return;
  const c = fs.readFileSync(path, "utf8");
  const lines = c.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("signing_workspace_documents") || lines[i].includes("findPersonnelSignatureCoordinates") || lines[i].includes("inspectPdfForSigners") || lines[i].includes("auto-sign")) {
      console.log(`${path}:${i+1}: ${lines[i].trim()}`);
    }
  }
}

checkCode("src/pages/SigningWorkspace.tsx");
checkCode("server/index.ts");
checkCode("server/routes/signingWorkspaceRoutes.ts");
