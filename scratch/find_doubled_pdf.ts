import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function checkFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  try {
    const bytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const page = pdfDoc.getPage(0);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const items = extractTextItemsFromContentStream(sBytes, fontCMaps);
    
    // Find all "Digitally signed" items
    const digi = items.filter(it => it.text.toLowerCase().includes('digitally') || it.text.toLowerCase().includes('digisigned'));
    // Group by x coordinate (Copy 1 vs Copy 2: Copy 1 is x < 300, Copy 2 is x >= 300)
    const copy1 = digi.filter(it => it.x < 300);
    const copy2 = digi.filter(it => it.x >= 300);
    
    console.log(`\n=== ${filePath} ===`);
    console.log(`Copy 1 digi items count: ${copy1.length}, Copy 2 digi items count: ${copy2.length}`);
    for (const it of digi) {
      console.log(`  [x=${it.x.toFixed(1)}, y=${it.y.toFixed(1)}] "${it.text}"`);
    }
  } catch (e: any) {
    // console.log('Error checking', filePath, e.message);
  }
}

async function main() {
  const list = [
    'public/DTR_Ace_M._Malto_September_2026.pdf',
    'c:/Users/Ace/Desktop/DTR_Ace_M._Malto_September_2026.pdf',
    'scratch/current_dtr.pdf',
    'scratch/ace_dtr_final_signed.pdf',
    'scratch/ace_dtr_perfect_signed.pdf',
    'scratch/uploaded_ace_dtr.pdf',
    'scratch/clean_original_ace_dtr.pdf',
    'c:/Users/Ace/Downloads/DTR_Form48_Ace_Mata_Malto_2026.pdf',
    'c:/Users/Ace/Downloads/DTR_Form48_Ace_Mata_Malto_2026 (10).pdf',
    'c:/Users/Ace/Downloads/DTR_Form48_Ace_Mata_Malto_2026 (9)_Signed_ReneJane.pdf',
    'c:/Users/Ace/Downloads/DTR-Malto(Sept_1_30).pdf',
    'c:/Users/Ace/Downloads/DTR-Malto-Sept.pdf',
    'c:/Users/Ace/Downloads/DTR_DELA_TORRE__RALPH_B__September_2026.pdf',
  ];
  for (const f of list) {
    await checkFile(f);
  }
}

main().catch(console.error);
