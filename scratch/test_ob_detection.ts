import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { extractPageContentStreamBytes, loadPageFontCMaps, extractTextItemsFromContentStream } from '../src/utils/dtrVectorPdf';

async function testDetection() {
  const pdfPath = 'C:/Users/Ace/.gemini/antigravity/brain/1b01b64c-6b31-4d10-a765-fcb7ef57f509/.user_uploaded/media_1794696272616_577d24d5.pdf';
  const bytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(bytes);
  const page = pdfDoc.getPage(0);
  const { width, height } = page.getSize();
  const sBytes = extractPageContentStreamBytes(pdfDoc, page);
  const fontCMaps = loadPageFontCMaps(pdfDoc, page);
  const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);
  const fullPageText = textItems.map((it) => it.text).join(" ").toUpperCase();

  const isObSlip =
    fullPageText.includes("OFFICIAL BUSINESS (OB) SLIP") ||
    fullPageText.includes("OFFICIAL BUSINESS") ||
    fullPageText.includes("OB SLIP") ||
    fullPageText.includes("AFD FORM NO. 05");

  console.log("isObSlip:", isObSlip);

  if (isObSlip) {
    const boxW = 195;
    const boxH = 32;

    // Signature 1: Approved by section
    const approvedMatches = textItems.filter((it) => {
      const u = it.text.toUpperCase();
      return (
        (u.includes("BUEN") && it.y > 230 && it.y < 420) ||
        (u.includes("APPROVED BY") && it.y > 230 && it.y < 420)
      );
    });

    let sig1X = 235;
    let sig1Y = 338;
    const buenaApproveItem = approvedMatches.find((it) => it.text.toUpperCase().includes("BUEN"));
    if (buenaApproveItem) {
      sig1Y = Math.round(buenaApproveItem.y + 10);
      const nameCenter = buenaApproveItem.x + (buenaApproveItem.text.length * 6.5) / 2;
      sig1X = Math.round(nameCenter - boxW / 2);
      sig1X = Math.max(180, Math.min(280, sig1X));
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
        it.y > 100
      );
    });
    const tableBuenaMatches = textItems.filter((it) => {
      const u = it.text.toUpperCase();
      return u.includes("BUEN") && it.y < 230 && it.y > 100;
    });

    let sig2X = 310;
    let sig2Y = 184;
    if (guardMatches.length > 0) {
      const guardItem = guardMatches[0];
      sig2X = Math.round(guardItem.x + 10);
      sig2Y = Math.round(guardItem.y + 25);
    } else if (tableBuenaMatches.length > 0) {
      const bItem = tableBuenaMatches[0];
      sig2X = Math.round(bItem.x - 50);
      sig2Y = Math.round(bItem.y - 13);
    }

    console.log(`Sig 1 (Approved by): [${sig1X}, ${sig1Y}, ${boxW}, ${boxH}]`);
    console.log(`Sig 2 (Departure Guard/Officer): [${sig2X}, ${sig2Y}, ${boxW}, ${boxH}]`);
  }
}
testDetection().catch(console.error);
