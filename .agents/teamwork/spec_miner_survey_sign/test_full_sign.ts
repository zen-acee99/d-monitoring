import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { matchNames, fixMojibake } from "../../../src/utils/dtrVectorPdf";
import { signPdfBuffer, decryptP12Password, getSignerIdentityFromP12 } from "../../../server/services/pnpkiSigningService";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "libsql://monitoring-zen1.aws-ap-northeast-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken });

async function run() {
  const name1 = "OdoÃ±o-Calimpong Annabel Cortez";
  const name2 = "ANNABEL C. ODOÑO-CALIMPONG";
  const name3 = "Annabel C. Odoño-Calimpong";

  console.log("name1:", name1);
  console.log("fixMojibake(name1):", fixMojibake(name1));
  console.log("matchNames(name1, name2):", matchNames(name1, name2));
  console.log("matchNames(name2, name1):", matchNames(name2, name1));
  console.log("matchNames(name1, name3):", matchNames(name1, name3));
  console.log("matchNames(fixMojibake(name1), name2):", matchNames(fixMojibake(name1), name2));

  // Now let's try actual signPdfBuffer with Annabel's P12 and sta_elena.pdf!
  const p12Row = await client.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66'");
  const r = p12Row.rows[0];
  const plainPwd = decryptP12Password(String(r.p12_password));
  const p12Base64 = String(r.p12);

  const samplePath = path.resolve(".agents/teamwork/spec_miner_survey_sign/samples/sta_elena.pdf");
  const pdfBytes = fs.readFileSync(samplePath);

  console.log("\nAttempting signPdfBuffer on sta_elena.pdf...");
  try {
    const res = await signPdfBuffer(
      pdfBytes,
      p12Base64,
      plainPwd,
      {
        reason: "Official Digital Signature - DICT Region V Signing Workspace",
        sigRect: [57, 104, 152, 28],
        pageIndex: 0,
        signerName: "ANNABEL C. ODOÑO-CALIMPONG",
        signatureImage: r.image_digiSigned ? String(r.image_digiSigned) : undefined,
      }
    );
    console.log("SUCCESS! signedBuffer len:", res.signedBuffer.length);
    fs.writeFileSync(path.resolve(".agents/teamwork/spec_miner_survey_sign/samples/sta_elena_signed_test.pdf"), res.signedBuffer);
  } catch (err: any) {
    console.error("signPdfBuffer FAILED:", err.message);
    console.error(err.stack);
  }
}

run().catch(console.error);
