import { db } from "../../../server/db.js";
import { decryptP12Password } from "../../../server/services/pnpkiSigningService.js";
import forge from "node-forge";

async function main() {
  const r = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66' OR user_Id = 'usr-muxedv66'",
    args: []
  });
  const row = r.rows[0];
  const plainPassword = decryptP12Password(String(row.p12_password || ""));
  const cleanBase64 = String(row.p12).replace(/^data:.*?;base64,/, "").trim();
  const p12Der = forge.util.decode64(cleanBase64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, plainPassword);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const cert = certBags[0].cert;
  const cnAttr = cert.subject.attributes.find((a: any) => a.name === "commonName" || a.shortName === "CN");
  console.log("Raw CN value:", cnAttr.value);
  console.log("Char codes:", Array.from(cnAttr.value).map((c: any) => c.charCodeAt(0)));
  const bufferFromBinary = Buffer.from(cnAttr.value, "binary");
  console.log("Decoded as UTF-8:", bufferFromBinary.toString("utf8"));
}

main().catch(console.error);
