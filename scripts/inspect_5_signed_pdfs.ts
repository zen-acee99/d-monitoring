import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';
import {
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
  detectExistingPdfSignatures,
  matchNames
} from '../src/utils/dtrVectorPdf';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function inspectPdfDoc(id: string) {
  const rs = await client.execute({
    sql: "SELECT id, pdf_filename, status, pdf_data, remarks FROM dtr_storage WHERE id = ?",
    args: [id]
  });
  if (rs.rows.length === 0) {
    console.log("Not found:", id);
    return;
  }
  const row = rs.rows[0];
  let rem: any = {};
  try { rem = JSON.parse(row.remarks as string); } catch {}

  console.log("\n=======================================================");
  console.log(`Document: ${row.pdf_filename} (${row.id})`);
  console.log(`Status: ${row.status}`);
  console.log(`Required Signers:`, rem.requiredSigners);
  console.log(`Signers:`, rem.signers);
  console.log(`Notes:`, rem.notes);

  let raw = row.pdf_data as string;
  if (!raw) {
    console.log("No pdf_data in record");
    return;
  }
  if (raw.includes(",")) raw = raw.split(",")[1];
  const pdfBytes = Buffer.from(raw, 'base64');
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  console.log(`Pages: ${pages.length}`);

  const existingSigs = detectExistingPdfSignatures(pdfDoc);
  console.log("Existing Signatures Count:", existingSigs.length);
  for (const sig of existingSigs) {
    console.log(`  Sig: "${sig.signerName}" on Page ${sig.pageIndex + 1}, isSigned: ${sig.isSigned}, rect: [${sig.rect.join(", ")}]`);
  }

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const cmaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, cmaps);

    const relevantNames = items.filter(it => 
      matchNames(it.text, "ANNABEL C. ODOÑO-CALIMPONG") ||
      matchNames(it.text, "LEAH B. DY") ||
      matchNames(it.text, "CHRISTIAN ROY MELAD") ||
      it.text.toUpperCase().includes("CALIMPONG") ||
      it.text.toUpperCase().includes("ANNABEL") ||
      it.text.toUpperCase().includes("APPROVED") ||
      it.text.toUpperCase().includes("CERTIFIED")
    );

    if (relevantNames.length > 0) {
      console.log(`  --- Page ${pIdx + 1} (${width.toFixed(1)} x ${height.toFixed(1)}) relevant texts:`);
      for (const rn of relevantNames) {
        console.log(`    [y=${rn.y.toFixed(1)}, x=${rn.x.toFixed(1)}] "${rn.text}"`);
      }
    }
  }
}

async function main() {
  // Let's inspect the top documents:
  // 1. DV_DICT_Region_V_Organic_Personnel_Year_End_Bonus_and_Cash_Gift.pdf
  await inspectPdfDoc('doc-upload-1794223582282-8-j69c');
  // 2. PAYROLL_DICT_Region_V_Organic_Personnel_Year_End_Bonus_and_Cash.pdf
  await inspectPdfDoc('doc-upload-1794223582282-7-82jg');
  // 3. NEW_TRAVEL_ORDER_FORM_TRAVEL_ORDER_IAA_SOR_D_SEP_7_TO_11_1signed.pdf
  await inspectPdfDoc('doc-upload-1794223582282-6-zhyd');
  // 4. ABSTRACT_Van_Rental_for_the_Conduct_of_the_2027_NICTHS_Workshop.pdf
  await inspectPdfDoc('doc-upload-1794223582281-1-fbat');
  // 5. POV_2026_11_0110_Van_Rental_for_the_Conduct_of_the_2027_NICTHS_Workshop.pdf
  await inspectPdfDoc('doc-upload-1794223582281-0-90hb');
}

main().catch(console.error);
