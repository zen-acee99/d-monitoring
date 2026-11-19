import fs from "fs";
import { db } from "../server/db.js";
import { decryptP12Password, getSignerIdentityFromP12 } from "../server/services/pnpkiSigningService.js";

async function main() {
  console.log("=== CHECKING SCRATCH FIXTURES ===");
  if (fs.existsSync("scratch/rene_jane.p12")) {
    const buf = fs.readFileSync("scratch/rene_jane.p12");
    const ident = getSignerIdentityFromP12(buf.toString("base64"), "1234567890Aa!");
    console.log("Found scratch/rene_jane.p12: CN =", ident.commonName);
  } else {
    console.log("scratch/rene_jane.p12 NOT FOUND");
  }

  console.log("\n=== CHECKING DATABASE KEYSTORES ===");
  try {
    const res = await db.execute("SELECT id, user_Id, Name, p12, p12_password FROM dtr_generator WHERE p12 IS NOT NULL");
    console.log("Found rows in dtr_generator:", res.rows.length);
    for (const r of res.rows) {
      const p12 = r.p12 as string;
      const pw = decryptP12Password(r.p12_password as string);
      try {
        const id = getSignerIdentityFromP12(p12, pw);
        console.log(`Row [${r.Name}]: CN = "${id.commonName}", validTo = ${id.validTo.toISOString()}`);
      } catch (e: any) {
        console.log(`Row [${r.Name}] parse error:`, e.message);
      }
    }
  } catch (err: any) {
    console.log("DB Query error:", err.message);
  }
}

main().catch(console.error);
