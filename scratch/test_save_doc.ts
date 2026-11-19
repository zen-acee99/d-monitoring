import { signingWorkspaceApi } from '../src/services/api';
import { db } from '../server/db.js';

async function main() {
  const testId = `test-doc-${Date.now()}`;
  const fakePdfData = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==';
  
  console.log('Direct DB insert test:');
  const res = await db.execute({
    sql: `INSERT INTO signing_workspace_documents (
      id, file_name, file_size, uploaded_at, uploaded_by, status, target_personnel,
      required_signers, signers_matrix, scanned_info, pdf_data,
      province, section_division, notes, has_p12, signature_image,
      created_at, updated_at
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [
      testId,
      'Test.pdf',
      '1 KB',
      'Test User',
      'pending',
      'TEST PERSONNEL',
      '[]',
      '[]',
      null,
      fakePdfData,
      'Regional Office',
      'Regional Office V',
      'test notes',
      0,
      null
    ]
  });
  console.log('DB execute result:', res);

  const check = await db.execute({
    sql: `SELECT id, file_name, length(pdf_data) as pdf_len FROM signing_workspace_documents WHERE id = ?`,
    args: [testId]
  });
  console.log('Check record:', check.rows[0]);

  // Clean up
  await db.execute({ sql: `DELETE FROM signing_workspace_documents WHERE id = ?`, args: [testId] });
}

main().catch(console.error);
