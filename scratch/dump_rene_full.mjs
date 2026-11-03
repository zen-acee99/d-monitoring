import fs from "fs";
import forge from "node-forge";

const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
const buf = fs.readFileSync(pdfPath);
const str = buf.toString("latin1");

const re = /(\d+)\s+0\s+obj\s*<<[\s\S]*?\/SubFilter\/adbe\.pkcs7\.detached[\s\S]*?endobj/g;
let m;
while ((m = re.exec(str)) !== null) {
  const body = m[0];
  const name = body.match(/\/Name\s*\(([^)]+)\)/)?.[1];
  if (name && name.includes("Buena")) {
    const contentsMatch = body.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
    if (contentsMatch) {
      const hex = contentsMatch[1].replace(/0+$/, "");
      const der = forge.util.hexToBytes(hex);
      const p7Asn1 = forge.asn1.fromDer(der);
      const p7 = forge.pkcs7.messageFromAsn1(p7Asn1);
      const cert = p7.certificates[0];
      console.log("=== RENE JANE CERTIFICATE ===");
      console.log("Subject:", cert.subject.attributes);
      console.log("Issuer:", cert.issuer.attributes);
      console.log("Serial:", cert.serialNumber);
      console.log("Validity:", cert.validity.notBefore, "to", cert.validity.notAfter);
      console.log("Sig Alg:", cert.signatureOid);
      console.log("Extensions:", cert.extensions);
      
      // Let's also check if we can dump this cert as PEM
      const pem = forge.pki.certificateToPem(cert);
      console.log("PEM:\n", pem);
      fs.writeFileSync("scratch/rene_cert.pem", pem);
      break;
    }
  }
}
