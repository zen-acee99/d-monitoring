import { safeLoadPdfDocument, findPersonnelSignatureCoordinates } from '../src/utils/dtrVectorPdf';
import { PDFName, PDFArray, PDFNumber, PDFDict } from 'pdf-lib';
import fs from 'fs';

(async () => {
  const bytes = fs.readFileSync('scratch/cert_test.pdf');
  const pdfDoc = await safeLoadPdfDocument(bytes);
  const page = pdfDoc.getPages()[0];

  // Primary signer: Annabel
  const locAnnabel = findPersonnelSignatureCoordinates(pdfDoc, 'DIR. ANNABEL C. ODOÑO-CALIMPONG');
  console.log('Primary Signer (Annabel):', locAnnabel);

  // Add Annabel's signature widget to the PDF page annotations
  const form = pdfDoc.getForm();
  const annot = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [locAnnabel.boxX, locAnnabel.boxY, locAnnabel.boxX + locAnnabel.boxW, locAnnabel.boxY + locAnnabel.boxH],
  });
  const annotRef = pdfDoc.context.register(annot);
  let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) {
    annots = pdfDoc.context.obj([]) as any;
    page.node.set(PDFName.of('Annots'), annots!);
  }
  annots!.push(annotRef);

  // Counter-signer: Ace Malto
  const locAceCounter = findPersonnelSignatureCoordinates(pdfDoc, 'ACE MALTO', {
    isCounterSign: true,
    counterSignIndex: 0,
    counterSignPosition: 'auto'
  });
  console.log('Counter-Signer (Ace Malto):', locAceCounter);
  console.log('Gap between Ace and Annabel:', locAnnabel.boxX - (locAceCounter.boxX + locAceCounter.boxW), 'pt');
})();
