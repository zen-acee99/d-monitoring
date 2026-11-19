import fs from 'fs';
import { scanPdfForSigners } from '../src/utils/dtrVectorPdf.js';
import { DEFAULT_USERS } from '../src/data/userStore.js';

async function test() {
  const bytes = fs.readFileSync('./scratch/test_pov.pdf');
  const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
  const scan = await scanPdfForSigners(bytes, freshUsers);
  console.log("POV scan result:", JSON.stringify(scan, null, 2));
}

test().catch(console.error).finally(() => process.exit(0));
