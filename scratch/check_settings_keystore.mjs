import fs from 'fs';

const content = fs.readFileSync('src/pages/settings/SystemSettings.tsx', 'utf8');
const lines = content.split('\n');

const checks = [1225, 1440, 2340, 2350];
for (const c of checks) {
  console.log(`--- Lines around ${c} ---`);
  console.log(lines.slice(Math.max(0, c - 10), Math.min(lines.length, c + 15)).join('\n'));
}
