import { matchNames as serverMatchNames } from '../../../server/routes/dtrGenerator.js';
import { matchNames as clientMatchNames } from '../../../src/utils/dtrVectorPdf.js';

const pName = "OdoÃ±o-Calimpong Annabel Cortez";
const effectiveName = "ANNABEL C. ODOÑO-CALIMPONG";

console.log("Client matchNames:", clientMatchNames(pName, effectiveName));

console.log("Server matchNames:", serverMatchNames(pName, effectiveName));
console.log("Client match with 'Annabel Cortez Odoño-Calimpong':", clientMatchNames(effectiveName, "Annabel Cortez Odoño-Calimpong"));
console.log("Server match with 'Annabel Cortez Odoño-Calimpong':", serverMatchNames(effectiveName, "Annabel Cortez Odoño-Calimpong"));
