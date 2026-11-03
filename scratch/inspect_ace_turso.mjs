import { createClient } from "@libsql/client/web";
import { decryptP12Password, getSignerIdentityFromP12 } from "./pnpkiSigningService.mjs";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

const res = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
const row = res.rows[0];
console.log("Turso Ace Row id:", row.id, "p12_filename:", row.p12_filename);

const pw = decryptP12Password(row.p12_password);
console.log("Decrypted password:", pw);

const iden = getSignerIdentityFromP12(row.p12, pw);
console.log("Turso Ace Identity:");
console.log("  CN:     ", iden.commonName);
console.log("  Serial: ", iden.serialNumber);
console.log("  Subject:", iden.subjectDN);
console.log("  Issuer: ", iden.issuerDN);
