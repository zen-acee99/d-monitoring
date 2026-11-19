import { db } from "../../../server/db.js";
import { decryptP12Password, signPdfBuffer } from "../../../server/services/pnpkiSigningService.js";
import { findPersonnelSignatureCoordinates, safeLoadPdfDocument } from "../../../src/utils/dtrVectorPdf.js";

async function main() {
  const docRes = await db.execute({
    sql: "SELECT id, file_name, status, target_personnel, required_signers, pdf_data FROM signing_workspace_documents WHERE file_name LIKE '%Irosin%'",
    args: []
  });
  const doc = docRes.rows[0];

  const p12Res = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66' OR user_Id = 'usr-muxedv66'",
    args: []
  });
  const p12Row = p12Res.rows[0];

  const plainPassword = decryptP12Password(String(p12Row.p12_password || ""));
  const cleanPdf = String(doc.pdf_data).replace(/^data:.*?;base64,/, "");
  const pdfBuffer = Buffer.from(cleanPdf, "base64");

  const pdfDoc = await safeLoadPdfDocument(pdfBuffer);
  const loc = findPersonnelSignatureCoordinates(pdfDoc, String(doc.target_personnel));

  console.log("Starting signPdfBuffer test for Irosin...");
  console.log("loc:", loc);

  try {
    const result = await signPdfBuffer(
      pdfBuffer,
      String(p12Row.p12),
      plainPassword,
      {
        reason: "Official Digital Signature - DICT Region V Signing Workspace",
        sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
        sigRects: loc.sigRects,
        pageIndex: loc.pageIndex,
        signatureImage: String(p12Row.image_digiSigned || ""),
        signerName: String(doc.target_personnel),
      }
    );
    console.log("Sign result success! Signed buffer size:", result.signedBuffer.length);
  } catch (err: any) {
    console.error("Sign failed with error:", err);
    console.error("Stack:", err.stack);
  }
}

main().catch(console.error);
