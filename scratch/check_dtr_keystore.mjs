import fs from 'fs';

const content = fs.readFileSync('src/pages/DtrGenerator.tsx', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(2770, 2820).join('\n'));
