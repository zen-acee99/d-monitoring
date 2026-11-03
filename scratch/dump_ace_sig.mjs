import { createClient } from '@libsql/client/web';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const res = await db.execute("SELECT image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
const img = res.rows[0].image_digiSigned;
console.log('Ace signature image length:', img?.length);
console.log('Ace signature prefix:', img?.slice(0, 50));
if (img.startsWith('data:image/png;base64,')) {
  fs.writeFileSync('scratch/ace_sig_dump.png', Buffer.from(img.replace('data:image/png;base64,', ''), 'base64'));
  console.log('Dumped scratch/ace_sig_dump.png');
}
