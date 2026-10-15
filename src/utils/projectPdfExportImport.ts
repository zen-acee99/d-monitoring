import { jsPDF } from "jspdf";

export interface SchemaFieldDef {
  key: string;
  label: string;
  type?: string;
  defaultValue?: any;
  options?: string[];
}

function censorPnpkiValue(projectId: string, key: string, val: any): string {
  const str = String(val ?? "");
  if (
    projectId.toLowerCase() === "pnpki" &&
    (key === "applicantName" || key === "fullName" || key === "subscriber")
  ) {
    const trimmed = str.trim();
    if (!trimmed) return "********";
    return trimmed
      .split(/\s+/)
      .map((part) => "*".repeat(Math.max(part.length, 4)))
      .join(" ");
  }
  return str;
}

/**
 * Generates and downloads a formatted landscape PDF report for a project's records.
 * Also embeds a machine-readable JSON marker so exported PDFs can be re-imported losslessly.
 */
export function exportProjectRecordsToPdf(params: {
  projectId: string;
  projectName: string;
  shortName: string;
  fields: SchemaFieldDef[];
  records: Record<string, any>[];
}): string {
  const { projectId, projectName, shortName, fields, records } = params;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const usableWidth = pageWidth - margin * 2;

  // Determine columns to render (up to 8 fields so table stays readable)
  const displayFields: SchemaFieldDef[] =
    fields && fields.length > 0
      ? fields.slice(0, 8)
      : records.length > 0
      ? Object.keys(records[0])
          .filter((k) => k !== "id")
          .slice(0, 8)
          .map((k) => ({ key: k, label: k }))
      : [{ key: "id", label: "Record ID" }];

  const colWidth = usableWidth / Math.max(displayFields.length, 1);

  const drawHeader = (pageNumber: number) => {
    doc.setFillColor(12, 16, 29);
    doc.rect(0, 0, pageWidth, 68, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(96, 165, 250);
    doc.text(
      "REPUBLIC OF THE PHILIPPINES • DEPARTMENT OF INFORMATION AND COMMUNICATIONS TECHNOLOGY (REGION V)",
      margin,
      22
    );

    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`${projectName} (${shortName}) — Official Data Report`, margin, 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    const timestamp = new Date().toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    doc.text(
      `Project Table: ${projectId}  |  Total Records: ${records.length}  |  Generated: ${timestamp}`,
      margin,
      56
    );
    doc.text(`Page ${pageNumber}`, pageWidth - margin - 45, 56);

    // Table column header bar
    const headerY = 78;
    doc.setFillColor(24, 35, 60);
    doc.rect(margin, headerY, usableWidth, 22, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240);
    displayFields.forEach((f, idx) => {
      const x = margin + idx * colWidth + 5;
      const label = String(f.label || f.key).toUpperCase();
      const clipped = doc.splitTextToSize(label, colWidth - 10)[0] || label;
      doc.text(clipped, x, headerY + 14);
    });
  };

  let pageNumber = 1;
  drawHeader(pageNumber);
  let currentY = 100;

  if (records.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("No records available in this project table.", margin + 8, currentY + 24);
  } else {
    records.forEach((row, rowIdx) => {
      // Prepare wrapped cell lines
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const cellLinesList = displayFields.map((f) => {
        const rawVal = censorPnpkiValue(projectId, f.key, row[f.key]);
        const lines = doc.splitTextToSize(rawVal || "—", colWidth - 10);
        return lines.slice(0, 3); // Max 3 lines per row cell
      });

      const maxLines = Math.max(1, ...cellLinesList.map((l) => l.length));
      const rowHeight = Math.max(20, maxLines * 10 + 8);

      if (currentY + rowHeight > pageHeight - 40) {
        doc.addPage();
        pageNumber += 1;
        drawHeader(pageNumber);
        currentY = 100;
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(241, 245, 249);
      }
      doc.rect(margin, currentY, usableWidth, rowHeight, "F");

      // Subtle row border
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY + rowHeight, margin + usableWidth, currentY + rowHeight);

      doc.setTextColor(30, 41, 59);
      cellLinesList.forEach((lines, colIdx) => {
        const x = margin + colIdx * colWidth + 5;
        lines.forEach((lineText: string, lineIdx: number) => {
          doc.text(String(lineText), x, currentY + 12 + lineIdx * 10);
        });
      });

      currentY += rowHeight;
    });
  }

  // Embed sanitized records in PDF subject/keywords metadata for lossless PDF import
  const sanitizedRecords = records.map((r) => {
    const copy: Record<string, any> = { ...r };
    if (projectId.toLowerCase() === "pnpki") {
      ["applicantName", "fullName", "subscriber"].forEach((k) => {
        if (copy[k] !== undefined) {
          copy[k] = censorPnpkiValue(projectId, k, copy[k]);
        }
      });
    }
    return copy;
  });

  try {
    const encodedPayload = btoa(unescape(encodeURIComponent(JSON.stringify(sanitizedRecords))));
    doc.setProperties({
      title: `${projectName} (${shortName}) Data Export`,
      subject: `DICT_PROJECT_JSON_B64:${encodedPayload}`,
      author: "DICT Region V Monitoring System",
      creator: "DICT Monitoring System",
    });
  } catch {
    // Ignore if payload exceeds metadata size
  }

  const filename = `DICT_${projectId}_records_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Extracts project records from an uploaded PDF file.
 * 1. First checks for embedded DICT_PROJECT_JSON_B64 metadata (lossless import of exported PDFs).
 * 2. Otherwise decompresses PDF streams and parses text rows into schema fields.
 */
export async function parsePdfFileToRecords(
  file: File,
  projectId: string,
  fields: SchemaFieldDef[]
): Promise<{ records: Record<string, any>[]; rawPreview: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const latin1 = new TextDecoder("latin1").decode(bytes);

  // 1. Check for embedded DICT_PROJECT_JSON_B64 payload in PDF metadata
  const markerMatch = latin1.match(/DICT_PROJECT_JSON_B64:([A-Za-z0-9+/=]+)/);
  if (markerMatch && markerMatch[1]) {
    try {
      const jsonStr = decodeURIComponent(escape(atob(markerMatch[1])));
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          records: parsed,
          rawPreview: JSON.stringify(parsed, null, 2),
        };
      }
    } catch {
      // Fall through to stream text extraction
    }
  }

  // 2. Extract text from PDF streams (both uncompressed and FlateDecode compressed streams)
  const extractedChunks: string[] = [];

  const extractPdfTextTokens = (content: string) => {
    // Match (...) Tj and [...] TJ blocks
    const tjRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    const lineTokens: string[] = [];
    while ((m = tjRegex.exec(content)) !== null) {
      const cleaned = m[1]
        .replace(/\\n/g, " ")
        .replace(/\\r/g, " ")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\")
        .trim();
      if (cleaned) lineTokens.push(cleaned);
    }

    const tjArrayRegex = /\[(.*?)\]\s*TJ/gs;
    while ((m = tjArrayRegex.exec(content)) !== null) {
      const inner = m[1];
      const strRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
      let sm: RegExpExecArray | null;
      let combined = "";
      while ((sm = strRegex.exec(inner)) !== null) {
        combined += sm[1]
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
      }
      if (combined.trim()) lineTokens.push(combined.trim());
    }
    return lineTokens;
  };

  // Find stream ... endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRegex.exec(latin1)) !== null) {
    const rawStreamStr = streamMatch[1];
    // Try direct token extraction first
    const directTokens = extractPdfTextTokens(rawStreamStr);
    if (directTokens.length > 0) {
      extractedChunks.push(...directTokens);
      continue;
    }

    // Try decompressing FlateDecode stream via DecompressionStream if available
    if (typeof DecompressionStream !== "undefined") {
      try {
        const streamBytes = new Uint8Array(rawStreamStr.length);
        for (let i = 0; i < rawStreamStr.length; i++) {
          streamBytes[i] = rawStreamStr.charCodeAt(i) & 0xff;
        }
        // zlib header usually starts with 0x78; try "deflate"
        const ds = new DecompressionStream("deflate");
        const writer = ds.writable.getWriter();
        writer.write(streamBytes).catch(() => {});
        writer.close().catch(() => {});
        const decompressedBuf = await new Response(ds.readable).arrayBuffer();
        const decompressedText = new TextDecoder("latin1").decode(decompressedBuf);
        const tokens = extractPdfTextTokens(decompressedText);
        if (tokens.length > 0) {
          extractedChunks.push(...tokens);
        }
      } catch {
        // Ignore non-deflate streams (e.g. images/fonts)
      }
    }
  }

  // Filter out header boilerplate lines
  const filteredTokens = extractedChunks.filter(
    (t) =>
      !t.startsWith("REPUBLIC OF THE PHILIPPINES") &&
      !t.includes("Official Data Report") &&
      !t.startsWith("Project Table:") &&
      !/^Page \d+$/.test(t)
  );

  const schemaFields =
    fields && fields.length > 0
      ? fields
      : [
          { key: "siteName", label: "Site Name" },
          { key: "province", label: "Province" },
          { key: "status", label: "Status" },
        ];

  const displayCols = schemaFields.slice(0, 8);
  const colCount = Math.max(displayCols.length, 1);

  // Remove column header tokens if they match displayCols labels
  let startIdx = 0;
  const upperLabels = displayCols.map((c) => String(c.label || c.key).toUpperCase());
  if (
    filteredTokens.length >= colCount &&
    upperLabels.every((lbl, i) =>
      filteredTokens[i]?.toUpperCase().includes(lbl.slice(0, Math.min(6, lbl.length)))
    )
  ) {
    startIdx = colCount;
  }

  const dataTokens = filteredTokens.slice(startIdx);
  const records: Record<string, any>[] = [];

  if (dataTokens.length > 0) {
    for (let i = 0; i < dataTokens.length; i += colCount) {
      const slice = dataTokens.slice(i, i + colCount);
      if (slice.length === 0) continue;
      const rowObj: Record<string, any> = {
        id: `${projectId}-pdf-${Date.now()}-${records.length + 1}`,
      };
      schemaFields.forEach((f, idx) => {
        if (idx < slice.length) {
          const raw = slice[idx] === "—" ? "" : slice[idx];
          rowObj[f.key] = f.type === "number" ? Number(raw) || 0 : raw;
        } else {
          rowObj[f.key] =
            f.defaultValue ?? (f.options ? f.options[0] : f.type === "number" ? 0 : "");
        }
      });
      records.push(rowObj);
    }
  }

  return {
    records,
    rawPreview: JSON.stringify(records, null, 2),
  };
}
