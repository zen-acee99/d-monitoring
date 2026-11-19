const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFArray } = require('pdf-lib');

async function testPdf(filePath) {
  console.log('=== Checking', filePath, '===');
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPages()[0];
  const existingContents = page.node.get(PDFName.of('Contents'));
  const refs = existingContents instanceof PDFArray ? existingContents.asArray() : [existingContents];
  let streamText = '';
  for (const ref of refs) {
    const stm = pdfDoc.context.lookup(ref);
    if (stm && stm.getContents) {
      const raw = Buffer.from(stm.getContents());
      let dec = '';
      try { dec = zlib.inflateSync(raw).toString('latin1'); } catch { dec = raw.toString('latin1'); }
      streamText += dec + '\n';
    }
  }
  console.log('streamText length:', streamText.length);
  console.log('has Digitally:', /Digitally/i.test(streamText));
  console.log('has DigiSigned:', /DigiSigned/i.test(streamText));
  console.log('has Ace:', /Ace/i.test(streamText));
  console.log('has Malto:', /Malto/i.test(streamText));
  console.log('has Buena:', /Buena/i.test(streamText));
  console.log('has Rene:', /Rene/i.test(streamText));
  
  // Show any Tj or TJ lines
  const lines = streamText.split('\n');
  const textLines = lines.filter(l => l.includes('Tj') || l.includes('TJ'));
  console.log('Total text operator lines in content stream:', textLines.length);
  console.log('Sample text lines:', textLines.slice(0, 10));
}

async function main() {
  await testPdf('scratch/clean_original_ace_dtr.pdf');
  await testPdf('scratch/current_dtr.pdf');
}
main().catch(console.error);
