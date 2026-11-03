import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const res = await client.execute("SELECT id, user_Id, Name, p12_filename, length(p12) as p12_len, length(image_digiSigned) as img_len FROM dtr_generator");
console.log("All rows in Turso DB dtr_generator (count: " + res.rows.length + "):");
console.table(res.rows);
