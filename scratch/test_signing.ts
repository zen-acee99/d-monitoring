import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { signPdfBuffer } from '../server/services/pnpkiSigningService.js';

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
const attrs = [
  { name: 'commonName', value: 'Test Signer' },
  { name: 'organizationName', value: 'DICT' }
];
cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'password');
const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const p12Base64 = Buffer.from(p12Der, 'binary').toString('base64');

async function main() {
  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const rawBytes = Buffer.from(await doc.save({ useObjectStreams: false }));

  console.log('--- SIGNING PASS 1 WITH server/services/pnpkiSigningService.ts ---');
  const pass1 = await signPdfBuffer(rawBytes, p12Base64, 'password', {
    reason: 'Test Pass 1',
    sigRects: [[100, 200, 220, 230], [300, 200, 420, 230]],
    fieldName: 'Personnel_Signature',
    skipVisualText: true,
  });

  const pdfStr1 = pass1.signedBuffer.toString('latin1');
  const objs1 = [...pdfStr1.matchAll(/(\d+\s+0\s+obj[\s\S]*?endobj)/g)].map(m => m[1]);
  console.log('PASS 1 RELEVANT OBJECTS:');
  for (let o of objs1) {
    if (o.includes('/Type /XObject') || o.includes('/Subtype /Widget') || o.includes('/Kids') || o.includes('/AcroForm')) {
      console.log('--------------------------------------------------');
      console.log(o.replace(/<[0-9a-fA-F]{100,}>/, '<HEX_TRUNCATED>').replace(/stream[\s\S]*?endstream/, 'stream ... endstream'));
    }
  }

  console.log('--- SIGNING PASS 2 WITH server/services/pnpkiSigningService.ts ---');
  const pass2 = await signPdfBuffer(pass1.signedBuffer, p12Base64, 'password', {
    reason: 'Test Pass 2',
    sigRects: [[100, 150, 220, 180], [300, 150, 420, 180]],
    fieldName: 'Supervisor_Signature',
    skipVisualText: true,
  });

  const pdfStr2 = pass2.signedBuffer.toString('latin1');
  const objs2 = [...pdfStr2.matchAll(/(\d+\s+0\s+obj[\s\S]*?endobj)/g)].map(m => m[1]);
  console.log('PASS 2 RELEVANT OBJECTS:');
  for (let o of objs2) {
    if (o.includes('/Type /XObject') || o.includes('/Subtype /Widget') || o.includes('/Kids') || o.includes('/AcroForm')) {
      console.log('--------------------------------------------------');
      console.log(o.replace(/<[0-9a-fA-F]{100,}>/, '<HEX_TRUNCATED>').replace(/stream[\s\S]*?endstream/, 'stream ... endstream'));
    }
  }
}

main().catch(console.error);
