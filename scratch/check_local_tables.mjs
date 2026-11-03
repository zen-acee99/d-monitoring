import { createClient } from "@libsql/client";

const localDb = createClient({ url: "file:local.db" });
const tables = await localDb.execute("SELECT name FROM sqlite_master WHERE type='table'");
console.log("local.db tables:", tables.rows.map(r => r.name));
