import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

async function run() {
  const rows = await client.execute("SELECT id, user_Id, Name, p12_filename, p12_filesize, length(p12) as p12_len, length(image_digiSigned) as sig_len, p12_password FROM dtr_generator");
  console.log("dtr_generator rows count:", rows.rows.length);
  for (const r of rows.rows) {
    console.log(r);
  }
}
run();
