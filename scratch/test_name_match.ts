import { matchNames, normalizeNameForMatch } from "../src/utils/dtrVectorPdf.js";

console.log("matchNames('ACEMATA MALTO', 'ACE MATA MALTO'):", matchNames('ACEMATA MALTO', 'ACE MATA MALTO'));
console.log("matchNames('ACEMATA MALTO', 'Ace Malto'):", matchNames('ACEMATA MALTO', 'Ace Malto'));
console.log("normalizeNameForMatch('ACEMATA MALTO'):", normalizeNameForMatch('ACEMATA MALTO'));
console.log("normalizeNameForMatch('ACE MATA MALTO'):", normalizeNameForMatch('ACE MATA MALTO'));
