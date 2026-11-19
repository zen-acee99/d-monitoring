import { db } from "../server/db";

async function main() {
  const adminRes = await db.execute({
    sql: "SELECT * FROM administration WHERE email LIKE '%acemm%' OR email LIKE '%ace.malto%'",
    args: [],
  });
  console.log("Administration users:", adminRes.rows);

  const usersRes = await db.execute({
    sql: "SELECT * FROM users WHERE email LIKE '%acemm%' OR email LIKE '%ace.malto%'",
    args: [],
  });
  console.log("Users table:", usersRes.rows);
}

main().catch(console.error);
