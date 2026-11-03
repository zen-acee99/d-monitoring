import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const res = await client.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01' OR user_Id = 'usr-mu72vs2b'");
console.log("Found Rene in Turso dtr_generator:", res.rows.length);
if (res.rows.length > 0) {
  console.log(res.rows[0].id, res.rows[0].Name, res.rows[0].p12_filename);
}

const adminRes = await client.execute("SELECT id, name, email FROM administration WHERE name LIKE '%Buena%' OR email LIKE '%buena%' OR id = 'usr-mu72vs2b'");
console.log("Found Rene in administration:", adminRes.rows);

