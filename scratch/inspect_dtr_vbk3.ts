import { db } from '../server/db';

async function test() {
  const res = await db.execute({
    sql: `SELECT id, user_id, employee_name, module, remarks, created_at FROM dtr_storage WHERE id = 'doc-upload-1794011790736-22-vbk3'`,
    args: []
  });
  console.log('dtr_storage row:', res.rows[0]);
}
test();
