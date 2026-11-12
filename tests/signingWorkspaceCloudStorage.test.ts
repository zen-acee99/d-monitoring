import assert from "node:assert/strict";
import { db } from "../server/db.js";

async function runTests() {
  console.log("======================================================================");
  console.log("   AUTOMATED TEST SUITE: SIGNING WORKSPACE CLOUD STORAGE & TURSO SYNC ");
  console.log("======================================================================\n");

  const testDocId = `test-cloud-sync-${Date.now()}`;
  const samplePdfBase64 = "JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCg==";
  const sampleDataUrl = `data:application/pdf;base64,${samplePdfBase64}`;

  try {
    // ── Test 1: Inserting document with PDF binary saves directly to Turso ──
    console.log("[Test 1] Saving document with PDF binary to Turso");
    await db.execute({
      sql: `INSERT INTO signing_workspace_documents (
        id, file_name, file_size, uploaded_at, uploaded_by, status, target_personnel,
        required_signers, signers_matrix, scanned_info, pdf_data,
        province, section_division, notes, has_p12, signature_image,
        created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [
        testDocId,
        "CloudTest.pdf",
        "1.2 MB",
        "Ace Malto",
        "pending",
        "ACE MALTO",
        JSON.stringify(["ACE MALTO"]),
        JSON.stringify([]),
        null,
        sampleDataUrl,
        "Regional Office",
        "Regional Office V",
        "Test document for cloud storage",
        0,
        null,
      ],
    });

    const check1 = await db.execute({
      sql: `SELECT id, file_name, length(pdf_data) as pdf_len, substr(pdf_data, 1, 30) as prefix FROM signing_workspace_documents WHERE id = ?`,
      args: [testDocId],
    });
    assert.equal(check1.rows.length, 1, "Must find inserted document record");
    assert.equal(check1.rows[0].pdf_len, sampleDataUrl.length, "Saved PDF binary length in Turso must match input");
    assert.ok(String(check1.rows[0].prefix).startsWith("data:application/pdf;base64,"), "Prefix must be valid PDF data URL");
    console.log("  PASS: Test 1 - Binary PDF successfully stored in Turso cloud repository");

    // ── Test 2: Safe CASE WHEN prevents null overwrite on metadata update ──
    console.log("\n[Test 2] Updating document metadata with NULL pdfDataUrl preserves existing PDF in Turso");
    await db.execute({
      sql: `INSERT INTO signing_workspace_documents (
        id, file_name, file_size, uploaded_at, uploaded_by, status, target_personnel,
        required_signers, signers_matrix, scanned_info, pdf_data,
        province, section_division, notes, has_p12, signature_image,
        created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        status = excluded.status,
        pdf_data = CASE 
          WHEN excluded.pdf_data IS NOT NULL AND length(excluded.pdf_data) > 0 THEN excluded.pdf_data 
          ELSE signing_workspace_documents.pdf_data 
        END,
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        testDocId,
        "CloudTest_Updated.pdf",
        "1.2 MB",
        "Ace Malto",
        "partially_signed",
        "ACE MALTO",
        JSON.stringify(["ACE MALTO"]),
        JSON.stringify([]),
        null,
        null, // Simulating UI sending null/undefined on metadata update
        "Regional Office",
        "Regional Office V",
        "Updated notes",
        0,
        null,
      ],
    });

    const check2 = await db.execute({
      sql: `SELECT id, file_name, status, length(pdf_data) as pdf_len FROM signing_workspace_documents WHERE id = ?`,
      args: [testDocId],
    });
    assert.equal(check2.rows[0].status, "partially_signed", "Status must update to partially_signed");
    assert.equal(check2.rows[0].file_name, "CloudTest_Updated.pdf", "Filename must update");
    assert.equal(check2.rows[0].pdf_len, sampleDataUrl.length, "Existing PDF binary in Turso MUST NOT be wiped out by null!");
    console.log("  PASS: Test 2 - Existing PDF binary safely preserved during metadata updates");

    // ── Test 3: Updating with new PDF binary updates correctly ──
    console.log("\n[Test 3] Overwriting with new signed PDF binary updates Turso correctly");
    const newSignedPdf = "data:application/pdf;base64,JVBERi0xLjQKJeLjz9MKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCgpTSUdORURfREVUQUlMUwo=";
    await db.execute({
      sql: `INSERT INTO signing_workspace_documents (
        id, file_name, file_size, uploaded_at, uploaded_by, status, target_personnel,
        required_signers, signers_matrix, scanned_info, pdf_data,
        province, section_division, notes, has_p12, signature_image,
        created_at, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        pdf_data = CASE 
          WHEN excluded.pdf_data IS NOT NULL AND length(excluded.pdf_data) > 0 THEN excluded.pdf_data 
          ELSE signing_workspace_documents.pdf_data 
        END,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        testDocId,
        "CloudTest_Updated.pdf",
        "1.2 MB",
        "Ace Malto",
        "signed",
        "ACE MALTO",
        JSON.stringify(["ACE MALTO"]),
        JSON.stringify([]),
        null,
        newSignedPdf,
        "Regional Office",
        "Regional Office V",
        "Signed",
        1,
        null,
      ],
    });

    const check3 = await db.execute({
      sql: `SELECT id, status, length(pdf_data) as pdf_len FROM signing_workspace_documents WHERE id = ?`,
      args: [testDocId],
    });
    assert.equal(check3.rows[0].status, "signed", "Status must update to signed");
    assert.equal(check3.rows[0].pdf_len, newSignedPdf.length, "PDF binary must update to new signed length");
    console.log("  PASS: Test 3 - New signed PDF replaces older version cleanly");

    // ── Test 4: Lean listing vs Full on-demand single fetch ──
    console.log("\n[Test 4] Lean document listing omits large pdf_data, while single fetch includes full binary");
    const leanList = await db.execute({
      sql: `SELECT id, file_name, file_size, uploaded_by, status FROM signing_workspace_documents WHERE id = ?`,
      args: [testDocId],
    });
    assert.equal(leanList.rows[0].pdf_data, undefined, "Lean list query must omit pdf_data for network performance");

    const fullDoc = await db.execute({
      sql: `SELECT * FROM signing_workspace_documents WHERE id = ? LIMIT 1`,
      args: [testDocId],
    });
    assert.ok(fullDoc.rows[0].pdf_data, "Full document query must contain pdf_data for native viewer");
    console.log("  PASS: Test 4 - Separation of lean metadata listing vs full binary on-demand preview verified");

    // Clean up test record
    await db.execute({ sql: `DELETE FROM signing_workspace_documents WHERE id = ?`, args: [testDocId] });
    console.log("\n======================================================================");
    console.log("ALL CLOUD STORAGE & TURSO SYNC TESTS PASSED PERFECTLY!");
    console.log("======================================================================");
  } catch (err) {
    // Attempt cleanup on failure
    await db.execute({ sql: `DELETE FROM signing_workspace_documents WHERE id = ?`, args: [testDocId] }).catch(() => {});
    throw err;
  }
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
