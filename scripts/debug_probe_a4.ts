import { signPdfBuffer } from "../server/services/pnpkiSigningService";
import { PDFDocument } from "pdf-lib";
import forge from "node-forge";

function generateTestP12(commonName = "Test Signer", password = "SecretPassword123!") {
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(1024);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: "commonName", value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { generateLocalKeyId: true });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return { p12Base64: Buffer.from(p12Der, "binary").toString("base64"), password };
}

async function debugA4() {
  const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/Perms << /DocMDP 4 0 R >>
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
4 0 obj
<< /Type /SigRef >>
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000085 00000 n 
0000000142 00000 n 
0000000210 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
246
%%EOF`;

  const creds = generateTestP12();
  const p1 = await signPdfBuffer(Buffer.from(rawPdf, "binary"), creds.p12Base64, creds.password, {
    sigRects: [[100, 100, 250, 150]],
  });
  console.log("P1 length:", p1.signedBuffer.length);

  const p2 = await signPdfBuffer(p1.signedBuffer, creds.p12Base64, creds.password, {
    sigRects: [[300, 100, 450, 150]],
  });
  console.log("P2 length:", p2.signedBuffer.length);

  const p2Doc = await PDFDocument.load(p2.signedBuffer);
  console.log("p2Doc.catalog:", typeof p2Doc.catalog, p2Doc.catalog);

  // Look at Catalog in p2.signedBuffer
  const str = p2.signedBuffer.toString("latin1");
  const matches = [...str.matchAll(/1\s+0\s+obj([\s\S]*?)endobj/g)];
  console.log("Obj 1 definitions found:", matches.length);
  matches.forEach((m, idx) => {
    console.log(`--- Match ${idx} ---:\n${m[1]}`);
  });
}

debugA4().catch(console.error);
