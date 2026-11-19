import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { db } from '../server/db.js';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf.js';

async function main() {
  const files = fs.readdirSync('scratch').filter(f => f.endsWith('.pdf'));

  for (const f of files) {
    const fullPath = path.join('scratch', f);
    try {
      const bytes = fs.readFileSync(fullPath);
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      for (let p = 0; p < doc.getPageCount(); p++) {
        const page = doc.getPage(p);
        const sBytes = extractPageContentStreamBytes(doc, page);
        const cmaps = loadPageFontCMaps(doc, page);
        const items = extractTextItemsFromContentStream(sBytes, cmaps);
        const hasAce = items.some(it => /malto|acemata|tabo/i.test(it.text));
        if (hasAce) {
          console.log(`\n=== Match in ${f} (page ${p + 1}) ===`);
          const matches = items.filter(it => /malto|acemata|tabo|baloloy|approved|printed name|signature|section d|chief|accountant|director/i.test(it.text));
          for (const m of matches) {
            console.log(`  "${m.text}" at (${Math.round(m.x)}, ${Math.round(m.y)})`);
          }
        }
      }
    } catch (e) {}
  }

  console.log('\n=== SQLITE TABLES AND SCHEMA ===');
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables.rows.map(r => r.name));
  for (const t of tables.rows) {
    const info = await db.execute(`PRAGMA table_info(${t.name})`);
    console.log(`Table ${t.name} cols:`, info.rows.map(r => r.name));
    const sample = await db.execute(`SELECT * FROM ${t.name} LIMIT 3`);
    console.log(`Table ${t.name} sample count:`, sample.rows.length);
    for (const s of sample.rows) {
      const c = { ...s };
      for (const k of Object.keys(c)) {
        if (typeof c[k] === 'string' && c[k].length > 60) {
          c[k] = c[k].substring(0, 30) + '... (' + c[k].length + ' chars)';
        }
      }
      console.log(`  `, c);
    }
  }
}

main().catch(console.error);
