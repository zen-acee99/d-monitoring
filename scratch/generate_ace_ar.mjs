import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client/web";
import { decryptP12Password, signPdfBuffer } from "./pnpkiSigningService.mjs";
import puppeteer from "puppeteer-core";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
  console.log("=== GENERATING OFFICIAL SIGNED AR FOR ACE M. MALTO (SEPTEMBER 2026) ===");
  const inBuf = fs.readFileSync("c:/Users/Ace/Downloads/Documents/AR - Malto Sept 16-24_Signed.pdf");
  
  // Get Ace
  const aceRes = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-usr-mu3eob3l'");
  const aceRow = aceRes.rows[0];
  const acePw = decryptP12Password(aceRow.p12_password);

  // Get Rene
  const reneRes = await db.execute("SELECT * FROM dtr_generator WHERE id = 'dtr-sig-sup-01'");
  const reneRow = reneRes.rows[0];
  const renePw = decryptP12Password(reneRow.p12_password);

  console.log("Pass 1: Applying PNPKI Digital Signature for Ace M. Malto...");
  const rx1 = 35.7374;
  const ry1 = 483.495;
  const rw1 = 179.212 - rx1;
  const rh1 = 523.437 - ry1;

  const pass1 = await signPdfBuffer(
    inBuf,
    aceRow.p12,
    acePw,
    {
      sigRect: [rx1, ry1, rw1, rh1],
      pageIndex: 1,
      fieldName: "Personnel_Signature_AceMalto",
      reason: "Accomplishment Report Preparation & Digital Certification"
    }
  );
  console.log(`✓ Pass 1 completed (${pass1.signedBuffer.length} bytes).`);

  console.log("Pass 2: Applying Supervisor Automatic Digital Signature for Rene Jane R. Buena...");
  const rx2 = 319.42;
  const ry2 = 480.609;
  const rw2 = 410.402 - rx2;
  const rh2 = 509.409 - ry2;

  const pass2 = await signPdfBuffer(
    pass1.signedBuffer,
    reneRow.p12,
    renePw,
    {
      sigRect: [rx2, ry2, rw2, rh2],
      pageIndex: 1,
      fieldName: "Supervisor_Signature_ReneJane",
      reason: "Accomplishment Report Verification & Official Approval"
    }
  );
  const finalSignedBuffer = pass2.signedBuffer;
  console.log(`✓ Pass 2 completed (${finalSignedBuffer.length} bytes).`);

  const fileName = "AR_Ace_M._Malto_September_2026.pdf";
  const destinations = [
    path.resolve("c:/Users/Ace/Desktop", fileName),
    path.resolve(process.cwd(), "public", fileName),
    path.resolve(process.cwd(), "dist", fileName),
    path.resolve(process.cwd(), "../dict-dtr-generator/public", fileName),
    path.resolve(process.cwd(), "../dict-dtr-generator/dist", fileName),
    path.resolve("C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509", fileName),
  ];

  for (const dest of destinations) {
    try {
      const parent = path.dirname(dest);
      if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
      fs.writeFileSync(dest, finalSignedBuffer);
      console.log(`✓ Saved: ${dest}`);
    } catch (err) {
      console.warn(`Could not save to ${dest}:`, err.message);
    }
  }

  // Generate preview image using puppeteer
  try {
    const browser = await puppeteer.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--no-sandbox"],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1.5 });
    const localDest = path.resolve(process.cwd(), "public", fileName);
    await page.goto("file:///" + localDest.replace(/\\/g, "/") + "#page=2", { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 1500));
    const previewDest = "C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/AR_Ace_M._Malto_September_2026_preview.png";
    await page.screenshot({ path: previewDest });
    await browser.close();
    console.log(`✓ Saved preview: ${previewDest}`);
  } catch (err) {
    console.warn("Could not generate preview:", err.message);
  }

  // Update Turso database
  console.log("\nUpdating database record in Turso dtr_storage for AR...");
  const pdfDataUrl = "data:application/pdf;base64," + finalSignedBuffer.toString("base64");

  const storageId = "ar-store-usr-mu3eob3l-2026-09";

  await db.execute({
    sql: "DELETE FROM dtr_storage WHERE id = ?",
    args: [storageId]
  });

  await db.execute({
    sql: `INSERT INTO dtr_storage (
            id, user_id, employee_name, employee_id, position, employment_status,
            module, province, section_division, period_text, month, year, scope,
            regular_hours, saturday_hours, supervisor_name, supervisor_title,
            total_days_rendered, total_hours_rendered, undertime_hours, undertime_minutes,
            late_minutes, status, submitted_date, pdf_filename, pdf_filesize, pdf_data,
            has_p12, employee_has_p12, employee_signer_name, employee_signature_image,
            supervisor_has_p12, supervisor_signature_image, signer_name, rows_json,
            doc_type, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, CURRENT_TIMESTAMP, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            'AR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
    args: [
      storageId,
      "usr-mu3eob3l",
      "Ace M. Malto",
      "usr-mu3eob3l",
      "Project Development Officer II",
      "Regular",
      "PROVINCIAL",
      "Albay",
      "DICT Albay Provincial Office",
      "September 1–30, 2026",
      "September",
      2026,
      "Full Month",
      "8:00 AM - 5:00 PM",
      "As Required",
      "Rene Jane R. Buena",
      "Provincial Officer",
      22,
      "160.0",
      0,
      0,
      0,
      "Approved",
      fileName,
      finalSignedBuffer.length,
      pdfDataUrl,
      1,
      1,
      "Malto Ace Mata",
      "data:image/png;base64," + fs.readFileSync("scratch/sig_crop_exact.png").toString("base64"),
      1,
      "data:image/png;base64," + fs.readFileSync("scratch/rene_sig_correct.png").toString("base64"),
      "Buena Rene Jane Rosendo",
      JSON.stringify({
        type: "AR",
        document: "Accomplishment Report",
        period: "September 2026",
        autoSignedBy: "Rene Jane R. Buena",
        autoSignedRole: "Provincial Officer",
        approvalStatus: "Approved",
        pnpkiCertificates: ["Malto Ace Mata", "Buena Rene Jane Rosendo"]
      })
    ]
  });

  console.log("✓ Turso dtr_storage successfully updated for AR!");
  console.log("ALL AR GENERATION AND SIGNING COMPLETE!");
}

main().catch(console.error);
