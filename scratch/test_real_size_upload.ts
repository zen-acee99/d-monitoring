import fs from 'fs';
import { db } from '../server/db.js';

async function main() {
  // Let's create a 1.2 MB dummy PDF
  const header = Buffer.from('%PDF-1.4\n%test\n');
  const body = Buffer.alloc(1.2 * 1024 * 1024, 0x20); // 1.2 MB spaces
  const footer = Buffer.from('\n%%EOF\n');
  const pdfBuf = Buffer.concat([header, body, footer]);
  
  console.log('PDF buffer size:', pdfBuf.length, 'bytes');
  const base64 = pdfBuf.toString('base64');
  const dataUrl = `data:application/pdf;base64,${base64}`;
  console.log('Data URL length:', dataUrl.length, 'chars');

  const testId = `test-large-${Date.now()}`;

  console.log('Attempting Turso execute...');
  const start = Date.now();
  try {
    const res = await db.execute({
      sql: `INSERT INTO signing_workspace_documents (
        id, file_name, file_size, uploaded_at, uploaded_by, status, target_personnel,
        required_signers, signers_matrix, scanned_info, pdf_data,
        province, section_division, notes, has_p12, signature_image,
        created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        testId,
        'LargeTest.pdf',
        '1.2 MB',
        'Ace Malto',
        'pending',
        'ACE MALTO',
        '[]',
        '[]',
        null,
        dataUrl,
        'Regional Office',
        'Regional Office V',
        'large test',
        0,
        null
      ]
    });
    console.log('Success in', Date.now() - start, 'ms!');
    
    // Check length in DB
    const check = await db.execute({
      sql: `SELECT id, length(pdf_data) as len FROM signing_workspace_documents WHERE id = ?`,
      args: [testId]
    });
    console.log('Saved len in Turso:', check.rows[0]);

    // Clean up
    await db.execute({ sql: `DELETE FROM signing_workspace_documents WHERE id = ?`, args: [testId] });
    console.log('Cleaned up');
  } catch (err: any) {
    console.error('Failed Turso execute in', Date.now() - start, 'ms:', err);
  }
}

main().catch(console.error);
