import fs from 'fs';
import { detectMatchingUsersFromText, normalizeNameForMatch, matchNames } from './test_match.mjs';

const userStore = fs.readFileSync('src/data/userStore.ts', 'utf8');
const userMatches = userStore.match(/name:\s*["']([^"']+)["']/g) || [];
const users = userMatches.map(m => {
  const name = m.replace(/name:\s*["']/, '').replace(/["']$/, '');
  return { name, role: 'Staff' };
});

const candidateTexts = [
  "The",
  "ORIGINAL",
  "of this",
  "DOCUMENT",
  "is in",
  "DIGITAL FORMAT",
  "Prepared by:",
  "Certified Correct by:",
  "Noted by:",
  "DANREV A. BALANA",
  "CARLA MAE R. CABREDO",
  "LEAH B. DY",
  "ANNABEL C. ODOÑO-CALIMPONG",
  "Budget Staff",
  "Budget Officer",
  "Chief Administrative Officer",
  "OIC-Regional Director, Regional Office No. V",
  "DTR_ANNABEL_C__ODO_O_CALIMPONG.pdf",
  "Scanned from document: ANNABEL C. ODOÑO-CALIMPONG"
];

const matched = detectMatchingUsersFromText(candidateTexts, users);
console.log('Matched users:', matched);
