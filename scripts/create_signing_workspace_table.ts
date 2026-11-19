import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function main() {
  console.log("Creating signing_workspace_documents table in Turso...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS signing_workspace_documents (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_size TEXT,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      uploaded_by TEXT,
      status TEXT DEFAULT 'pending',
      target_personnel TEXT,
      required_signers TEXT,
      signers_matrix TEXT,
      scanned_info TEXT,
      pdf_data TEXT,
      province TEXT DEFAULT 'Regional Office',
      section_division TEXT DEFAULT 'Regional Office V',
      notes TEXT,
      has_p12 INTEGER DEFAULT 0,
      signature_image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sw_docs_status ON signing_workspace_documents(status);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sw_docs_uploaded_at ON signing_workspace_documents(uploaded_at);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_sw_docs_target ON signing_workspace_documents(target_personnel);`);

  console.log("Table signing_workspace_documents created successfully!");

  const info = await client.execute("PRAGMA table_info(signing_workspace_documents)");
  console.log("Columns:", info.rows.map(r => r.name));
}

main().catch(console.error);
