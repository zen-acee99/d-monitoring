import { createClient } from '@libsql/client/web';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function check() {
  const res = await client.execute("SELECT id, pdf_filename, remarks FROM dtr_storage WHERE id = 'doc-upload-1793951259505-99-wpd8'");
  if (res.rows.length > 0) {
    console.log('ID:', res.rows[0].id);
    console.log('Filename:', res.rows[0].pdf_filename);
    console.log('Remarks JSON:\n', JSON.stringify(JSON.parse(res.rows[0].remarks), null, 2));
  }
}
check().catch(console.error);
