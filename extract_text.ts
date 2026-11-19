import { PDFDocument } from "pdf-lib";
import fs from "fs";
import { extractPageContentStreamBytes, extractTextItemsFromContentStream, loadPageFontCMaps } from "./server/services/pnpkiSigningService";

async function main() {
    const pdfPath = "C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\dict-monitoring\\scratch\\signed_ob_slip.pdf";
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const page = pdfDoc.getPage(0); // Assuming it's the first page
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const contentBytes = extractPageContentStreamBytes(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(contentBytes, fontCMaps);
    
    console.log(JSON.stringify(textItems, null, 2));
}

main().catch(console.error);
