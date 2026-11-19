import { db } from "../../../server/db.js";

async function main() {
  const dtrGen = await db.execute(`
    SELECT id, user_Id, Name, p12_filename, p12_filesize, length(p12) as p12_len, length(image_digiSigned) as img_len 
    FROM dtr_generator
  `);
  console.log("=== dtr_generator ===");
  console.log(JSON.stringify(dtrGen.rows, null, 2));

  const admins = await db.execute(`
    SELECT id, name, email, role, pnpkiRole FROM administration
  `);
  console.log("=== administration ===");
  console.log(JSON.stringify(admins.rows, null, 2));
}

main().catch(console.error);
