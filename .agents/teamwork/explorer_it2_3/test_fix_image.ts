import { PDFDocument, PDFRawStream, PDFDict, PDFName } from "pdf-lib";

async function testImageResources() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);

  // 16x16 red PNG with alpha
  const redPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mP8z8AARBgGhowBADIwAgH2Fh60AAAAAElFTkSuQmCC";
  const imgBuf = Buffer.from(redPngBase64, "base64");
  const embedded = await doc.embedPng(imgBuf);

  page.drawImage(embedded, {
    x: 100,
    y: 100,
    width: 30,
    height: 30,
  });

  // Flush so that all image streams are embedded into doc.context
  await doc.flush();

  // Inject /Resources << >> into all Image XObjects
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFRawStream ? obj.dict : (obj instanceof PDFDict ? obj : null);
    if (dict) {
      const subtype = dict.get(PDFName.of("Subtype"))?.toString();
      if (subtype === "/Image") {
        if (!dict.has(PDFName.of("Resources"))) {
          dict.set(PDFName.of("Resources"), doc.context.obj({}));
        }
      }
    }
  }

  const saved = await doc.save({ useObjectStreams: false });
  const pdfStr = Buffer.from(saved).toString("latin1");

  const imgMatches = [...pdfStr.matchAll(/(\d+)\s+0\s+obj\s*<<([\s\S]*?)\/Subtype\s*\/Image([\s\S]*?)>>/g)];
  console.log(`Total Image XObjects found: ${imgMatches.length}`);

  let allHaveResources = true;
  imgMatches.forEach((m, idx) => {
    const hasRes = m[0].includes("/Resources");
    console.log(`Image ${idx} (obj ${m[1]}): has /Resources = ${hasRes}`);
    console.log(m[0].slice(0, 300));
    if (!hasRes) allHaveResources = false;
  });

  console.log(`All Image XObjects have /Resources: ${allHaveResources}`);
}

testImageResources().catch(console.error);
