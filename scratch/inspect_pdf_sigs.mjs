import fs from "fs";
import forge from "node-forge";

const pdfPath = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1792147510144_81aae404.pdf";
const buf = fs.readFileSync(pdfPath);
const str = buf.toString("latin1");

// Look for /SubFilter/adbe.pkcs7.detached/Type/Sig or similar
const re = /(\d+)\s+0\s+obj\s*<<[\s\S]*?\/SubFilter\/adbe\.pkcs7\.detached[\s\S]*?endobj/g;
let m;
while ((m = re.exec(str)) !== null) {
  const objNum = m[1];
  const body = m[0];
  console.log(`\n=================== OBJ ${objNum} ===================`);
  const name = body.match(/\/Name\s*\(([^)]+)\)/)?.[1];
  const reason = body.match(/\/Reason\s*\(([^)]+)\)/)?.[1];
  const mDate = body.match(/\/M\s*\(([^)]+)\)/)?.[1];
  const br = body.match(/\/ByteRange\s*\[([^\]]+)\]/)?.[1];
  console.log("Name:     ", name);
  console.log("Reason:   ", reason);
  console.log("Date:     ", mDate);
  console.log("ByteRange:", br);

  const contentsMatch = body.match(/\/Contents\s*<([0-9a-fA-F]+)>/);
  if (contentsMatch) {
    const hex = contentsMatch[1].replace(/0+$/, "");
    console.log("Contents hex len:", hex.length);
    try {
      const der = forge.util.hexToBytes(hex);
      const p7Asn1 = forge.asn1.fromDer(der);
      const p7 = forge.pkcs7.messageFromAsn1(p7Asn1);
      console.log("Certificates count:", p7.certificates.length);
      p7.certificates.forEach((cert, idx) => {
        const cn = cert.subject.attributes.find(a => a.name === "commonName" || a.shortName === "CN")?.value;
        const o = cert.subject.attributes.find(a => a.name === "organizationName" || a.shortName === "O")?.value;
        const ou = cert.subject.attributes.find(a => a.name === "organizationalUnitName" || a.shortName === "OU")?.value;
        const issuerCn = cert.issuer.attributes.find(a => a.name === "commonName" || a.shortName === "CN")?.value;
        console.log(`  Cert ${idx + 1}: CN=${cn}, OU=${ou}, O=${o}, Issuer=${issuerCn}, Serial=${cert.serialNumber}`);
      });
    } catch (e) {
      console.log("Error parsing p7:", e.message);
    }
  }
}
