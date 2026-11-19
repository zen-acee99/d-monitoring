import fs from 'fs';

const buf = fs.readFileSync('scratch/test_pov.pdf');
const str = buf.toString('latin1');

const catalogMatches = str.match(/<<[^>]*\/Type\s*\/Catalog[^>]*>>/g);
console.log("Catalog objects:", catalogMatches);

const trailerMatches = str.match(/trailer[\s\S]*?startxref/g);
console.log("Trailers:", trailerMatches);
