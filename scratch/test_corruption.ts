import fs from 'fs';
import { repairPdfCatalogIfCorrupted } from '../src/utils/dtrVectorPdf.js';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const dataStart = 30579;
console.log("Original byte at 30579 + 1:", bytes[dataStart + 1]);

const repaired = repairPdfCatalogIfCorrupted(bytes);
console.log("Repaired byte at 30579 + 1:", repaired[dataStart + 1]);
