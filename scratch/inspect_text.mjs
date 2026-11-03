import fs from 'fs';
import pdfParse from 'pdf-parse';

const dir = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/';
const d1 = await pdfParse(fs.readFileSync(dir + 'media_1792147510132_24e68bb2.pdf'));
console.log('=== PDF 1 (1-15) TEXT ===');
console.log(d1.text);

const d2 = await pdfParse(fs.readFileSync(dir + 'media_1792147510144_81aae404.pdf'));
console.log('=== PDF 2 (16-24) TEXT ===');
console.log(d2.text);
