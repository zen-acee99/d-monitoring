import fs from 'fs';
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFString, PDFHexString } from 'pdf-lib';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client/web';
import { decryptP12Password, signPdfBuffer } from '../server/services/pnpkiSigningService';

dotenv.config();

async function testFull() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.TURSO_AUTH_TOKEN || '',
  });
  const rowRes = await db.execute("SELECT p12, p12_password, Name FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1");
  const p12Base64 = String(rowRes.rows[0].p12);
  const password = decryptP12Password(String(rowRes.rows[0].p12_password));
  const signerName = String(rowRes.rows[0].Name);

  // Load existing test DTR or create one
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const unsignedBytes = await doc.save();

  // We need to implement the fix in pnpkiSigningService first or test here
}
