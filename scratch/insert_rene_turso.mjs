import { createClient } from "@libsql/client/web";
import { encryptP12Password } from "./pnpkiSigningService.mjs";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function run() {
  const p12Buf = fs.readFileSync("scratch/rene_jane.p12");
  const p12Base64 = p12Buf.toString("base64");
  const sigImgBuf = fs.readFileSync("scratch/rene_sig_correct.png");
  const sigImgDataUrl = "data:image/png;base64," + sigImgBuf.toString("base64");

  const encPw = encryptP12Password("1234567890Aa!");

  // Delete existing if any
  await db.execute({
    sql: "DELETE FROM dtr_generator WHERE id = ? OR user_Id = ?",
    args: ["dtr-sig-sup-01", "usr-mu72vs2b"]
  });

  // Insert Rene Jane
  await db.execute({
    sql: `INSERT INTO dtr_generator (
            id, user_Id, Name, p12, p12_filename, p12_filesize, p12_password, image_digiSigned, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    args: [
      "dtr-sig-sup-01",
      "usr-mu72vs2b",
      "Rene Jane R. Buena",
      p12Base64,
      "BUENA+RENE+JANE+ROSENDOSign.p12",
      p12Buf.length,
      encPw,
      sigImgDataUrl
    ]
  });

  console.log("Successfully inserted Rene Jane into Turso dtr_generator!");

  const check = await db.execute("SELECT id, user_Id, Name, p12_filename, p12_filesize, length(image_digiSigned) as img_len FROM dtr_generator");
  console.table(check.rows);
}

run().catch(console.error);
