import { db } from "../server/db.js";
import fs from "fs";
import forge from "node-forge";

async function check() {
  console.log("=== CHECKING ALL TABLES IN DB ===");
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("Tables:", tables.rows.map(r => r.name));

  for (const t of tables.rows) {
    const tableName = t.name as string;
    try {
      const count = await db.execute(`SELECT count(*) as c FROM ${tableName}`);
      console.log(`Table ${tableName}: ${count.rows[0].c} rows`);
    } catch (e: any) {
      console.log(`Table ${tableName}: error ${e.message}`);
    }
  }

  // Check if any table contains Buena or Rene
  for (const t of tables.rows) {
    const tableName = t.name as string;
    try {
      const cols = await db.execute(`PRAGMA table_info(${tableName})`);
      const colNames = cols.rows.map(c => c.name as string);
      for (const col of colNames) {
        const match = await db.execute(`SELECT * FROM ${tableName} WHERE ${col} LIKE '%Buena%' OR ${col} LIKE '%Rene%' LIMIT 5`);
        if (match.rows.length > 0) {
          console.log(`Found match in ${tableName}.${col}:`, match.rows.length, "rows");
          for (const r of match.rows) {
            console.log("Row keys:", Object.keys(r));
            // Log non-blob details
            const summary: any = {};
            for (const [k, v] of Object.entries(r)) {
              if (typeof v === "string" && v.length > 100) {
                summary[k] = `[string len ${v.length}]`;
              } else {
                summary[k] = v;
              }
            }
            console.log("Details:", summary);
          }
        }
      }
    } catch {}
  }
}

check().catch(console.error);
