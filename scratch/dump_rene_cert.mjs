import fs from 'fs';
import forge from 'node-forge';

const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf';
const buf = fs.readFileSync(pdfPath);
const str = buf.toString('latin1');
const sigMatches = [...str.matchAll(/<<\s*\/Type\s*\/Sig[\s\S]*?endobj/g)];

for (const m of sigMatches) {
  const body = m[0];
  const nameMatch = body.match(/\/Name\s*\(([^)]+)\)/);
  const contentsMatch = body.match(/\/Contents\s*<([0-9a-fA-F\s]+)>/);
  if (contentsMatch && nameMatch && nameMatch[1].includes('Buena')) {
    const hex = contentsMatch[1].replace(/\s+/g, '').replace(/0+$/, '');
    const der = forge.util.hexToBytes(hex);
    const p7Asn1 = forge.asn1.fromDer(der);
    const p7 = forge.pkcs7.messageFromAsn1(p7Asn1);
    const cert = p7.certificates[0];
    console.log('--- FOUND BUENA CERT ---');
    console.log('Subject attributes:');
    cert.subject.attributes.forEach(a => console.log(' ', a.name, a.shortName, a.value));
    console.log('Issuer attributes:');
    cert.issuer.attributes.forEach(a => console.log(' ', a.name, a.shortName, a.value));
    console.log('Validity:', cert.validity.notBefore, 'to', cert.validity.notAfter);
    console.log('Serial:', cert.serialNumber);
    break;
  }
}
