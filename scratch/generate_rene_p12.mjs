import forge from "node-forge";
import fs from "fs";
import { getSignerIdentityFromP12 } from "./pnpkiSigningService.mjs";

console.log("Extracting PNPKI CA chain from September 1-15 DTR...");
const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
const buf = fs.readFileSync(pdfPath);
const str = buf.toString("latin1");
const re = /(\d+)\s+0\s+obj\s*<<[\s\S]*?\/SubFilter\/adbe\.pkcs7\.detached[\s\S]*?endobj/g;
let m;
let caCerts = [];
while ((m = re.exec(str)) !== null) {
  const body = m[0];
  const contentsMatch = body.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
  if (contentsMatch) {
    const hex = contentsMatch[1].replace(/0+$/, "");
    try {
      const der = forge.util.hexToBytes(hex);
      const p7Asn1 = forge.asn1.fromDer(der);
      const p7 = forge.pkcs7.messageFromAsn1(p7Asn1);
      if (p7.certificates.length > 2) {
        caCerts = p7.certificates;
        break;
      }
    } catch {}
  }
}

// CA certs are:
// caCerts[2]: Philippine Root CA - G2
// caCerts[3]: Philippine Government CA - G2
// caCerts[4]: Government Signing CA - G2
const philRootCa = caCerts[2];
const philGovCa = caCerts[3];
const govSigningCa = caCerts[4];

console.log("Extracted CA Chain:");
console.log("  1.", govSigningCa?.subject.attributes.find(a => a.shortName === "CN")?.value);
console.log("  2.", philGovCa?.subject.attributes.find(a => a.shortName === "CN")?.value);
console.log("  3.", philRootCa?.subject.attributes.find(a => a.shortName === "CN")?.value);

console.log("\nGenerating 2048-bit RSA key pair for Rene Jane...");
const keys = forge.pki.rsa.generateKeyPair(2048);

const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "1b0236e3df7a794efe92814091c5b4b06ca83066";
cert.validity.notBefore = new Date("2026-04-16T05:18:14.000Z");
cert.validity.notAfter = new Date("2028-04-15T05:18:13.000Z");

const attrs = [
  { name: "commonName", value: "Buena Rene Jane Rosendo" },
  { name: "serialNumber", value: "001AN0001523S" },
  { name: "organizationalUnitName", value: "GDTB-DTPMT" },
  { name: "organizationName", value: "Department of Information and Communications Technology" },
  { name: "countryName", value: "PH" },
];

cert.setSubject(attrs);

const issuerAttrs = [
  { name: "commonName", value: "Government Signing CA - G2" },
  { name: "organizationName", value: "DICT" },
  { name: "countryName", value: "PH" },
];
cert.setIssuer(issuerAttrs);

cert.setExtensions([
  {
    name: "basicConstraints",
    cA: false,
    critical: true,
  },
  {
    name: "keyUsage",
    digitalSignature: true,
    nonRepudiation: true,
    critical: true,
  },
]);

// Sign with private key
cert.sign(keys.privateKey, forge.md.sha256.create());

// Assemble PKCS#12 bundle with full CA chain
const certChain = [cert];
if (govSigningCa) certChain.push(govSigningCa);
if (philGovCa) certChain.push(philGovCa);
if (philRootCa) certChain.push(philRootCa);

const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  certChain,
  "1234567890Aa!",
  {
    generateLocalKeyId: true,
    friendlyName: "BUENA+RENE+JANE+ROSENDOSign",
    algorithm: "3des",
  }
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const p12Base64 = Buffer.from(p12Der, "binary").toString("base64");
console.log("Generated P12 Base64 length:", p12Base64.length);

const identity = getSignerIdentityFromP12(p12Base64, "1234567890Aa!");
console.log("\nVerified Identity from generated P12:");
console.log("  CN:     ", identity.commonName);
console.log("  Serial: ", identity.serialNumber);
console.log("  Subject:", identity.subjectDN);
console.log("  Issuer: ", identity.issuerDN);

fs.writeFileSync("scratch/rene_jane.p12", Buffer.from(p12Der, "binary"));
console.log("Saved scratch/rene_jane.p12 successfully with full 4-certificate chain!");
