import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

async function runTest() {
  const png1x1 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  // 1. Without fix (simulating current signPdfBuffer)
  const doc1 = await PDFDocument.create();
  const page1 = doc1.addPage();
  const emb1 = await doc1.embedPng(png1x1);
  page1.drawImage(emb1, { x: 10, y: 10, width: 10, height: 10 });
  const saved1 = await doc1.save();
  const saved1Str = Buffer.from(saved1).toString("latin1");

  const imagesWithoutFix: string[] = [];
  for (const m of saved1Str.matchAll(/(\d+\s+0\s+obj[\s\S]*?endobj)/g)) {
    if (m[0].includes("/Subtype /Image") || m[0].includes("/Subtype/Image")) {
      imagesWithoutFix.push(m[0]);
    }
  }

  console.log("=== WITHOUT FIX ===");
  console.log(`Found ${imagesWithoutFix.length} image objects:`);
  for (const img of imagesWithoutFix) {
    const hasRes = img.includes("/Resources");
    console.log(`- Image object contains /Resources: ${hasRes}`);
  }

  // 2. With proposed fix (simulating updated signPdfBuffer)
  const doc2 = await PDFDocument.create();
  const page2 = doc2.addPage();
  const emb2 = await doc2.embedPng(png1x1);
  await emb2.embed();

  // Inject Resources into embedded image and any SMask
  const rawImg: any = doc2.context.lookup(emb2.ref);
  if (rawImg && rawImg.dict) {
    if (!rawImg.dict.has(PDFName.of("Resources"))) {
      rawImg.dict.set(PDFName.of("Resources"), doc2.context.obj({}));
    }
    const smaskRef = rawImg.dict.get(PDFName.of("SMask"));
    if (smaskRef) {
      const smaskObj: any = doc2.context.lookup(smaskRef);
      if (smaskObj && smaskObj.dict && !smaskObj.dict.has(PDFName.of("Resources"))) {
        smaskObj.dict.set(PDFName.of("Resources"), doc2.context.obj({}));
      }
    }
  }

  // Sweep all indirect objects before save
  for (const [ref, obj] of doc2.context.enumerateIndirectObjects()) {
    if (obj && (obj as any).dict) {
      const dict = (obj as any).dict;
      const subtype = dict.get(PDFName.of("Subtype"));
      if (
        (subtype === PDFName.of("Image") || subtype?.toString() === "/Image") &&
        !dict.has(PDFName.of("Resources"))
      ) {
        dict.set(PDFName.of("Resources"), doc2.context.obj({}));
      }
    }
  }

  page2.drawImage(emb2, { x: 10, y: 10, width: 10, height: 10 });
  const saved2 = await doc2.save();
  const saved2Str = Buffer.from(saved2).toString("latin1");

  const imagesWithFix: string[] = [];
  for (const m of saved2Str.matchAll(/(\d+\s+0\s+obj[\s\S]*?endobj)/g)) {
    if (m[0].includes("/Subtype /Image") || m[0].includes("/Subtype/Image")) {
      imagesWithFix.push(m[0]);
    }
  }

  console.log("\n=== WITH PROPOSED FIX ===");
  console.log(`Found ${imagesWithFix.length} image objects:`);
  for (const img of imagesWithFix) {
    const hasRes = img.includes("/Resources");
    console.log(`- Image object contains /Resources: ${hasRes}`);
  }
}

runTest().catch(console.error);
