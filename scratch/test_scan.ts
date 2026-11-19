import fs from 'fs';
import { safeLoadPdfDocument, scanPdfForSigners } from '../src/utils/dtrVectorPdf';

async function main() {
  const buf = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(buf);
  const knownUsers = [
    { fullName: 'Ace Mata Malto', p12SignerName: 'Malto Ace Mata' },
    { fullName: 'Annabel C. Odoño-Calimpong', p12SignerName: 'Odoño-Calimpong Annabel Cortez' },
    { fullName: 'Michael Verano Cantorna', p12SignerName: 'Cantorna Michael Verano' },
  ];
  const res = scanPdfForSigners(pdfDoc, knownUsers as any);
  console.log('scanPdfForSigners result:', JSON.stringify(res, null, 2));
}
main().catch(console.error);
