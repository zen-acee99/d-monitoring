import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { decryptP12Password, getSignerIdentityFromP12 } from "../../../server/services/pnpkiSigningService";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

async function run() {
  const row = await client.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66'");
  if (row.rows.length === 0) {
    console.log("Not found");
    return;
  }
  const r = row.rows[0];
  const plainPwd = decryptP12Password(String(r.p12_password));
  console.log("Decrypted P12 password:", plainPwd);
  console.log("P12 filename:", r.p12_filename);
  console.log("P12 data length:", String(r.p12).length);

  try {
    const ident = getSignerIdentityFromP12(String(r.p12), plainPwd);
    console.log("Signer Common Name:", ident.commonName);
    console.log("Signer Subject DN:", ident.subjectDN);
    console.log("Issuer CN:", ident.issuerCN);
    console.log("Valid From:", ident.validFrom);
    console.log("Valid To:", ident.validTo);
    console.log("SHA256:", ident.sha256Fingerprint);
  } catch (e) {
    console.error("Failed to parse P12:", e);
  }
}

run().catch(console.error);
