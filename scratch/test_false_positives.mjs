import fs from 'fs';
import { matchNames } from './test_match.mjs';

const userStore = fs.readFileSync('src/data/userStore.ts', 'utf8');
const userMatches = userStore.match(/name:\s*["']([^"']+)["']/g) || [];
const users = userMatches.map(m => m.replace(/name:\s*["']/, '').replace(/["']$/, ''));

const testWords = ["The", "is", "in", "of", "to", "and", "by", "for", "on", "at", "an", "or", "as"];

for (const w of testWords) {
  for (const u of users) {
    if (matchNames(w, u)) {
      console.log(`Word "${w}" matched user "${u}"!`);
    }
  }
}
