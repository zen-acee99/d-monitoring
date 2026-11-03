import { PDFDocument } from 'pdf-lib';
import fs from 'fs';

const dir = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/';
const files = [
  'media_1792146754498_709d256a.pdf',
  'media_1792146754505_0181b99c.pdf',
  'media_1792146754505_eda91b25.pdf',
  'media_1792147510132_24e68bb2.pdf',
  'media_1792147510144_81aae404.pdf',
  'media_1792148905764_429e9fc5.pdf',
  'media_1792148905769_9d48a41f.pdf',
];

for (const f of files) {
  const buf = fs.readFileSync(dir + f);
  const doc = await PDFDocument.load(buf);
  const p = doc.getPages()[0];
  console.log(f, 'size:', p.getWidth(), 'x', p.getHeight(), 'bytes:', buf.length);
}
