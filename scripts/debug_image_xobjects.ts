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

const RED_PNG_WITH_ALPHA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mP8z8AARBgGhowBADIwAgH2Fh60AAAAAElFTkSuQmCC";

async function debugG1() {
  const dtrDoc = await PDFDocument.create();
  dtrDoc.addPage([612, 792]);
  const rawDtr = await dtrDoc.save();

  const creds = generateTestP12();

  console.log("Signing Pass 1 with image...");
  const p1 = await signPdfBuffer(Buffer.from(rawDtr), creds.p12Base64, creds.password, {
    sigRects: [[50, 200, 200, 250], [350, 200, 500, 250]],
    signerName: "ANNABEL C. ODOÑO-CALIMPONG",
    signatureImage: RED_PNG_WITH_ALPHA,
  });

  const p1Str = p1.signedBuffer.toString("latin1");
  const imgMatches = [...p1Str.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]*?)\/Subtype\s*\/Image([\s\S]*?)>>/g)];
  console.log(`Found ${imgMatches.length} Image XObjects in Pass 1:`);
  imgMatches.forEach((m, idx) => {
    console.log(`--- Image ${idx} (obj ${m[1]}) ---`);
    console.log(m[0].slice(0, 300));
  });

  console.log("\nSigning Pass 2 with image...");
  const p2 = await signPdfBuffer(p1.signedBuffer, creds.p12Base64, creds.password, {
    sigRects: [[50, 100, 200, 150], [350, 100, 500, 150]],
    signerName: "RENE JANE R. BUENA",
    signatureImage: RED_PNG_WITH_ALPHA,
  });

  const p2Str = p2.signedBuffer.toString("latin1");
  const p2ImgMatches = [...p2Str.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]*?)\/Subtype\s*\/Image([\s\S]*?)>>/g)];
  console.log(`Found ${p2ImgMatches.length} Image XObjects in Pass 2:`);
  p2ImgMatches.forEach((m, idx) => {
    console.log(`--- P2 Image ${idx} (obj ${m[1]}) ---`);
    console.log(m[0].slice(0, 300));
  });
}

debugG1().catch(console.error);
