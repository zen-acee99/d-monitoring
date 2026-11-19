import { createClient } from '@libsql/client/web';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const res = await client.execute("SELECT id, pdf_filename, remarks FROM dtr_storage WHERE remarks LIKE '%DE LEON%'");
  console.log(`Found ${res.rows.length} records with DE LEON in remarks:`);
  for (const r of res.rows) {
    console.log('-', r.id, r.pdf_filename);
    try {
      const parsed = JSON.parse(r.remarks);
      let changed = false;
      if (Array.isArray(parsed.requiredSigners)) {
        const prevLen = parsed.requiredSigners.length;
        parsed.requiredSigners = parsed.requiredSigners.filter(s => !s.toUpperCase().includes('DE LEON'));
        if (parsed.requiredSigners.length !== prevLen) changed = true;
      }
      if (Array.isArray(parsed.signers)) {
        const prevLen = parsed.signers.length;
        parsed.signers = parsed.signers.filter(s => !s.name?.toUpperCase().includes('DE LEON'));
        if (parsed.signers.length !== prevLen) changed = true;
      }
      if (parsed.targetPersonnel && parsed.targetPersonnel.toUpperCase().includes('DE LEON')) {
        parsed.targetPersonnel = parsed.requiredSigners?.[0] || 'ANNABEL C. ODOÑO-CALIMPONG';
        changed = true;
      }
      if (changed) {
        const updatedRemarks = JSON.stringify(parsed);
        await client.execute({
          sql: "UPDATE dtr_storage SET remarks = ? WHERE id = ?",
          args: [updatedRemarks, r.id],
        });
        console.log(`  ✓ Cleaned up remarks for ${r.id}`);
      }
    } catch (e) {
      console.warn(`  Failed parsing remarks for ${r.id}:`, e);
    }
  }
}

run().catch(console.error);
