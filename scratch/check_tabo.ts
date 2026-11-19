import { db } from "../server/db.js";

async function main() {
  const r = await db.execute("SELECT id, user_Id, Name, length(p12) as p12_len, length(p12_password) as pw_len, length(image_digiSigned) as img_len FROM dtr_generator");
  console.log("dtr_generator rows:", r.rows);
}

main().catch(console.error);
