const fs = require('fs');
const { PDFDocument, PDFName, PDFArray } = require('pdf-lib');
const zlib = require('zlib');

async function inspect(filePath) {
  console.log('=== Inspecting', filePath, '===');
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
  console.log('Page count:', pdfDoc.getPageCount());

  // Check AcroForm
  const acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
  if (acroForm) {
    const fields = acroForm.lookup(PDFName.of('Fields'));
    console.log('Fields count:', fields ? fields.size() : 0);
    for (let i = 0; i < fields.size(); i++) {
      const f = pdfDoc.context.lookup(fields.get(i));
      const t = f.lookup(PDFName.of('T'));
      console.log('  Field', i, 'T:', t ? t.toString() : 'none');
      const ap = f.lookup(PDFName.of('AP'));
      if (ap && ap.lookup) {
        const n = ap.lookup(PDFName.of('N'));
        if (n) {
          const stm = pdfDoc.context.lookup(n);
          if (stm && stm.getContents) {
            let str = '';
            try { str = zlib.inflateSync(Buffer.from(stm.getContents())).toString('latin1'); }
            catch { str = Buffer.from(stm.getContents()).toString('latin1'); }
            console.log('    AP /N:', str.replace(/\r?\n/g, ' '));
          }
        }
      }
    }
  }

  // Check Page Contents
  const page = pdfDoc.getPages()[0];
  const contents = page.node.lookup(PDFName.of('Contents'));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  console.log('Page contents streams count:', refs.length);
  refs.forEach((ref, idx) => {
    const stm = pdfDoc.context.lookup(ref);
    if (stm && stm.getContents) {
      let str = '';
      try { str = zlib.inflateSync(Buffer.from(stm.getContents())).toString('latin1'); }
      catch { str = Buffer.from(stm.getContents()).toString('latin1'); }
      console.log('Stream', idx, 'length:', str.length);
      const lines = str.split('\n').filter(l => l.includes('Digitally') || l.includes('DigiSigned') || l.includes('Buena') || l.includes('Rene') || l.includes('Malto') || l.includes('Ace'));
      console.log('Matching lines in stream', idx, ':', lines);
    }
  });
}

inspect('public/DTR_Ace_M._Malto_September_2026.pdf').catch(console.error);
