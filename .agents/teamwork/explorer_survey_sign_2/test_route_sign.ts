import express from "express";
import { dtrGeneratorRouter } from "../../../server/routes/dtrGenerator.js";
import { db } from "../../../server/db.js";

async function main() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/api/dtr-generator", dtrGeneratorRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  console.log("Test server running on port:", port);

  const docRes = await db.execute({
    sql: "SELECT id, file_name, status, target_personnel, required_signers, pdf_data FROM signing_workspace_documents WHERE file_name LIKE '%Elena%'",
    args: []
  });
  const doc = docRes.rows[0];
  const cleanPdf = String(doc.pdf_data).replace(/^data:.*?;base64,/, "");

  console.log("Calling /api/dtr-generator/sign-pdf with Annabel credentials...");

  // Scenario 1: What client actually sends when user clicks sign as Annabel
  const payload1 = {
    pdfBase64: cleanPdf,
    profileId: "dtr-sig-usr-muxedv66",
    user_Id: "usr-muxedv66",
    signerName: "ANNABEL C. ODOÑO-CALIMPONG",
    targetSignatory: "ANNABEL C. ODOÑO-CALIMPONG",
    sigRect: [57, 104, 152, 28],
    sigRects: [[57, 104, 209, 132]],
    pageIndex: 0
  };

  const res1 = await fetch(`http://127.0.0.1:${port}/api/dtr-generator/sign-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload1)
  });

  console.log("Scenario 1 HTTP status:", res1.status);
  const body1 = await res1.json();
  console.log("Scenario 1 response success:", body1.success, "signerName:", body1.signerName, "error:", body1.error);

  server.close();
}

main().catch(console.error);
