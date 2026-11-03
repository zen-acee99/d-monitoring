import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function run() {
  const gen = await db.execute("SELECT * FROM dtr_generator");
  console.log("=== dtr_generator rows ===");
  for (const r of gen.rows) {
    console.log({
      id: r.id,
      user_Id: r.user_Id,
      Name: r.Name,
      p12_filename: r.p12_filename,
      p12_filesize: r.p12_filesize,
      has_p12: Boolean(r.p12),
      has_img: Boolean(r.image_digiSigned),
      p12_password: r.p12_password
    });
  }

  const setup = await db.execute("SELECT * FROM dtr_user_setup");
  console.log("\n=== dtr_user_setup rows ===");
  console.table(setup.rows.map(r => ({
    id: r.id,
    user_id: r.user_id,
    employee_name: r.employee_name,
    supervisor_name: r.supervisor_name,
    supervisor_title: r.supervisor_title
  })));

  const admin = await db.execute("SELECT * FROM administration");
  console.log("\n=== administration rows ===");
  console.table(admin.rows.map(r => ({
    id: r.id,
    name: r.name,
    position: r.position,
    email: r.email
  })));
}

run().catch(console.error);
