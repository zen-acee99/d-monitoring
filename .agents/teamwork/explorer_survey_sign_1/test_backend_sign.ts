import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { decryptP12Password, getSignerIdentityFromP12, signPdfBuffer } from '../../../server/services/pnpkiSigningService.js';
import { matchNames } from '../../../server/routes/dtrGenerator.js';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const docRes = await client.execute("SELECT id, file_name, pdf_data, target_personnel FROM signing_workspace_documents WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  const doc = docRes.rows[0];

  const ksRes = await client.execute("SELECT id, Name, user_Id, p12, p12_password, image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66'");
  const ks = ksRes.rows[0];

  const p12Pw = decryptP12Password(String(ks.p12_password));
  const ident = getSignerIdentityFromP12(String(ks.p12), p12Pw);
  console.log("Extracted identity CN:", ident.commonName);

  const pdfDataUrl = String(doc.pdf_data);
  const base64Data = pdfDataUrl.replace(/^data:application\/pdf;base64,/, '');
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  // Let's test the identity match check from server/routes/dtrGenerator.ts
  const certCommonName = (ident.commonName || "").trim();
  const requestedSigner = "ANNABEL C. ODOÑO-CALIMPONG";
  const requestedTarget = "ANNABEL C. ODOÑO-CALIMPONG";

  console.log("certCommonName:", certCommonName);
  console.log("requestedSigner:", requestedSigner);
  console.log("matchNames(certCommonName, requestedSigner):", matchNames(certCommonName, requestedSigner));
  console.log("matchNames(requestedSigner, certCommonName):", matchNames(requestedSigner, certCommonName));

  const isMatchCert =
    matchNames(certCommonName, requestedSigner) ||
    matchNames(requestedSigner, certCommonName) ||
    certCommonName.toLowerCase() === requestedSigner.toLowerCase();

  const isMatchTarget = Boolean(
    requestedTarget &&
    (matchNames(requestedTarget, requestedSigner) ||
     matchNames(requestedSigner, requestedTarget) ||
     requestedTarget.toLowerCase() === requestedSigner.toLowerCase())
  );

  console.log("isMatchCert:", isMatchCert, "isMatchTarget:", isMatchTarget);

  // Now test signPdfBuffer
  try {
    console.log("Calling signPdfBuffer...");
    const result = await signPdfBuffer(
      pdfBuffer,
      String(ks.p12),
      p12Pw,
      {
        reason: "Official Digital Signature - DICT Region V Signing Workspace",
        sigRect: [57, 104, 152, 28],
        pageIndex: 0,
        signatureImage: ks.image_digiSigned ? String(ks.image_digiSigned) : undefined,
        signerName: requestedSigner,
        isCounterSign: false,
      }
    );
    console.log("signPdfBuffer succeeded! Signed buffer length:", result.signedBuffer.length);
  } catch (err: any) {
    console.error("signPdfBuffer threw error:", err);
  }
}

run().catch(console.error);
