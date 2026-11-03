import { jsPDF } from "jspdf";
import { PDFDocument, PDFName, PDFArray, PDFNumber } from "pdf-lib";
import { createClient } from "@libsql/client";
import { decryptP12Password, getSignerIdentityFromP12, signPdfBuffer } from "./pnpkiSigningService.mjs";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

console.log("Point A: Started");

async function main() {
  console.log("Point B: Inside main");

  // 1. Load Keystores from database
  const localDb = createClient({ url: "file:local.db" });
  const aceRowRes = await localDb.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-1'");
  const reneRowRes = await localDb.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");

  console.log("Point C: Queried localDb");

  const aceProfile = aceRowRes.rows[0];
  const reneProfile = reneRowRes.rows[0];

  const acePassword = decryptP12Password(aceProfile.p12_password);
  const renePassword = decryptP12Password(reneProfile.p12_password);

  console.log("Point D: Decrypted passwords");

  const aceIdentity = getSignerIdentityFromP12(aceProfile.p12, acePassword);
  console.log("Point E: Got Ace Identity");
  const reneIdentity = getSignerIdentityFromP12(reneProfile.p12, renePassword);
  console.log("Point F: Got Rene Identity");
}

main().catch(console.error);
