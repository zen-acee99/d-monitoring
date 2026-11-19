import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function check() {
  const bytes = fs.readFileSync('c:/Users/Ace/Downloads/DTR_Malto-Nov(1-15).pdf');
  const pdfDoc = await PDFDocument.load(bytes);
  const targetPage = pdfDoc.getPage(0);
  const sBytes = extractPageContentStreamBytes(pdfDoc, targetPage);
  const fontCMaps = loadPageFontCMaps(pdfDoc, targetPage);
  const textItems = sBytes.length > 0 ? extractTextItemsFromContentStream(sBytes, fontCMaps) : [];
  const fullPageText = textItems.map((it) => it.text).join(" ").toUpperCase();

  console.log('fullPageText length:', fullPageText.length);
  console.log('BUENA RENE JANE:', fullPageText.includes("BUENA RENE JANE"));
  console.log('BUENA RENE JANE ROSENDO:', fullPageText.includes("BUENA RENE JANE ROSENDO"));
  console.log('DIGITALLY SIGNED BY BUENA:', fullPageText.includes("DIGITALLY SIGNED BY BUENA"));
  
  let hasSigFieldForBuena = false;
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    console.log('Form fields count:', fields.length);
    for (const f of fields) {
      const name = f.getName().toLowerCase();
      console.log('  field name:', f.getName());
      if (name.includes("supervisor") || name.includes("buena") || name.includes("renejane")) {
        hasSigFieldForBuena = true;
      }
    }
  } catch (e: any) {
    console.log('Form error:', e.message);
  }
  console.log('hasSigFieldForBuena:', hasSigFieldForBuena);

  // What else caused it? Let's check reneJaneAutoSign.ts lines 200-440!
}
check().catch(console.error);
