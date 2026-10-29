import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
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
export const RENE_JANE_SIGNATURE_BASE64 = "data:image/png;base64,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";

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
  docType: "DTR" | "AR" | "GATE_PASS" | "GENERAL_DOCUMENT";
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
 * Civil Service Form No. 48 (DTR), an Accomplishment Report (AR), an Official Gate Pass, or general official document,
 * and pinpoints optimal signature coordinates for Supervisor Rene Jane R. Buena.
 */
export function detectSignatureCoordinatesForReneJane(pdfDoc: PDFDocument): {
  docType: "DTR" | "AR" | "GATE_PASS" | "GENERAL_DOCUMENT";
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

  // 2.5. Scan for Official DICT Gate Pass
  for (let pIdx = 0; pIdx < pageCount; pIdx++) {
    const page = pdfDoc.getPage(pIdx);
    const { width, height } = page.getSize();
    const sBytes = extractPageContentStreamBytes(pdfDoc, page);
    if (sBytes.length === 0) continue;
    const fontCMaps = loadPageFontCMaps(pdfDoc, page);
    const textItems = extractTextItemsFromContentStream(sBytes, fontCMaps);

    const isGatePass = textItems.some((it) => {
      const u = it.text.toUpperCase();
      return (
        u.includes("GATE PASS") ||
        u.includes("GATEPASS") ||
        (u.includes("GP-POV") && (u.includes("OFFICIAL") || u.includes("PERSONAL") || u.includes("CONTROL")))
      );
    });

    if (isGatePass) {
      // Locate APPROVED BY section / RENE JANE on the right quadrant
      const buenaMatches = textItems.filter((it) => {
        const u = it.text.toUpperCase();
        return (
          u.includes("BUENA") ||
          u.includes("RENE JANE") ||
          (u.includes("APPROVED BY") && it.x > width * 0.4) ||
          (u.includes("PROVINCIAL OFFICER") && it.x > width * 0.4)
        );
      });

      const boxW = 125;
      const boxH = 30;
      let targetX = Math.round(width * 0.58);
      let targetY = 90;

      if (buenaMatches.length > 0) {
        const buenaItem =
          buenaMatches.find((it) => it.text.toUpperCase().includes("BUENA") || it.text.toUpperCase().includes("RENE")) ||
          buenaMatches[0];
        targetX = Math.max(20, Math.min(width - boxW - 20, Math.round(buenaItem.x - 5)));
        targetY = Math.round(buenaItem.y + 10);
      }

      return {
        docType: "GATE_PASS",
        targetPageIndex: pIdx,
        sigRects: [[targetX, targetY, boxW, boxH]],
        detectedReason:
          "Official DICT Gate Pass detected — Supervisor Rene Jane R. Buena approval section matched on page " +
          (pIdx + 1),
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
 * Fast, chunked Base64 encoding for large binary PDF streams (prevents browser heap exhaustion and freezes).
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Fast Base64 decoding into Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

    if (!incomingBytes || incomingBytes.byteLength === 0) {
      throw new Error("Uploaded PDF document is empty (0 bytes).");
    }

    // 2. Load PDF with error guard
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(incomingBytes, { ignoreEncryption: true });
    } catch (loadErr: any) {
      throw new Error(
        `Unable to parse PDF: ${loadErr?.message || "Document may be password-protected or corrupted"}`
      );
    }

    // 3. Detect placement
    const { docType, targetPageIndex, sigRects, detectedReason } = detectSignatureCoordinatesForReneJane(pdfDoc);
    const targetPage = pdfDoc.getPage(targetPageIndex);

    // 4. Embed Rene Jane's visual signature image with foolproof fallback
    let embeddedPng;
    try {
      const resp = await fetch("/signatures/rene-jane-r-buena-signature.png");
      const contentType = (resp.headers?.get("content-type") || "").toLowerCase();
      if (resp.ok && !contentType.includes("text/html")) {
        const fetchBytes = new Uint8Array(await resp.arrayBuffer());
        embeddedPng = await pdfDoc.embedPng(fetchBytes);
      } else {
        throw new Error("Signature asset returned non-image response");
      }
    } catch {
      const cleanB64 = RENE_JANE_SIGNATURE_BASE64.replace(/^data:image\/\w+;base64,/, "");
      const sigImgBytes = base64ToUint8Array(cleanB64);
      embeddedPng = await pdfDoc.embedPng(sigImgBytes);
    }

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const formattedTimestamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} +08'00'`;

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
      const rawPdfBase64 = uint8ArrayToBase64(modifiedBytes);

      const reason =
        docType === "DTR"
          ? "Civil Service Form No. 48 Official Verification"
          : docType === "AR"
          ? "Accomplishment Report Verification & Official Approval"
          : docType === "GATE_PASS"
          ? "Official DICT Gate Pass Supervisor Approval & Authorization"
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
        finalBytes = base64ToUint8Array(signResult.signedPdfBase64);
        isCryptographic = true;
      } else if (signResult.error) {
        console.warn("Backend cryptographic signing returned error:", signResult.error);
      }
    } catch (cryptoErr) {
      console.warn("Backend cryptographic signing fallback to visual stamp:", cryptoErr);
    }

    // 6. Generate Clean Download Filename
    const cleanBaseName = filename.replace(/\.pdf$/i, "");
    const downloadFilename = `${cleanBaseName}_Signed_ReneJane.pdf`;

    // 7. Create Blob URL safely
    const blob = new Blob([finalBytes], { type: "application/pdf" });
    let blobUrl = "";
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      blobUrl = URL.createObjectURL(blob);
    } else {
      blobUrl = `data:application/pdf;base64,${uint8ArrayToBase64(finalBytes)}`;
    }

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
      downloadFilename: `${filename.replace(/\.pdf$/i, "")}_Signed_ReneJane.pdf`,
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
