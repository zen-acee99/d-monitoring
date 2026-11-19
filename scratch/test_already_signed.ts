import fs from 'fs';

async function testAlreadySigned() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const incomingBytes = fs.readFileSync(pdfPath);
  const pdfRawStr = new TextDecoder("latin1").decode(incomingBytes);
  const hasBuenaInRawPdf =
    /\/Name\s*\([^)]*(?:Buena|Rene\s*Jane)[^)]*\)/i.test(pdfRawStr) ||
    (/\/Reason\s*\([^)]*Accomplishment Report Verification[^)]*\)/i.test(pdfRawStr) && /(?:Buena|Rene)/i.test(pdfRawStr)) ||
    (/\/Reason\s*\([^)]*Civil Service Form No\. 48 Official Verification[^)]*\)/i.test(pdfRawStr) && /(?:Buena|Rene)/i.test(pdfRawStr)) ||
    /(?:Digitally\s+signed\s+by\s+Buena|DigiSigned\s+by\s+Buena|Buena\s+Rene\s+Jane\s+Rosendo)/i.test(pdfRawStr);
  console.log("hasBuenaInRawPdf:", hasBuenaInRawPdf);
}
testAlreadySigned().catch(console.error);
