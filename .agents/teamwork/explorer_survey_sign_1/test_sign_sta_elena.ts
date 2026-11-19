import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { decryptP12Password, getSignerIdentityFromP12, signPdfBuffer } from '../../../server/services/pnpkiSigningService.js';
import { safeLoadPdfDocument, signUploadedPersonnelPdfBytes } from '../../../src/utils/dtrVectorPdf.js';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});

async function run() {
  const docRes = await client.execute("SELECT id, file_name, pdf_data, target_personnel, required_signers, signers_matrix FROM signing_workspace_documents WHERE id = 'doc-upload-1794895680225-38-cjzs'");
  if (docRes.rows.length === 0) {
    console.error("Doc not found");
    return;
  }
  const doc = docRes.rows[0];
  console.log("Found doc:", doc.file_name);

  const ksRes = await client.execute("SELECT id, Name, user_Id, p12, p12_password, image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-usr-muxedv66'");
  const ks = ksRes.rows[0];
  console.log("Found ks:", ks.Name, ks.user_Id);
  const p12Pw = decryptP12Password(String(ks.p12_password));
  const ident = getSignerIdentityFromP12(String(ks.p12), p12Pw);
  console.log("Keystore CN:", ident.commonName);

  const pdfDataUrl = String(doc.pdf_data);
  const base64Data = pdfDataUrl.replace(/^data:application\/pdf;base64,/, '');
  const pdfBytes = Buffer.from(base64Data, 'base64');
  console.log("PDF bytes length:", pdfBytes.length);

  const p12Options = {
    profileId: String(ks.id),
    user_Id: String(ks.user_Id),
    p12Base64: String(ks.p12),
    p12Password: p12Pw,
    signerName: String(doc.target_personnel),
    signerRole: 'supervisor' as const,
  };

  try {
    console.log("Attempting signUploadedPersonnelPdfBytes...");
    const res = await signUploadedPersonnelPdfBytes(
      pdfBytes,
      String(doc.target_personnel),
      ks.image_digiSigned ? String(ks.image_digiSigned) : null,
      p12Options,
      {
        isCounterSign: false,
        signerName: String(doc.target_personnel),
        targetSignatoryName: String(doc.target_personnel),
      }
    );
    console.log("Sign success! Output bytes length:", res.bytes.length);
  } catch (err: any) {
    console.error("Caught error during signUploadedPersonnelPdfBytes:", err);
  }
}

run().catch(console.error);
