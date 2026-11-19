import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { scanPdfForSigners } from '../src/utils/dtrVectorPdf.ts';

const mockUsers = [
  { name: 'Annabel C. Odoño-Calimpong', role: 'Regional Director' },
  { name: 'Leah B. Dy', role: 'Chief Administrative Officer' },
  { name: 'Ace Malto', role: 'Super Admin' },
  { name: 'Rene Jane R. Buena', role: 'Provincial Officer' },
  { name: 'DE LEON, KEN MATTHEW L.', role: 'ISA I' },
];

async function run() {
  const buf = fs.readFileSync('C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1793905166091_27734990.pdf');
  const res = await scanPdfForSigners(buf, mockUsers);
  console.log('--- Scan Result ---');
  console.log('primaryPersonnel:', res.primaryPersonnel);
  console.log('requiredSigners:', res.requiredSigners);
  console.log('signers:', res.signers.map(s => ({ name: s.name, status: s.status, isAlreadySigned: s.isAlreadySigned, p12CommonName: s.p12CommonName })));
}

run().catch(console.error);
