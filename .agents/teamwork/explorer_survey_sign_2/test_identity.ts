import { db } from "../../../server/db.js";
import { decryptP12Password, getSignerIdentityFromP12 } from "../../../server/services/pnpkiSigningService.js";

async function main() {
  const r = await db.execute({
    sql: "SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66' OR user_Id = 'usr-muxedv66'",
    args: []
  });
  const row = r.rows[0];
  const plainPassword = decryptP12Password(String(row.p12_password || ""));
  console.log("Decrypted password:", plainPassword);
  const identity = getSignerIdentityFromP12(String(row.p12), plainPassword);
  console.log("Identity extracted:", {
    commonName: identity.commonName,
    subjectDN: identity.subjectDN,
    organization: identity.organization,
    issuerCN: identity.issuerCN,
    serialNumber: identity.serialNumber,
    validFrom: identity.validFrom,
    validTo: identity.validTo
  });
}

main().catch(console.error);
