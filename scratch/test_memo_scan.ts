import fs from 'fs';
import { scanPdfForSigners, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf.js';

async function test() {
  const bytes = fs.readFileSync('./scratch/test_memo_138.pdf');
  const freshUsers = [
    { name: 'ANNABEL C. ODOÑO-CALIMPONG', role: 'Regional Director' },
    { name: 'CHRISTIAN ROY N. MELAD', role: 'OIC, ROCS' },
    { name: 'LEAH B. DY', role: 'Chief, Administrative and Financial Division' },
    { name: 'ROSSANA RODYN MALLO', role: 'Director' }
  ];
  console.log("Scanning test_memo_138.pdf...");
  const scan = await scanPdfForSigners(bytes, freshUsers);
  console.log('SCAN RESULT:', JSON.stringify(scan, null, 2));

  for (const u of freshUsers) {
    const coords = await findPersonnelSignatureCoordinates(bytes, u.name);
    console.log('Coords for', u.name, ':', coords);
  }
}
test().catch(console.error);
