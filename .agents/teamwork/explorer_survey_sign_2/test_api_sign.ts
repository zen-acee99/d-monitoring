import { db } from "../../../server/db.js";
import { dtrGeneratorApi } from "../../../src/services/api.js";

async function main() {
  const docRes = await db.execute({
    sql: "SELECT id, file_name, status, target_personnel, required_signers, pdf_data FROM signing_workspace_documents WHERE file_name LIKE '%Elena%'",
    args: []
  });
  const doc = docRes.rows[0];
  const cleanPdf = String(doc.pdf_data).replace(/^data:.*?;base64,/, "");

  console.log("Calling dtrGeneratorApi.signPdfDocument...");
  try {
    const res = await fetch("http://localhost:3000/api/dtr-generator/sign-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdfBase64: cleanPdf,
        profileId: "dtr-sig-usr-muxedv66",
        user_Id: "usr-muxedv66",
        signerName: "ANNABEL C. ODOÑO-CALIMPONG",
        targetSignatory: "ANNABEL C. ODOÑO-CALIMPONG",
        sigRect: [57, 104, 152, 28],
        sigRects: [[57, 104, 209, 132]],
        pageIndex: 0
      })
    });
    console.log("HTTP status:", res.status);
    const json = await res.json();
    console.log("Response:", json);
  } catch (e) {
    console.error("Fetch failed (server might not be running on 3000):", e);
  }
}

main().catch(console.error);
