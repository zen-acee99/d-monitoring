import fs from 'fs';
import { scanPdfForSigners, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf.js';
import { DEFAULT_USERS } from '../src/data/userStore.js';

async function test() {
  const bytes = fs.readFileSync('./scratch/current_dtr.pdf');
  const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
  const scan = await scanPdfForSigners(bytes, freshUsers);
  console.log("Current DTR scan result:", JSON.stringify(scan, null, 2));
}

test().catch(console.error);
