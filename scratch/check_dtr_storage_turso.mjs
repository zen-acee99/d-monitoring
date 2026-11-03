import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const info = await db.execute("PRAGMA table_info(dtr_storage)");
console.log("dtr_storage schema:");
console.table(info.rows);

const count = await db.execute("SELECT count(*) as c FROM dtr_storage");
console.log("dtr_storage row count:", count.rows[0].c);

const rows = await db.execute("SELECT * FROM dtr_storage");
console.log("dtr_storage rows:", rows.rows);
