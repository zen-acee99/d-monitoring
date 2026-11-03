import { createClient } from "@libsql/client";
import fs from "fs";

const path1 = "c:/Users/Ace/Desktop/Project/DICT Sys/dict-dtr-generator/local.db";
console.log("dict-dtr-generator local.db exists:", fs.existsSync(path1));
if (fs.existsSync(path1)) {
  const db1 = createClient({ url: `file:${path1}` });
  const t = await db1.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("tables in dict-dtr-generator local.db:", t.rows.map(r => r.name));
  const r = await db1.execute("SELECT id, user_Id, Name, p12_filename FROM dtr_generator");
  console.table(r.rows);
}
