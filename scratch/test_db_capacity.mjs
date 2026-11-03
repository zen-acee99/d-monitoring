import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  const pcRes = await db.execute("PRAGMA page_count;");
  const psRes = await db.execute("PRAGMA page_size;");
  const flRes = await db.execute("PRAGMA freelist_count;");

  const pageCount = Number(pcRes.rows[0].page_count);
  const pageSize = Number(psRes.rows[0].page_size);
  const freelistCount = Number(flRes.rows[0].freelist_count);

  const totalAllocatedBytes = pageCount * pageSize;
  const freelistBytes = freelistCount * pageSize;
  const activeDataBytes = (pageCount - freelistCount) * pageSize;

  console.log("=== TURSO DATABASE METRICS ===");
  console.log(`Page Size:          ${pageSize} bytes`);
  console.log(`Total Pages:        ${pageCount}`);
  console.log(`Freelist Pages:     ${freelistCount}`);
  console.log(`Allocated Size:     ${(totalAllocatedBytes / (1024 * 1024)).toFixed(2)} MB (${totalAllocatedBytes} bytes)`);
  console.log(`Active Data Size:   ${(activeDataBytes / (1024 * 1024)).toFixed(2)} MB (${activeDataBytes} bytes)`);
  console.log(`Freelist Size:      ${(freelistBytes / (1024 * 1024)).toFixed(2)} MB (${freelistBytes} bytes)`);

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  console.log("\n=== TABLE ROW COUNTS ===");
  for (const t of tables.rows) {
    const tableName = t.name;
    const cnt = await db.execute(`SELECT COUNT(*) as c FROM ${tableName}`);
    console.log(`${tableName.padEnd(25)} : ${cnt.rows[0].c} rows`);
  }
}

main().catch(console.error);
