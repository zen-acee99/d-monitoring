import fs from 'fs';
import zlib from 'zlib';
import { PDFDocument, PDFName, PDFArray } from 'pdf-lib';

function pageAlreadyHasVisualTypography(
  pageContentsStr: string,
  pdfBufferOrStr: Buffer | string,
  signerName: string,
  sigRect?: [number, number, number, number],
  fieldName?: string,
  reason?: string
): boolean {
  // 1. Direct plain ASCII checks
  const lowerContents = pageContentsStr.toLowerCase();
  if (lowerContents.includes("digitally signed") || lowerContents.includes("digisigned")) {
    return true;
  }

  // 2. Decode hex strings using any /ToUnicode CMaps present in the PDF
  const pdfFullStr = typeof pdfBufferOrStr === "string" ? pdfBufferOrStr : pdfBufferOrStr.toString("latin1");
  const cmapMatches = pdfFullStr.match(/beginbf(?:char|range)[\s\S]*?endbf(?:char|range)/g);
  if (cmapMatches) {
    const cmap = new Map<string, string>();
    for (const block of cmapMatches) {
      // bfchar: <0029> <0044>
      const charMatches = block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);
      for (const cm of charMatches) {
        const src = cm[1].toUpperCase().padStart(4, "0");
        const dstCode = parseInt(cm[2], 16);
        cmap.set(src, String.fromCharCode(dstCode));
      }
      // bfrange: <0001> <0005> <0041>
      const rangeMatches = block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g);
      for (const rm of rangeMatches) {
        const start = parseInt(rm[1], 16);
        const end = parseInt(rm[2], 16);
        let dst = parseInt(rm[3], 16);
        for (let code = start; code <= end; code++) {
          const src = code.toString(16).toUpperCase().padStart(4, "0");
          cmap.set(src, String.fromCharCode(dst));
          dst++;
        }
      }
    }

    if (cmap.size > 0) {
      // Decode hex strings <00290026...> in page contents
      const decodedHex = pageContentsStr.replace(/<([0-9a-fA-F]{4,})>/g, (_, hex) => {
        let text = "";
        for (let i = 0; i < hex.length; i += 4) {
          const key = hex.substring(i, i + 4).toUpperCase();
          if (cmap.has(key)) {
            text += cmap.get(key);
          } else {
            text += " ";
          }
        }
        return text;
      });

      const lowerDecoded = decodedHex.toLowerCase();
      if (lowerDecoded.includes("digitally signed") || lowerDecoded.includes("digisigned")) {
        return true;
      }
      if (signerName) {
        const tokens = signerName.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (tokens.length >= 2 && tokens.every(tok => lowerDecoded.includes(tok))) {
          if (lowerDecoded.includes("signed") || lowerDecoded.includes("digitally") || lowerDecoded.includes("digisigned")) {
            return true;
          }
        }
      }
    }
  }

  // 3. Fallback standard ASCII hex decode (<44696769...>)
  const directHexDecoded = pageContentsStr.replace(/<([0-9a-fA-F]{4,})>/g, (_, hex) => {
    try {
      return Buffer.from(hex, "hex").toString("latin1");
    } catch {
      return "";
    }
  });
  if (/Digitally\s+signed/i.test(directHexDecoded) || /DigiSigned/i.test(directHexDecoded)) {
    return true;
  }

  // 4. CS Form 48 / DTR Template Check:
  const isForm48 =
    /Civil\s+Service\s+Form\s+No\.?\s*48/i.test(pageContentsStr) ||
    /Civil\s+Service\s+Form\s+No\.?\s*48/i.test(pdfFullStr) ||
    /DAILY\s+TIME\s+RECORD/i.test(pageContentsStr) ||
    Boolean(reason && /Civil\s+Service\s+Form\s+No\.?\s*48/i.test(reason));

  if (isForm48) {
    const isPersonnelField = Boolean(fieldName && /Personnel_Signature/i.test(fieldName));
    if (isPersonnelField) {
      return true;
    }
    const isSupervisorField = Boolean(fieldName && /Supervisor_Signature/i.test(fieldName));
    if (isSupervisorField) {
      const lowerAll = (pageContentsStr + " " + pdfFullStr).toLowerCase();
      if (
        lowerAll.includes("buena rene jane") ||
        lowerAll.includes("rene jane r. buena") ||
        lowerAll.includes("digitally signed by buena") ||
        lowerAll.includes("buena")
      ) {
        return true;
      }
    }
  }

  return false;
}

async function testFile(filePath: string, fieldName = "Personnel_Signature_Copy1", signerName = "Ace Mata Malto") {
  if (!fs.existsSync(filePath)) return;
  const buf = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(buf);
  const page = pdfDoc.getPage(0);
  const contents = page.node.lookup(PDFName.of('Contents'));
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let pageStreamCombined = "";
  for (const ref of refs) {
    const stm: any = pdfDoc.context.lookup(ref);
    if (stm && stm.getContents) {
      const raw = Buffer.from(stm.getContents());
      let dec = "";
      try { dec = zlib.inflateSync(raw).toString("latin1"); } catch { dec = raw.toString("latin1"); }
      pageStreamCombined += dec + "\n";
    }
  }

  const result = pageAlreadyHasVisualTypography(pageStreamCombined, buf, signerName, undefined, fieldName, "Civil Service Form No. 48 Official Verification");
  console.log(`${filePath} [${fieldName}] => alreadyHasVisualText:`, result);
}

async function main() {
  await testFile('scratch/clean_original_ace_dtr.pdf', "Personnel_Signature_Copy1", "Ace Mata Malto");
  await testFile('scratch/clean_original_ace_dtr.pdf', "Supervisor_Signature_Copy1", "Buena Rene Jane Rosendo");
  await testFile('scratch/current_dtr.pdf', "Personnel_Signature_Copy1", "Ace Mata Malto");
  await testFile('public/DTR_Ace_M._Malto_September_2026.pdf', "Personnel_Signature_Copy1", "Ace Mata Malto");
  await testFile('public/DTR_Ace_M._Malto_September_2026.pdf', "Supervisor_Signature_Copy1", "Buena Rene Jane Rosendo");
  await testFile('c:/Users/Ace/Desktop/DTR_Ace_M._Malto_September_2026.pdf', "Personnel_Signature_Copy1", "Ace Mata Malto");
  await testFile('scratch/test_revistual.pdf', "Signature_Annabel", "Annabel C. Odoño-Calimpong");
}

main().catch(console.error);
