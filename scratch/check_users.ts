import { db } from '../server/db';

async function test() {
  const adminRes = await db.execute({
    sql: `SELECT id, name, email, role, status FROM administration WHERE email LIKE '%acemm%' OR email LIKE '%ace.malto%'`,
    args: []
  });
  console.log('administration table:', adminRes.rows);

  const userRes = await db.execute({
    sql: `SELECT id, name, email, role, status FROM users WHERE email LIKE '%acemm%' OR email LIKE '%ace.malto%'`,
    args: []
  });
  console.log('users table:', userRes.rows);
}
test();
