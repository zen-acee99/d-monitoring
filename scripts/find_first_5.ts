import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  const rs = await client.execute({
    sql: `SELECT id, pdf_filename, status, signer_name, employee_name, created_at, remarks 
          FROM dtr_storage 
          WHERE pdf_filename LIKE '%POV_2026_11_0111%'
             OR pdf_filename LIKE '%ABSTRACT_Vehicle_Rental%'
             OR pdf_filename LIKE '%DV_DICT_Region_V_Organic%'
             OR pdf_filename LIKE '%PAYROLL_DICT_Region_V_Organic%'
             OR pdf_filename LIKE '%NEW_TRAVEL_ORDER_FORM%'
          ORDER BY created_at DESC`,
    args: []
  });

  console.log(`Matched ${rs.rows.length} rows:`);
  for (const r of rs.rows) {
    let rem: any = {};
    try {
      if (typeof r.remarks === 'string' && (r.remarks.startsWith('{') || r.remarks.startsWith('['))) {
        rem = JSON.parse(r.remarks);
      }
    } catch {}
    console.log({
      id: r.id,
      filename: r.pdf_filename,
      status: r.status,
      created_at: r.created_at,
      target: rem.targetPersonnel,
      required: rem.requiredSigners,
      signers: (rem.signers || []).map((s: any) => `${s.name} (${s.status})`),
      notes: rem.notes
    });
  }
}

main().catch(console.error);
