import { db } from "../../../server/db.js";
import { safeLoadPdfDocument, extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream, findPersonnelSignatureCoordinates } from "../../../src/utils/dtrVectorPdf.js";

async function main() {
  const r = await db.execute({
    sql: "SELECT id, file_name, status, target_personnel, required_signers, pdf_data FROM signing_workspace_documents WHERE file_name LIKE '%Elena%'",
    args: []
  });
  if (r.rows.length === 0) {
    console.log("No Sta. Elena doc found");
    return;
  }
  const row = r.rows[0];
  console.log("Found doc:", row.file_name);
  console.log("Target personnel:", row.target_personnel);
  console.log("Required signers:", row.required_signers);
  console.log("Status:", row.status);

  const pdfData = String(row.pdf_data);
  const clean = pdfData.includes(",") ? pdfData.split(",")[1] : pdfData;
  const pdfBytes = Buffer.from(clean, "base64");
  console.log("PDF byte length:", pdfBytes.length);

  const pdfDoc = await safeLoadPdfDocument(pdfBytes);
  const pages = pdfDoc.getPages();
  console.log("Page count:", pages.length);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const cmaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, cmaps);
    console.log(`Page ${i + 1} text items count:`, items.length);
    const matching = items.filter(it => it.text.toUpperCase().includes("ANNABEL") || it.text.toUpperCase().includes("CALIMPONG") || it.text.toUpperCase().includes("ODO"));
    console.log(`Page ${i + 1} matching items:`, matching);
  }

  try {
    const coords = findPersonnelSignatureCoordinates(pdfDoc, String(row.target_personnel));
    console.log("Found coords:", coords);
  } catch (e) {
    console.error("findPersonnelSignatureCoordinates error:", e);
  }
}

main().catch(console.error);
