import { db } from "../../../server/db.js";
import forge from "node-forge";
import { decryptP12Password } from "../../../server/services/pnpkiSigningService.js";

async function main() {
  const r = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66' OR user_Id = 'usr-muxedv66'",
    args: []
  });
  if (r.rows.length === 0) {
    console.log("No record found");
    return;
  }
  const row = r.rows[0];
  console.log("ID:", row.id);
  console.log("User ID:", row.user_Id);
  console.log("Name in DB:", row.Name);
  console.log("p12_filename:", row.p12_filename);
  console.log("p12_password raw:", row.p12_password);
  const plainPassword = decryptP12Password(String(row.p12_password || ""));
  console.log("p12_password decrypted length:", plainPassword.length);

  if (row.p12) {
    const p12Buffer = Buffer.from(String(row.p12), "base64");
    console.log("p12 byte length:", p12Buffer.length);
    const p12Der = p12Buffer.toString("binary");
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, plainPassword);

    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.cert) {
          const cert = safeBag.cert;
          console.log("Subject:", cert.subject.attributes.map((a: any) => `${a.name || a.shortName}=${a.value}`).join(", "));
          console.log("Issuer:", cert.issuer.attributes.map((a: any) => `${a.name || a.shortName}=${a.value}`).join(", "));
          console.log("Valid from:", cert.validity.notBefore);
          console.log("Valid to:", cert.validity.notAfter);
        }
      }
    }
  }
}

main().catch(console.error);
