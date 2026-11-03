import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import zlib from 'zlib';

async function extract(filePath) {
  const buf = fs.readFileSync(filePath);
  const doc = await PDFDocument.load(buf);
  const page = doc.getPages()[0];
  const contents = page.node.Contents();
  let fullText = '';
  const count = contents.size ? contents.size() : 1;
  for (let i = 0; i < count; i++) {
    const s = doc.context.lookup(contents.get ? contents.get(i) : contents);
    if (!s) continue;
    try {
      fullText += zlib.inflateSync(Buffer.from(s.getContents())).toString('latin1') + '\n';
    } catch {
      fullText += Buffer.from(s.getContents()).toString('latin1') + '\n';
    }
  }

  const ops = [];
  const lines = fullText.split('\n');
  let curPos = [0, 0];
  for (const l of lines) {
    const tmMatch = l.match(/([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+Tm/);
    if (tmMatch) {
      curPos = [parseFloat(tmMatch[5]), parseFloat(tmMatch[6])];
    }
    const tdMatch = l.match(/([\d\.\-]+)\s+([\d\.\-]+)\s+Td/);
    if (tdMatch) {
      curPos = [curPos[0] + parseFloat(tdMatch[1]), curPos[1] + parseFloat(tdMatch[2])];
    }
    const tjMatch = l.match(/\[(.*?)\]\s*TJ/) || l.match(/\((.*?)\)\s*Tj/);
    if (tjMatch) {
      const raw = tjMatch[1];
      const str = [...raw.matchAll(/\((.*?)\)/g)].map(m => m[1]).join('') || raw;
      ops.push({ x: curPos[0], y: curPos[1], text: str });
    }
  }

  ops.sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x);

  const lineGroups = [];
  for (const op of ops) {
    let g = lineGroups.find(lg => Math.abs(lg.y - op.y) < 3);
    if (!g) {
      g = { y: op.y, items: [] };
      lineGroups.push(g);
    }
    g.items.push(op);
  }
  lineGroups.sort((a, b) => b.y - a.y);
  console.log(`\n=================== ${filePath} ===================`);
  for (const g of lineGroups) {
    console.log('Y=' + g.y.toFixed(1) + ': ' + g.items.map(it => '(' + it.x.toFixed(1) + ') ' + it.text).join(' | '));
  }
}

await extract('C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf');
