import { PDFDocument } from "pdf-lib";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const ops = "(ANNABEL C. ODOÑO-CALIMPONG) Tj\n";
  const stream = doc.context.stream(ops);
  console.log("Stream contents:", stream.getContents());
  console.log("Stream char codes:", Array.from(stream.getContents()).map((b: any) => b));
}

main().catch(console.error);
