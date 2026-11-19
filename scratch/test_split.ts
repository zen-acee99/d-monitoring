import { assembleTextItemsIntoLines, matchNames } from '../src/utils/dtrVectorPdf';

// Suppose a PDF has "ANNABEL C. ODOÑO-CALIMPONG" in 12pt or 14pt font:
// "ANNABEL" is at x=350, y=450. In 14pt font, width of ANNABEL is ~65pt.
// "C." is at x=420. In 14pt font, width is ~16pt.
// "ODOÑO-CALIMPONG" is at x=442. In 14pt font, width is ~140pt.

const rawItems = [
  { text: "ANNABEL", x: 350, y: 450 },
  { text: "C.", x: 420, y: 450 },
  { text: "ODOÑO-CALIMPONG", x: 442, y: 450 },
];

const assembled = assembleTextItemsIntoLines(rawItems);
console.log("Assembled items:", assembled);
for (const it of assembled) {
  console.log(`- "${it.text}" matches ANNABEL C. ODOÑO-CALIMPONG?`, matchNames(it.text, "ANNABEL C. ODOÑO-CALIMPONG"));
}
