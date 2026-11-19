import fs from 'fs';
import { detectMatchingUsersFromText, normalizeNameForMatch, matchNames } from './test_match.mjs';

const user = { name: 'DE LEON, KEN MATTHEW L.', role: 'Staff' };

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

for (const snippet of candidateTexts) {
  const normSnippet = normalizeNameForMatch(snippet);
  const normUName = normalizeNameForMatch(user.name);
  const uParts = normUName.split(/\s+/).filter(p => p.length > 2);
  
  const isExact = normSnippet === normUName || normSnippet.includes(normUName);
  const isParts = uParts.length >= 2 && uParts.every(part => normSnippet.includes(part));
  const isMatchNames = matchNames(snippet, user.name);
  
  if (isExact || isParts || isMatchNames) {
    console.log(`SNIPPET "${snippet}": isExact=${isExact}, isParts=${isParts}, isMatchNames=${isMatchNames}`);
  }
}
