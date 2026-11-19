import { PDFDocument, PDFName, PDFArray, PDFDict } from "pdf-lib";
import fs from "fs";

async function main() {
    const pdfPath = "C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\dict-monitoring\\scratch\\signed_ob_slip_arrival.pdf";
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const page = pdfDoc.getPage(0);
    
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annots) {
        for (let i = 0; i < annots.size(); i++) {
            const annotRef = annots.get(i);
            const dict = pdfDoc.context.lookup(annotRef, PDFDict);
            if (dict) {
                const rect = dict.lookupMaybe(PDFName.of("Rect"), PDFArray);
                console.log(`Annot ${i}: Rect = ${rect}`);
            }
        }
    }
}

main().catch(console.error);
