import fs from 'fs';
import path from 'path';
import { db } from '../server/db.js';

async function main() {
  const result = await db.execute({
    sql: `SELECT id, file_name FROM signing_workspace_documents WHERE pdf_data IS NULL OR length(pdf_data) = 0`,
    args: []
  });
  console.log('Documents in Turso without PDF:', result.rows.length);

  const downloadFiles = fs.readdirSync('c:/Users/Ace/Downloads').filter(f => f.endsWith('.pdf'));
  console.log('PDFs in Downloads:', downloadFiles.length);

  let updatedCount = 0;
  for (const row of result.rows) {
    const docId = String(row.id);
    const docName = String(row.file_name);

    // Try exact match or fuzzy match
    let matchFile = downloadFiles.find(f => f.toLowerCase() === docName.toLowerCase());
    if (!matchFile) {
      // Try normalized match (ignoring diff numbers)
      const cleanDoc = docName.replace(/[\(\)\s_-]/g, '').toLowerCase();
      matchFile = downloadFiles.find(f => {
        const cleanF = f.replace(/[\(\)\s_-]/g, '').toLowerCase();
        return cleanDoc.includes(cleanF.slice(0, 15)) || cleanF.includes(cleanDoc.slice(0, 15));
      });
    }

    if (matchFile) {
      const fullPath = path.join('c:/Users/Ace/Downloads', matchFile);
      const fileBytes = fs.readFileSync(fullPath);
      const dataUrl = `data:application/pdf;base64,${fileBytes.toString('base64')}`;
      console.log(`Matching "${docName}" with "${matchFile}" (${fileBytes.length} bytes)`);

      await db.execute({
        sql: `UPDATE signing_workspace_documents SET pdf_data = ? WHERE id = ?`,
        args: [dataUrl, docId]
      });
      // Also update dtr_storage
      await db.execute({
        sql: `UPDATE dtr_storage SET pdf_data = ? WHERE id = ?`,
        args: [dataUrl, docId]
      }).catch(() => {});

      updatedCount++;
    } else {
      console.log(`No match on disk for: "${docName}" (id: ${docId})`);
    }
  }

  console.log(`Updated ${updatedCount} / ${result.rows.length} documents with real PDF data in Turso!`);
}

main().catch(console.error);
