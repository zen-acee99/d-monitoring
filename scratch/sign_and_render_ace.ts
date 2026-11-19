import fs from "fs";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import { signPdfBuffer, decryptP12Password } from "../server/services/pnpkiSigningService";
import { PDFDocument } from "pdf-lib";
import { findPersonnelSignatureCoordinates } from "../src/utils/dtrVectorPdf";
import path from "path";
import puppeteer from "puppeteer-core";

dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  const rs = await client.execute("SELECT p12, p12_filename, p12_password, image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-usr-mu74lftk'");
  const row = rs.rows[0];
  const p12Base64 = String(row.p12);
  const p12Password = decryptP12Password(String(row.p12_password));
  const sigImage = row.image_digiSigned ? String(row.image_digiSigned) : null;

  const pdfBytes = fs.readFileSync("scratch/truly_pristine_ace_dtr.pdf");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const loc = findPersonnelSignatureCoordinates(pdfDoc, "Ace Malto");

  console.log("Found coordinates:", loc);

  const signedResult = await signPdfBuffer(pdfBytes, p12Base64, p12Password, {
    reason: "Civil Service Form No. 48 Digital Signature - DICT Region V Signing Workspace",
    signerName: "Ace Mata Malto",
    pageIndex: loc.pageIndex,
    sigRect: [loc.boxX, loc.boxY, loc.boxW, loc.boxH],
    sigRects: loc.sigRects,
    signatureImage: sigImage,
  });

  fs.writeFileSync("scratch/ace_dtr_final_signed.pdf", signedResult.signedBuffer);
  console.log("Saved scratch/ace_dtr_final_signed.pdf!");

  // Render to PNG
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\Ace\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
  ];
  let chromePath = "";
  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      chromePath = p;
      break;
    }
  }

  if (chromePath) {
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    const pdfFilePath = path.resolve("scratch/ace_dtr_final_signed.pdf");
    await page.goto(`file://${pdfFilePath}`);
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "scratch/ace_dtr_final_signed.png" });
    await browser.close();
    console.log("Rendered scratch/ace_dtr_final_signed.png!");
  }
}

main().catch(console.error);
