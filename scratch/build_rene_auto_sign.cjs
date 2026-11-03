const fs = require('fs');
const b64 = 'data:image/png;base64,' + fs.readFileSync('scratch/rene_sig_correct.png').toString('base64');

const template = `import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { dtrGeneratorApi } from "@/services/api";
import {
  normalizePdfAnnotations,
  findApprovalSectionCoordinates,
  extractPageContentStreamBytes,
  loadPageFontCMaps,
  extractTextItemsFromContentStream,
} from "./dtrVectorPdf";

/**
 * Transparent digital signature stroke for Provincial Officer Rene Jane R. Buena.
 * Bundled as embedded Base64 data URL fallback ensuring 100% offline and network-resilient availability.
 */
export const RENE_JANE_SIGNATURE_BASE64 = "${b64}";

/**
 * Verified PNPKI Digital Certificate & Officer Credentials for Supervisor Rene Jane R. Buena
 * Stored in Turso database dtr_generator (id: 'dtr-sig-sup-01', user_Id: 'usr-mu72vs2b').
 */
export const RENE_JANE_CERT_METADATA = {
  commonName: "Buena Rene Jane Rosendo",
  role: "Provincial Officer",
  organization: "Department of Information and Communications Technology",
  station: "DICT Albay Provincial Office, Region V",
  serialNumber: "1b0236e3df7a794efe92814091c5b4b06ca83066",
  issuerCN: "Government Signing CA - G2",
  issuerDN: "CN=Government Signing CA - G2, O=DICT, C=PH",
  rootCA: "Philippine Root CA - G2",
  algorithm: "SHA256withRSA (2048 bit)",
  sha256Fingerprint: "0E:56:83:CD:84:C6:02:B6:68:81:F2:BF:CF:56:51:61:CD:71:EA:B5:A8:5B:CC:F7:85:F0:86:5B:C3:71:6C:2D",
  validity: "2026.04.16 – 2028.04.15",
  p12ProfileId: "dtr-sig-sup-01",
  userId: "usr-mu72vs2b",
};

export interface ReneJaneAutoSignResult {
  success: boolean;
  signedPdfBytes?: Uint8Array;
  signedPdfBase64?: string;
  blobUrl?: string;
  downloadFilename: string;
  docType: "DTR" | "AR" | "GENERAL_DOCUMENT";
  detectedReason: string;
  pageIndex: number; // 0-based
  signatureCount: number;
  signerIdentity: typeof RENE_JANE_CERT_METADATA & {
    timestamp: string;
  };
  isCryptographic: boolean;
  error?: string;
}

/**
 * Intelligently inspects the structure of any PDF to detect whether it is a
 * Civil Service Form No. 48 (DTR), an Accomplishment Report (AR), or general official document,
 * and pinpoints optimal signature coordinates for Supervisor Rene Jane R. Buena.
 */
export function detectSignatureCoordinatesForReneJane(pdfDoc: PDFDocument): {
  docType: "DTR" | "AR" | "GENERAL_DOCUMENT";
  targetPageIndex: number;
  sigRects: Array<[number, number, number, number]>;
  detectedReason: string;
} {
  const pageCount = pdfDoc.getPageCount();
  if (pageCount === 0) {
    return {
      docType: "GENERAL_DOCUMENT",
      targetPageIndex: 0,
      sigRects: [[320, 80, 125, 26]],
      detectedReason: "Default placement on empty document",
    };
  }

  // 1. Scan pages for Civil Service Form No. 48 / DTR
  for (let pIdx = 0; pIdx < pageCount; pIdx++) {
    const page = pdfDoc.getPage(pIdx);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    const hasDtrHeader = textItems.some((it) => {
      const u = it.text.toUpperCase();
      return (
        u.includes("CIVIL SERVICE FORM") ||
        u.includes("DAILY TIME RECORD") ||
        u.includes("FORM NO. 48") ||
        u.includes("CS FORM 48") ||
        u.includes("VERIFIED AS TO THE PRESCRIBED")
      );
    });

    if (hasDtrHeader) {
      const leftItems = textItems.filter((it) => it.x < width * 0.5);
      const rightItems = textItems.filter((it) => it.x >= width * 0.5);

      const hasDualHeaders =
        leftItems.some((it) => {
          const u = it.text.toUpperCase();
          return u.includes("DAILY TIME RECORD") || u.includes("CIVIL SERVICE") || u.includes("VERIFIED");
        }) &&
        rightItems.some((it) => {
          const u = it.text.toUpperCase();
          return u.includes("DAILY TIME RECORD") || u.includes("CIVIL SERVICE") || u.includes("VERIFIED");
        });

      const isDual = width >= 500 && (hasDualHeaders || rightItems.length > 20);

      const inChargeMatches = textItems.filter((it) => {
        const u = it.text.toUpperCase();
        return u.includes("IN CHARGE") || u.includes("VERIFIED") || u.includes("OFFICE HOURS");
      });

      let detectedY = 52; // Default fallback for letter CS Form 48
      if (inChargeMatches.length > 0) {
        inChargeMatches.sort((a, b) => a.y - b.y);
        const refItem = inChargeMatches[0];
        if (refItem.text.toUpperCase().includes("IN CHARGE")) {
          detectedY = Math.round(refItem.y + 10);
        } else {
          detectedY = Math.max(30, Math.round(refItem.y - 38));
        }
      }

      const boxW = 125;
      const boxH = 26;

      if (isDual) {
        const halfW = width / 2;
        const boxX1 = Math.round((halfW - boxW) / 2 + 10);
        const boxX2 = Math.round(halfW + (halfW - boxW) / 2 + 10);
        return {
          docType: "DTR",
          targetPageIndex: pIdx,
          sigRects: [
            [boxX1, detectedY, boxW, boxH],
            [boxX2, detectedY, boxW, boxH],
          ],
          detectedReason: "Civil Service Form No. 48 detected on page " + (pIdx + 1) + " — dual supervisor signature applied (Copy 1 & Copy 2)",
        };
      } else {
        const boxX = Math.round((width - boxW) / 2);
        return {
          docType: "DTR",
          targetPageIndex: pIdx,
          sigRects: [[boxX, detectedY, boxW, boxH]],
          detectedReason: "Civil Service Form No. 48 detected on page " + (pIdx + 1) + " — supervisor signature applied above In Charge",
        };
      }
    }
  }

  // 2. Scan for Accomplishment Report (AR)
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pdfDoc.getPage(pIdx);
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    const hasArHeader = textItems.some((it) => {
      const u = it.text.toUpperCase();
      return (
        u.includes("ACCOMPLISHMENT REPORT") ||
        u.includes("MONTHLY ACCOMPLISHMENT") ||
        u.includes("DELIVERABLES") ||
        u.includes("INDIVIDUAL ACCOMPLISHMENT")
      );
    });

    if (hasArHeader) {
      const arLoc = findApprovalSectionCoordinates(pdfDoc, "RENE JANE R. BUENA");
      return {
        docType: "AR",
        targetPageIndex: arLoc.pageIndex,
        sigRects: [[arLoc.boxX, arLoc.boxY, arLoc.boxW, arLoc.boxH]],
        detectedReason: "Accomplishment Report detected — supervisor approval section matched on page " + (arLoc.pageIndex + 1),
      };
    }
  }

  // 3. General Official Document — scan for approval headers or supervisor titles
  for (let pIdx = pageCount - 1; pIdx >= 0; pIdx--) {
    const page = pdfDoc.getPage(pIdx);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    for (const item of textItems) {
      const u = item.text.toUpperCase();
      const isSupervisorName = u.includes("BUENA") && (u.includes("RENE") || u.includes("JANE"));
      const isApprovedBy =
        (u.includes("APPROVED BY") || u.includes("APPROVED:") || u.includes("RECOMMENDING APPROVAL")) &&
        item.x > width * 0.3;
      const isProvincialOfficer = u.includes("PROVINCIAL OFFICER") && item.x > width * 0.3;

      if (isSupervisorName || isApprovedBy || isProvincialOfficer) {
        const boxW = 125;
        const boxH = 26;
        let boxX = Math.round(item.x);
        let boxY = Math.round(item.y + 12);
        if (isApprovedBy) {
          boxY = Math.max(30, Math.round(item.y - 48));
        }
        boxX = Math.max(20, Math.min(width - boxW - 20, boxX));
        boxY = Math.max(20, Math.min(height - boxH - 20, boxY));

        return {
          docType: "GENERAL_DOCUMENT",
          targetPageIndex: pIdx,
          sigRects: [[boxX, boxY, boxW, boxH]],
          detectedReason: 'Official document signature block matched "' + item.text + '" on page ' + (pIdx + 1) + ' at (' + boxX + ', ' + boxY + ')',
        };
      }
    }
  }

  // 4. Fallback for generic document: place on last page bottom-right quadrant
  const lastPageIdx = pageCount - 1;
  const lastPage = pdfDoc.getPage(lastPageIdx);
  const { width, height } = lastPage.getSize();
  const boxW = 125;
  const boxH = 26;
  const boxX = Math.round(width * 0.52);
  const boxY = Math.round(height * 0.16);

  return {
    docType: "GENERAL_DOCUMENT",
    targetPageIndex: lastPageIdx,
    sigRects: [[boxX, boxY, boxW, boxH]],
    detectedReason: "Official signature placed in standard supervisor approval quadrant on page " + (lastPageIdx + 1) + " at (" + boxX + ", " + boxY + ")",
  };
}

/**
 * Universal Auto-Sign Engine for Supervisor Rene Jane R. Buena.
 * Accepts any uploaded PDF (DTR, AR, or general official document),
 * applies her transparent visual signature and certified PNPKI credentials,
 * performs ISO 32000 cryptographic digital signing via backend, and returns
 * the signed document along with live Blob URL and certificate audit metadata.
 */
export async function autoSignPdfWithReneJane(
  fileOrBytes: File | Blob | Uint8Array | ArrayBuffer,
  filename = "Document.pdf"
): Promise<ReneJaneAutoSignResult> {
  try {
    // 1. Convert input to Uint8Array
    let incomingBytes: Uint8Array;
    if (fileOrBytes instanceof Uint8Array) {
      incomingBytes = fileOrBytes;
    } else if (fileOrBytes instanceof ArrayBuffer) {
      incomingBytes = new Uint8Array(fileOrBytes);
    } else {
      const buffer = await (fileOrBytes as any).arrayBuffer();
      incomingBytes = new Uint8Array(buffer);
    }

    // 2. Load PDF
    const pdfDoc = await PDFDocument.load(incomingBytes, { ignoreEncryption: true });

    // 3. Detect placement
    const { docType, targetPageIndex, sigRects, detectedReason } = detectSignatureCoordinatesForReneJane(pdfDoc);
    const targetPage = pdfDoc.getPage(targetPageIndex);

    // 4. Embed Rene Jane's visual signature image
    let sigImgBytes: Uint8Array;
    try {
      const resp = await fetch("/signatures/rene-jane-r-buena-signature.png");
      if (resp.ok) {
        sigImgBytes = new Uint8Array(await resp.arrayBuffer());
      } else {
        throw new Error("Local signature image fetch not ok");
      }
    } catch {
      const cleanB64 = RENE_JANE_SIGNATURE_BASE64.replace(/^data:image\\/\\w+;base64,/, "");
      const bin = atob(cleanB64);
      sigImgBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        sigImgBytes[i] = bin.charCodeAt(i);
      }
    }

    const embeddedPng = await pdfDoc.embedPng(sigImgBytes);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const formattedTimestamp = \`\${now.getFullYear()}.\${pad(now.getMonth() + 1)}.\${pad(now.getDate())} \${pad(now.getHours())}:\${pad(now.getMinutes())}:\${pad(now.getSeconds())} +08'00'\`;

    // Draw on all detected rectangles
    sigRects.forEach(([rx, ry, rw, rh]) => {
      targetPage.drawImage(embeddedPng, {
        x: rx + 2,
        y: ry + 2,
        width: 38,
        height: rh - 4,
      });

      const textX = rx + 44;
      targetPage.drawText("Digitally signed", {
        x: textX,
        y: ry + 14.5,
        size: 5.8,
        font: helveticaBold,
        color: rgb(0.08, 0.20, 0.50),
      });

      targetPage.drawText("by Buena Rene Jane Rosendo", {
        x: textX,
        y: ry + 8,
        size: 5.5,
        font: helveticaBold,
        color: rgb(0.0, 0.0, 0.0),
      });

      targetPage.drawText("Date: " + formattedTimestamp, {
        x: textX,
        y: ry + 2,
        size: 4.8,
        font: helvetica,
        color: rgb(0.25, 0.30, 0.40),
      });
    });

    let modifiedBytes = await pdfDoc.save({ useObjectStreams: false });
    modifiedBytes = await normalizePdfAnnotations(modifiedBytes);

    // 5. Cryptographic PNPKI Signing via Backend API
    let finalBytes = modifiedBytes;
    let isCryptographic = false;

    try {
      let binary = "";
      const len = modifiedBytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(modifiedBytes[i]);
      }
      const rawPdfBase64 = btoa(binary);

      const reason =
        docType === "DTR"
          ? "Civil Service Form No. 48 Official Verification"
          : docType === "AR"
          ? "Accomplishment Report Verification & Official Approval"
          : "Official DICT Document Supervisor Verification & Approval";

      const fieldName =
        docType === "DTR" && sigRects.length > 1
          ? "Supervisor_Signature_Copy1"
          : "Supervisor_Signature_ReneJane";

      const signResult = await dtrGeneratorApi.signPdfDocument({
        pdfBase64: rawPdfBase64,
        profileId: RENE_JANE_CERT_METADATA.p12ProfileId,
        user_Id: RENE_JANE_CERT_METADATA.userId,
        sigRect: sigRects[0],
        sigRects: sigRects,
        fieldName,
        pageIndex: targetPageIndex,
        reason,
      });

      if (signResult.success && signResult.signedPdfBase64) {
        const signedBin = atob(signResult.signedPdfBase64);
        const signedBytes = new Uint8Array(signedBin.length);
        for (let i = 0; i < signedBin.length; i++) {
          signedBytes[i] = signedBin.charCodeAt(i);
        }
        finalBytes = signedBytes;
        isCryptographic = true;
      }
    } catch (cryptoErr) {
      console.warn("Backend cryptographic signing fallback to visual stamp:", cryptoErr);
    }

    // 6. Generate Clean Download Filename
    const cleanBaseName = filename.replace(/\\.pdf$/i, "");
    const downloadFilename = \`\${cleanBaseName}_Signed_ReneJane.pdf\`;

    // 7. Create Blob URL
    const blob = new Blob([finalBytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    return {
      success: true,
      signedPdfBytes: finalBytes,
      blobUrl,
      downloadFilename,
      docType,
      detectedReason,
      pageIndex: targetPageIndex,
      signatureCount: sigRects.length,
      signerIdentity: {
        ...RENE_JANE_CERT_METADATA,
        timestamp: formattedTimestamp,
      },
      isCryptographic,
    };
  } catch (error: any) {
    console.error("Auto-sign with Rene Jane failed:", error);
    return {
      success: false,
      downloadFilename: \`\${filename.replace(/\\.pdf$/i, "")}_Signed_ReneJane.pdf\`,
      docType: "GENERAL_DOCUMENT",
      detectedReason: "Signing failed",
      pageIndex: 0,
      signatureCount: 0,
      signerIdentity: {
        ...RENE_JANE_CERT_METADATA,
        timestamp: new Date().toISOString(),
      },
      isCryptographic: false,
      error: error?.message || "Failed to auto-sign document with Rene Jane R. Buena",
    };
  }
}
`;

fs.writeFileSync('src/utils/reneJaneAutoSign.ts', template);
fs.writeFileSync('../dict-dtr-generator/src/utils/reneJaneAutoSign.ts', template);
console.log('Successfully wrote src/utils/reneJaneAutoSign.ts in both repositories!');
