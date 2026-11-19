import { matchNames, normalizeNameForMatch } from '../src/utils/dtrVectorPdf.js';

console.log('1:', matchNames("ANNABEL C. ODO_O-CALIMPONG", "Annabel C. Odoño-Calimpong"));
console.log('2:', matchNames("ANNABEL C. ODOÑO-CALIMPONG", "Annabel C. Odoño-Calimpong"));
console.log('3:', matchNames("ANNABEL C. ODO?O-CALIMPONG", "Annabel C. Odoño-Calimpong"));
console.log('4:', matchNames("ANNABEL C. ODONO-CALIMPONG", "Annabel C. Odoño-Calimpong"));
console.log('5:', matchNames("ANNABELC.ODOÑO-CALIMPONG", "Annabel C. Odoño-Calimpong"));
console.log('6:', matchNames("ANNABEL C. ODOÑO-CALIMPONG", "ANNABEL C. ODOÑO-CALIMPONG"));

const n1 = normalizeNameForMatch("ANNABEL C. ODO_O-CALIMPONG");
const n2 = normalizeNameForMatch("Annabel C. Odoño-Calimpong");
console.log('n1:', n1, 'n2:', n2);
