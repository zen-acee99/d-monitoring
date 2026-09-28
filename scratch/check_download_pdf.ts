import fs from 'fs';

const buf = fs.readFileSync('test_full_dtr_download.pdf');
const str = buf.toString('binary');
console.log('--- test_full_dtr_download.pdf inspection ---');
console.log('Sig count:', (str.match(/\/Type\s*\/Sig/g) || []).length);
console.log('Names:', str.match(/\/Name\s*\(([^)]+)\)/g));
console.log('Fields /T:', str.match(/\/T\s*\(([^)]+)\)/g));
console.log('ByteRanges:', str.match(/\/ByteRange\s*\[[^\]]+\]/g));
console.log('Revisions (startxref count):', (str.match(/startxref/g) || []).length);
