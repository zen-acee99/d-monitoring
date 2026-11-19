import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';
import { signPdfBuffer, decryptP12Password } from '../server/services/pnpkiSigningService';
import { RENE_JANE_SIGNATURE_BASE64, RENE_JANE_CERT_METADATA } from '../src/utils/reneJaneAutoSign';

async function testSignOb() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const incomingBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(incomingBytes);
  const pageCount = pdfDoc.getPageCount();

  let targetPageIndex = 0;
  let docType = "GENERAL_DOCUMENT";
  let sigRects: [number, number, number, number][] = [];

  for (let pIdx = 0; pIdx < pageCount; pIdx++) {
    const page = pdfDoc.getPage(pIdx);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);
    const fullPageText = textItems.map((it) => it.text).join(" ").toUpperCase();

    const isObSlip =
      fullPageText.includes("OFFICIAL BUSINESS (OB) SLIP") ||
      fullPageText.includes("OFFICIAL BUSINESS") ||
      fullPageText.includes("OB SLIP") ||
      fullPageText.includes("AFD FORM NO. 05") ||
      fullPageText.includes("NATURE OF LEAVING THE OFFICIAL STATION") ||
      (fullPageText.includes("APPROVED BY") && fullPageText.includes("DATE OF DEPARTURE"));

    if (isObSlip) {
      docType = "OB_SLIP";
      targetPageIndex = pIdx;
      const boxW = 195;
      const boxH = 32;

      // Signature 1: Approved by section
      const approvedMatches = textItems.filter((it) => {
        const u = it.text.toUpperCase();
        return (
          (u.includes("BUEN") && it.y > 220 && it.y < 420) ||
          (u.includes("APPROVED BY") && it.y > 220 && it.y < 420)
        );
      });

      let sig1X = 235;
      let sig1Y = 338;
      const buenaApproveItem = approvedMatches.find((it) => it.text.toUpperCase().includes("BUEN"));
      if (buenaApproveItem) {
        sig1Y = Math.round(buenaApproveItem.y + 10);
        const nameCenter = buenaApproveItem.x + (buenaApproveItem.text.length * 6.5) / 2;
        sig1X = Math.round(nameCenter - boxW / 2);
        sig1X = Math.max(160, Math.min(width - boxW - 20, sig1X));
      } else {
        const approveItem = approvedMatches.find((it) => it.text.toUpperCase().includes("APPROVED BY"));
        if (approveItem) {
          sig1Y = Math.round(approveItem.y - 10);
        }
      }

      // Signature 2: Departure table under Guard on Duty / Provincial Officer
      const guardMatches = textItems.filter((it) => {
        const u = it.text.toUpperCase();
        return (
          (u.includes("GUARD ON DUTY") || u.includes("PROVINCIAL OFFICER")) &&
          it.y < 230 &&
          it.y > 90
        );
      });
      const tableBuenaMatches = textItems.filter((it) => {
        const u = it.text.toUpperCase();
        return u.includes("BUEN") && it.y < 230 && it.y > 90;
      });

      let sig2X = 310;
      let sig2Y = 184;
      if (guardMatches.length > 0) {
        const guardItem = guardMatches[0];
        sig2X = Math.round(guardItem.x + 10);
        sig2Y = Math.round(guardItem.y + 25);
      } else if (tableBuenaMatches.length > 0) {
        const bItem = tableBuenaMatches[0];
        sig2X = Math.round(bItem.x - 54);
        sig2Y = Math.round(bItem.y - 13);
      }

      sigRects = [
        [sig1X, sig1Y, boxW, boxH],
        [sig2X, sig2Y, boxW, boxH],
      ];
      break;
    }
  }

  console.log("Detected DocType:", docType);
  console.log("Target page:", targetPageIndex);
  console.log("Signature Rectangles:", sigRects);

  // Read p12 from Turso or database fallback
  const dotenv = await import('dotenv');
  dotenv.config();
  const { createClient } = await import('@libsql/client/web');
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "",
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });
  const p12Row = await db.execute({
    sql: "SELECT p12, p12_password, image_digiSigned FROM dtr_generator WHERE id = 'dtr-sig-sup-01' LIMIT 1",
    args: [],
  });
  console.log("Found p12 row:", p12Row.rows.length);
  const row = p12Row.rows[0];
  const p12Base64 = String(row.p12);
  const password = decryptP12Password(String(row.p12_password));

  const signResult = await signPdfBuffer(
    Buffer.from(incomingBytes),
    p12Base64,
    password,
    {
      pageIndex: targetPageIndex,
      sigRects,
      fieldName: "Supervisor_Signature_OB",
      signatureImage: RENE_JANE_SIGNATURE_BASE64,
      signerName: "Buena Rene Jane Rosendo",
      reason: "Official Business (OB) Slip Provincial Officer Verification & Approval",
    }
  );

  console.log("Signed PDF byte length:", signResult.signedBuffer.length);
  fs.writeFileSync('scratch/signed_ob_slip.pdf', signResult.signedBuffer);
  console.log("Successfully wrote signed PDF to scratch/signed_ob_slip.pdf");

  // Inspect the signed PDF
  const signedDoc = await PDFDocument.load(signResult.signedBuffer);
  const p1 = signedDoc.getPage(0);
  const annots = p1.node.Annots();
  console.log("P1 Annot count in signed doc:", annots ? annots.size() : 0);
  if (annots) {
    for (let i = 0; i < annots.size(); i++) {
      const a = annots.lookup(i);
      const rect = a.get(a.context.obj('/Rect'));
      const t = a.get(a.context.obj('/T'));
      console.log(`Annot ${i+1}: T=${t?.toString()}, Rect=${rect?.toString()}`);
    }
  }
}

testSignOb().catch(console.error);
