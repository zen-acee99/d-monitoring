import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: `SELECT id, pdf_filename, status, signer_name, employee_name, created_at, length(pdf_data) as pdf_len, remarks 
          FROM dtr_storage 
          ORDER BY created_at DESC 
          LIMIT 20`,
    args: []
  });

  console.log("Found rows in dtr_storage (sorted by created_at DESC):");
  for (let i = 0; i < rs.rows.length; i++) {
    const r = rs.rows[i];
    let rem: any = {};
    try {
      if (typeof r.remarks === 'string' && (r.remarks.startsWith('{') || r.remarks.startsWith('['))) {
        rem = JSON.parse(r.remarks);
      }
    } catch {}

    console.log(`\n[${i + 1}] ID: ${r.id}`);
    console.log(`    Filename: ${r.pdf_filename}`);
    console.log(`    Status: ${r.status}`);
    console.log(`    Created: ${r.created_at}`);
    console.log(`    Target: ${rem.targetPersonnel}`);
    console.log(`    RequiredSigners:`, rem.requiredSigners);
    console.log(`    Signers:`, (rem.signers || []).map((s: any) => `${s.name} (${s.status})`));
    console.log(`    Notes:`, rem.notes);
  }
}

main().catch(console.error);
