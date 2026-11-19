import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes } from '../src/utils/dtrVectorPdf';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const p = doc.getPages()[1];
  const sBytes = extractPageContentStreamBytes(doc, p);
  const text = new TextDecoder('latin1').decode(sBytes);

  // Let's find BT ... ET blocks and print their full content
  const btBlocks = text.split('BT');
  console.log('BT blocks count:', btBlocks.length);
  for (let i = 0; i < btBlocks.length; i++) {
    const b = btBlocks[i];
    const etIdx = b.indexOf('ET');
    const blockContent = etIdx !== -1 ? b.substring(0, etIdx) : b;
    // Check if this block has our text or numbers
    if (blockContent.includes('429.') || blockContent.includes('324') || blockContent.includes('252') || blockContent.includes('306')) {
      console.log(`=== BT Block ${i} ===`);
      console.log(blockContent);
    }
  }
}

main().catch(console.error);
