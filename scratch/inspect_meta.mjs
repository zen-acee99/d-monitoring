import fs from 'fs';

const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf';
const buf = fs.readFileSync(pdfPath);
const str = buf.toString('latin1');
const creatorMatch = str.match(/\/Creator\s*\(([^)]+)\)/);
const producerMatch = str.match(/\/Producer\s*\(([^)]+)\)/);
console.log('Creator:', creatorMatch ? creatorMatch[1] : 'none');
console.log('Producer:', producerMatch ? producerMatch[1] : 'none');

const streamMatch = str.match(/\/Contents\s+(\d+)\s+0\s+R/);
console.log('Page contents ref:', streamMatch ? streamMatch[1] : 'none');
