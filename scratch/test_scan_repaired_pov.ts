import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { repairPdfCatalogIfCorrupted, scanPdfForSigners } from '../src/utils/dtrVectorPdf.js';
import { DEFAULT_USERS } from '../src/data/userStore.js';

async function main() {
  const bytes = fs.readFileSync('./scratch/test_pov.pdf');
  const repaired = repairPdfCatalogIfCorrupted(bytes);
  const freshUsers = DEFAULT_USERS.map(u => ({ name: u.name, role: u.role, email: u.email }));
  const scan = await scanPdfForSigners(repaired, freshUsers);
  console.log("SCAN RESULT:", JSON.stringify(scan, null, 2));
}

main().catch(console.error);
