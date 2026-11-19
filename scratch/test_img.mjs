import { PDFDocument } from 'pdf-lib';

async function test() {
  const doc = await PDFDocument.create();
  const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABTSURBVGhD7c4xEQAgDMAwACeYwT/KqKDAvYn+2f3V27PvB4SIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIj4wAGm7x/hE5QcPgAAAABJRU5ErkJggg==';
  const img = await doc.embedPng(Buffer.from(pngB64, 'base64'));

  const bytes = await doc.save();
  const pdfStr = Buffer.from(bytes).toString('binary');
  console.log('--- Objects created by pdf-lib ---');
  for (const match of pdfStr.matchAll(/(\d+)\s+0\s+obj[\s\S]*?endobj/g)) {
    if (match[0].includes('/Subtype /Image') || match[0].includes('/Subtype/Image')) {
      console.log('Image obj:\n', match[0]);
    }
  }
}

test();
