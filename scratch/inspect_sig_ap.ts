import fs from 'fs';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';

async function main() {
  const bytes = fs.readFileSync('scratch/masareta_from_db.pdf');
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const field = form.getField('Signature_3_Annabel_C__Odo_o_Calimpong');
  const widget = field.acroField.getWidgets()[0];
  console.log('Widget rect:', widget.getRectangle());
  const ap = widget.dict.get(PDFName.of('AP')) as PDFDict;
  const n = ap?.get(PDFName.of('N'));
  if (n) {
    const raw = doc.context.lookup(n) as any;
    console.log('N raw type:', raw?.constructor?.name);
    console.log('N dict entries:');
    for (const key of raw.dict.keys()) {
      console.log('  ', key.asString(), ':', raw.dict.get(key)?.toString());
    }
    const contents = raw.getContents ? raw.getContents() : raw.contents;
    if (contents) {
      console.log('N text contents:\n', Buffer.from(contents).toString('utf8'));
    }
  }
}

main().catch(console.error);
