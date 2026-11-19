import { assembleTextItemsIntoLines, matchNames } from '../src/utils/dtrVectorPdf';

// Test composite line matching with fragmented Tj items
const lineItems = [
  { text: "ANNABEL C. ODO", x: 350, y: 520 },
  { text: "ÑO-CALIMPONG", x: 440, y: 520 },
];

const assembled = assembleTextItemsIntoLines(lineItems);
console.log("Assembled:", assembled);

const composite = lineItems.map(it => it.text).join(" ");
console.log("Composite:", composite);
console.log("Matches Annabel?", matchNames(composite, "Annabel C. Odoño-Calimpong"));
