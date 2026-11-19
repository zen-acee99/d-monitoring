import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { repairPdfCatalogIfCorrupted } from '../src/utils/dtrVectorPdf.js';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const repaired = repairPdfCatalogIfCorrupted(bytes);
const str = new TextDecoder("latin1").decode(repaired);

const pdfDoc = await PDFDocument.load(repaired);
const page = pdfDoc.getPages()[0];
const contentsRef = page.node.Contents();
console.log("Contents ref:", contentsRef.toString());

const objNum = contentsRef.tag.match(/\d+/)[0];
console.log("Obj num:", objNum);

const objHeader = `${objNum} 0 obj`;
const idx = str.indexOf(objHeader);
console.log("Index of obj:", idx);
console.log(str.slice(idx, idx + 200));
