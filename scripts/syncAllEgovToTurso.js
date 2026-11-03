import dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import { EGOVPH_ACTIVITIES_DATA, EGOVPH_TICKETS_DATA, EGOVPAY_ACTIVITIES_DATA } from '../src/data/egovphData.js';

dotenv.config();

const dbUrl = process.env.TURSO_DATABASE_URL || 'libsql://dict-monitoring-dev-ace09.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !authToken) {
  console.error("Missing TURSO credentials in .env!");
  process.exit(1);
}

const db = createClient({ url: dbUrl, authToken });

async function syncAll() {
  console.log("Connecting to Turso Database...");

  // 1. Ensure tables exist
  const tables = ['egovph', 'egovph_tickets', 'egovpay'];

  for (const tbl of tables) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS "${tbl}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT,
        province TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_status" ON "${tbl}"(status);`);
    await db.execute(`CREATE INDEX IF NOT EXISTS "idx_${tbl}_province" ON "${tbl}"(province);`);
    console.log(`Table "${tbl}" verified/created.`);
  }

  // 2. Sync Activities into egovph (143 rows)
  console.log(`Syncing ${EGOVPH_ACTIVITIES_DATA.length} activities into 'egovph'...`);
  await db.execute('DELETE FROM "egovph"');
  for (const act of EGOVPH_ACTIVITIES_DATA) {
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT OR REPLACE INTO "egovph" (id, data, status, province, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        act.id,
        JSON.stringify(act),
        act.status || 'Completed',
        act.province || 'Regional',
        act.startDate ? `${act.startDate}T00:00:00.000Z` : now,
        now
      ]
    });
  }
  const actCount = await db.execute('SELECT count(*) as count FROM "egovph"');
  console.log(`'egovph' now has ${actCount.rows[0].count} records in Turso.`);

  // 3. Sync Support Tickets into egovph_tickets (86 rows)
  console.log(`Syncing ${EGOVPH_TICKETS_DATA.length} tickets into 'egovph_tickets'...`);
  await db.execute('DELETE FROM "egovph_tickets"');
  for (const t of EGOVPH_TICKETS_DATA) {
    const now = new Date().toISOString();
    // extract province from address or remarks if possible
    let prov = 'Regional';
    const addr = (t.address || '').toLowerCase();
    if (addr.includes('albay')) prov = 'Albay';
    else if (addr.includes('camarines sur')) prov = 'Camarines Sur';
    else if (addr.includes('camarines norte')) prov = 'Camarines Norte';
    else if (addr.includes('catanduanes')) prov = 'Catanduanes';
    else if (addr.includes('masbate')) prov = 'Masbate';
    else if (addr.includes('sorsogon')) prov = 'Sorsogon';

    await db.execute({
      sql: `INSERT OR REPLACE INTO "egovph_tickets" (id, data, status, province, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        t.id,
        JSON.stringify(t),
        t.status || 'RESOLVED',
        prov,
        t.timestamp || now,
        t.statusUpdated || now
      ]
    });
  }
  const ticketCount = await db.execute('SELECT count(*) as count FROM "egovph_tickets"');
  console.log(`'egovph_tickets' now has ${ticketCount.rows[0].count} records in Turso.`);

  // 4. Sync eGovPay into egovpay (12 rows)
  console.log(`Syncing ${EGOVPAY_ACTIVITIES_DATA.length} eGovPay sessions into 'egovpay'...`);
  await db.execute('DELETE FROM "egovpay"');
  for (const p of EGOVPAY_ACTIVITIES_DATA) {
    const now = new Date().toISOString();
    let prov = 'Regional';
    const lgu = (p.lguName || '').toLowerCase();
    if (lgu.includes('albay')) prov = 'Albay';
    else if (lgu.includes('camarines sur')) prov = 'Camarines Sur';
    else if (lgu.includes('camarines norte')) prov = 'Camarines Norte';
    else if (lgu.includes('catanduanes')) prov = 'Catanduanes';
    else if (lgu.includes('masbate')) prov = 'Masbate';
    else if (lgu.includes('sorsogon')) prov = 'Sorsogon';

    await db.execute({
      sql: `INSERT OR REPLACE INTO "egovpay" (id, data, status, province, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        p.id,
        JSON.stringify(p),
        p.status || 'Completed',
        prov,
        p.startDate ? `${p.startDate}T00:00:00.000Z` : now,
        now
      ]
    });
  }
  const egovpayCount = await db.execute('SELECT count(*) as count FROM "egovpay"');
  console.log(`'egovpay' now has ${egovpayCount.rows[0].count} records in Turso.`);

  console.log("ALL THREE DATASETS ARE NOW FULLY SEEDED IN TURSO DB!");
}

syncAll().catch(console.error);
