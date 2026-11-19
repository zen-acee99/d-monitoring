import { db } from "../server/db.js";

async function main() {
  try {
    const res = await db.execute(
      "SELECT id, user_Id, Name, p12_filename, LENGTH(p12) as p12_len, p12_password, LENGTH(image_digiSigned) as img_len FROM dtr_generator_signatures;"
    );
    console.log("SIGNATURE PROFILES IN TURSO:", res.rows);
  } catch (e) {
    console.error("ERR:", e);
  }
}
main();
