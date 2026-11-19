import { db } from '../server/db.js';

async function test() {
  const testId = `test-api-doc-${Date.now()}`;
  const pdfData = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 test binary').toString('base64');
  
  // Call DB directly with same logic as route
  await db.execute({
    sql: `INSERT INTO signing_workspace_documents (
      id, file_name, file_size, uploaded_at, uploaded_by, status, target_personnel,
      required_signers, signers_matrix, scanned_info, pdf_data,
      province, section_division, notes, has_p12, signature_image,
      created_at, updated_at
    ) VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      uploaded_at = COALESCE(excluded.uploaded_at, signing_workspace_documents.uploaded_at),
      status = excluded.status,
      target_personnel = excluded.target_personnel,
      required_signers = excluded.required_signers,
      signers_matrix = excluded.signers_matrix,
      scanned_info = COALESCE(excluded.scanned_info, signing_workspace_documents.scanned_info),
      pdf_data = COALESCE(excluded.pdf_data, signing_workspace_documents.pdf_data),
      province = excluded.province,
      section_division = excluded.section_division,
      notes = excluded.notes,
      has_p12 = excluded.has_p12,
      signature_image = COALESCE(excluded.signature_image, signing_workspace_documents.signature_image),
      updated_at = CURRENT_TIMESTAMP`,
    args: [
      testId,
      'test.pdf',
      '1 KB',
      new Date().toISOString(),
      'Ace Malto',
      'pending',
      'ACE MALTO',
      '[]',
      '[]',
      null,
      pdfData,
      'Regional Office',
      'Regional Office V',
      'test note',
      0,
      null
    ]
  });

  const row = await db.execute({
    sql: `SELECT id, length(pdf_data) as len FROM signing_workspace_documents WHERE id = ?`,
    args: [testId]
  });
  console.log('Result:', row.rows[0]);

  // Clean up
  await db.execute({ sql: `DELETE FROM signing_workspace_documents WHERE id = ?`, args: [testId] });
}

test().catch(console.error);
