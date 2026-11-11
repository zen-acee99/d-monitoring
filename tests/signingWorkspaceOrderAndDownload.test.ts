import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sortDocumentsLatestFirst,
  getDocTimestamp,
  parseDocTimestampSafe,
  formatTargetPdfFilename,
  generateWorkspaceFallbackPdfBytes,
  WorkspaceDocument,
} from "../src/pages/SigningWorkspace.js";

function makeDoc(partial: Partial<WorkspaceDocument>): WorkspaceDocument {
  return {
    id: partial.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fileName: partial.fileName || "Sample.pdf",
    fileSize: partial.fileSize || "1.0 MB",
    uploadedAt: partial.uploadedAt || new Date().toISOString(),
    uploadedBy: partial.uploadedBy || "Test User",
    status: partial.status || "pending",
    targetPersonnel: partial.targetPersonnel || "Personnel Name",
    requiredSigners: partial.requiredSigners || ["Personnel Name"],
    signers: partial.signers || [],
    counterSigners: partial.counterSigners || [],
    fileType: partial.fileType || "pdf",
    notes: partial.notes || "",
    isPendingSync: partial.isPendingSync,
    ...partial,
  };
}

console.log("======================================================================");
console.log("   AUTOMATED TEST SUITE: SIGNING WORKSPACE ORDER & DOWNLOAD TESTS     ");
console.log("======================================================================\n");

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 1: TIMESTAMP PARSING & NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────
console.log("[Group 1] Timestamp Parsing & UTC Normalization");

{
  // SQLite CURRENT_TIMESTAMP format (YYYY-MM-DD HH:MM:SS) vs ISO string
  const sqliteTime = "2026-11-11 04:00:00";
  const isoTime = "2026-11-11T04:00:00.000Z";
  const t1 = parseDocTimestampSafe(sqliteTime);
  const t2 = parseDocTimestampSafe(isoTime);
  assert.equal(t1, t2, "SQLite CURRENT_TIMESTAMP must parse to same UTC millisecond as ISO string");
  console.log("  PASS: SQLite UTC date parsing matches ISO standard exactly");
}

{
  // Epoch digits in string format
  const epochDigits = "1794370000000";
  const t = parseDocTimestampSafe(epochDigits);
  assert.equal(t, 1794370000000, "13-digit epoch string parsed correctly");
  console.log("  PASS: 13-digit epoch string parsing");
}

{
  // Extracting timestamp from ID when uploadedAt is empty
  const docWithIdTimestamp = makeDoc({
    id: "doc-upload-1794011790736-21-qj6x",
    uploadedAt: "",
  });
  const t = getDocTimestamp(docWithIdTimestamp);
  assert.equal(t, 1794011790736, "Timestamp extracted from doc ID fallback");
  console.log("  PASS: Fallback timestamp extraction from document ID pattern");
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 2: DOCUMENT QUEUE & MATRIX ORDERING (LATEST FIRST / FIRST ROW)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[Group 2] Latest Upload in First Row (Single & Batch)");

{
  // Single Upload: Existing docs vs New upload
  const existing1 = makeDoc({ id: "doc-1", fileName: "Old Doc 1.pdf", uploadedAt: "2026-11-10T10:00:00.000Z" });
  const existing2 = makeDoc({ id: "doc-2", fileName: "Old Doc 2.pdf", uploadedAt: "2026-11-10T12:00:00.000Z" });
  const newestUpload = makeDoc({ id: "doc-new", fileName: "Newest Upload.pdf", uploadedAt: "2026-11-11T04:15:00.000Z" });

  const sorted = sortDocumentsLatestFirst([existing1, existing2, newestUpload]);
  assert.equal(sorted[0].id, "doc-new", "Newest upload must be at index 0 (first row)");
  assert.equal(sorted[1].id, "doc-2");
  assert.equal(sorted[2].id, "doc-1");
  console.log("  PASS: Single upload immediately takes the first row (index 0)");
}

{
  // Batch Upload of 5 files: File 1 must be on row 1, File 2 on row 2, etc.
  const baseTime = Date.now();
  const batchCount = 5;
  const batchDocs: WorkspaceDocument[] = [];
  for (let i = 0; i < batchCount; i++) {
    const offsetMs = batchCount - 1 - i;
    batchDocs.push(
      makeDoc({
        id: `doc-upload-${baseTime}-${i}`,
        fileName: `Batch_File_${i + 1}.pdf`,
        uploadedAt: new Date(baseTime + offsetMs).toISOString(),
        isPendingSync: true,
      })
    );
  }

  const existingDocs = [
    makeDoc({ id: "old-1", fileName: "Existing 1.pdf", uploadedAt: new Date(baseTime - 100000).toISOString() }),
    makeDoc({ id: "old-2", fileName: "Existing 2.pdf", uploadedAt: new Date(baseTime - 50000).toISOString() }),
  ];

  const sorted = sortDocumentsLatestFirst([...existingDocs, ...batchDocs]);
  assert.equal(sorted[0].fileName, "Batch_File_1.pdf", "Batch File 1 must be at first row");
  assert.equal(sorted[1].fileName, "Batch_File_2.pdf", "Batch File 2 must be at second row");
  assert.equal(sorted[2].fileName, "Batch_File_3.pdf", "Batch File 3 must be at third row");
  assert.equal(sorted[3].fileName, "Batch_File_4.pdf", "Batch File 4 must be at fourth row");
  assert.equal(sorted[4].fileName, "Batch_File_5.pdf", "Batch File 5 must be at fifth row");
  assert.equal(sorted[5].fileName, "Existing 2.pdf");
  assert.equal(sorted[6].fileName, "Existing 1.pdf");
  console.log("  PASS: Batch upload items placed at top with File 1 strictly in row 1");
}

{
  // Regression Edge Case: Old doc with doc-upload- id vs newer doc with DTR- id
  const oldDocUpload = makeDoc({
    id: "doc-upload-1700000000000-0-abc",
    fileName: "Old Upload From 2023.pdf",
    uploadedAt: "2023-01-01T00:00:00.000Z",
    isPendingSync: false,
    status: "signed",
  });
  const newDtrDoc = makeDoc({
    id: "DTR-PROVINCIAL-871156-267",
    fileName: "New DTR From Today.pdf",
    uploadedAt: "2026-11-11T02:00:00.000Z",
    isPendingSync: false,
    status: "pending",
  });

  const sorted = sortDocumentsLatestFirst([oldDocUpload, newDtrDoc]);
  assert.equal(sorted[0].id, "DTR-PROVINCIAL-871156-267", "Newer DTR doc must be ahead of old doc-upload document");
  console.log("  PASS: Old doc-upload- prefixed document does NOT falsely jump ahead of newer documents");
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 3: PDF DOWNLOAD FORMATTING & FALLBACK
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n[Group 3] PDF Filename Formatting & Fallback Document Generation");

{
  // formatTargetPdfFilename
  assert.equal(formatTargetPdfFilename(makeDoc({ fileName: "report.txt" })), "report.pdf");
  assert.equal(formatTargetPdfFilename(makeDoc({ fileName: "memo.docx" })), "memo.pdf");
  assert.equal(formatTargetPdfFilename(makeDoc({ fileName: "document.doc" })), "document.pdf");
  assert.equal(formatTargetPdfFilename(makeDoc({ fileName: "signed.pdf" })), "signed.pdf");
  assert.equal(formatTargetPdfFilename(makeDoc({ fileName: "no_extension" })), "no_extension.pdf");
  console.log("  PASS: formatTargetPdfFilename guarantees .pdf extension across all input file types");
}

async function testPdfFallback() {
  const testDoc = makeDoc({
    id: "sw-fallback-test-001",
    fileName: "Transmittal_Test.docx",
    targetPersonnel: "ACE M. MALTO",
    province: "Albay",
    uploadedBy: "Admin",
    status: "pending",
    requiredSigners: ["ACE M. MALTO", "ENGR. RENE ROSENDO"],
    signers: [
      { name: "ACE M. MALTO", role: "Personnel", status: "pending", position: "above" },
      { name: "ENGR. RENE ROSENDO", role: "Regional Director", status: "signed", signedAt: "2026-11-11 12:00", position: "above" },
    ],
    counterSigners: [
      { name: "CARLA MAE R. CABREDO", role: "ARD", status: "counter-signed", position: "beside" },
    ],
  });

  const pdfBytes = await generateWorkspaceFallbackPdfBytes(testDoc);
  assert.ok(pdfBytes instanceof Uint8Array, "Must return Uint8Array");
  assert.ok(pdfBytes.byteLength > 500, "PDF bytes must be non-empty");

  // Check PDF Magic header (%PDF-)
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  assert.equal(header, "%PDF-", "Generated bytes must have valid %PDF- magic header");
  console.log(`  PASS: generateWorkspaceFallbackPdfBytes generates valid %PDF- binary (${pdfBytes.byteLength} bytes)`);
}

testPdfFallback().then(() => {
  console.log("\n======================================================================");
  console.log("ALL TESTS COMPLETED SUCCESSFULLY WITH 0 FAILURES!");
  console.log("======================================================================\n");
}).catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
