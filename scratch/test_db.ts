import { db } from '../server/db';

async function main() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      region TEXT,
      avatar_url TEXT,
      is_online INTEGER DEFAULT 0,
      last_active_at TEXT NOT NULL,
      last_login_at TEXT,
      current_page TEXT,
      user_agent TEXT,
      ip_address TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("user_presence table created successfully!");

  try {
    await db.execute("ALTER TABLE administration ADD COLUMN last_active_at TEXT;");
  } catch (e: any) {
    console.log("administration.last_active_at note:", e.message);
  }

  try {
    await db.execute("ALTER TABLE users ADD COLUMN last_active_at TEXT;");
  } catch (e: any) {
    console.log("users.last_active_at note:", e.message);
  }

  const cols = await db.execute("PRAGMA table_info(user_presence)");
  console.log("user_presence columns:", cols.rows.map((c: any) => c.name));
}

main().catch(console.error);
