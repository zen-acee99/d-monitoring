const fs = require('fs');
const zlib = require('zlib');
const { PDFDocument, PDFName, PDFArray } = require('pdf-lib');

function decodePageTextWithCMaps(pdfDoc, page, pageContentsStr) {
  const pdfFullStr = pdfDoc.context.toString(); // or search context
  // Extract all CMaps from pdfDoc context
  const cmap = new Map();
  // Find all stream objects in context
  const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
  for (const [ref, obj] of indirectObjects) {
    if (obj && obj.getContents) {
      let text = '';
      try { text = zlib.inflateSync(Buffer.from(obj.getContents())).toString('latin1'); }
      catch { text = Buffer.from(obj.getContents()).toString('latin1'); }
      if (text.includes('beginbfchar') || text.includes('beginbfrange')) {
        const charMatches = text.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);
        for (const cm of charMatches) {
          cmap.set(cm[1].toUpperCase().padStart(4, "0"), String.fromCharCode(parseInt(cm[2], 16)));
        }
        const rangeMatches = text.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);
        for (const rm of rangeMatches) {
          const start = parseInt(rm[1], 16);
          const end = parseInt(rm[2], 16);
          let dst = parseInt(rm[3], 16);
          for (let code = start; code <= end; code++) {
            cmap.set(code.toString(16).toUpperCase().padStart(4, "0"), String.fromCharCode(dst));
            dst++;
          }
        }
      }
    }
  }

  // Now replace hex strings <0029...> in pageContentsStr
  let decoded = pageContentsStr.replace(/<([0-9a-fA-F]{4,})>/g, (_, hex) => {
    let out = "";
    for (let i = 0; i < hex.length; i += 4) {
      const key = hex.substring(i, i + 4).toUpperCase();
      if (cmap.has(key)) out += cmap.get(key);
      else {
        // try direct ascii hex
        try {
          const code = parseInt(key, 16);
          if (code >= 32 && code <= 126) out += String.fromCharCode(code);
          else out += " ";
        } catch { out += " "; }
      }
    }
    return `(${out})`;
  });

  return decoded;
}

async function test(filePath) {
  console.log('=== Testing', filePath, '===');
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPage(0);
  const contents = page.node.lookup(PDFName.of('Contents'));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let pageContentsStr = "";
  for (const ref of refs) {
    const stm = pdfDoc.context.lookup(ref);
    if (stm && stm.getContents) {
      try { pageContentsStr += zlib.inflateSync(Buffer.from(stm.getContents())).toString('latin1') + "\n"; }
      catch { pageContentsStr += Buffer.from(stm.getContents()).toString('latin1') + "\n"; }
    }
  }

  const decoded = decodePageTextWithCMaps(pdfDoc, page, pageContentsStr);
  console.log('Decoded length:', decoded.length);
  const lines = decoded.split('\n').filter(l => l.includes('Digitally') || l.includes('Malto') || l.includes('Buena') || l.includes('Rene') || l.includes('Ace'));
  console.log('Matching lines in decoded text:');
  lines.forEach(l => console.log(' ', l.trim()));
}

(async () => {
  await test('scratch/clean_original_ace_dtr.pdf');
  await test('scratch/current_dtr.pdf');
  await test('public/DTR_Ace_M._Malto_September_2026.pdf');
})();
