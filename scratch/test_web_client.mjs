import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const res = await client.execute("SELECT id, user_Id, Name, p12_filename FROM dtr_generator");
console.log("Connected via @libsql/client/web (pure HTTP, zero native threads):");
console.table(res.rows);
