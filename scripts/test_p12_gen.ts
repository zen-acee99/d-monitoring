import forge from "node-forge";
import { signPdfBuffer } from "../server/services/pnpkiSigningService";
import { PDFDocument } from "pdf-lib";

function generateTestP12(commonName = "Test Signer", password = "password123") {
  const pki = forge.pki;
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: "commonName", value: commonName },
    { name: "organizationName", value: "DICT Test Org" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    generateLocalKeyId: true,
    friendlyName: commonName,
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return {
    p12Base64: Buffer.from(p12Der, "binary").toString("base64"),
    password,
  };
}

async function main() {
  console.log("Generating P12...");
  const creds = generateTestP12();
  console.log("P12 generated, length:", creds.p12Base64.length);

  const doc = await PDFDocument.create();
  doc.addPage([600, 800]);
  const pdfBytes = await doc.save();

  console.log("Signing PDF buffer...");
  const res = await signPdfBuffer(Buffer.from(pdfBytes), creds.p12Base64, creds.password, {
    sigRects: [[100, 100, 250, 150]],
    signerName: "Test Signer",
  });

  console.log("Signed successfully, bytes:", res.signedBuffer.length);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
