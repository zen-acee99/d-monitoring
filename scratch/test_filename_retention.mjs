import { createClient } from "@libsql/client/web";
import dotenv from "dotenv";
dotenv.config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function runTests() {
  console.log("=== STARTING FILENAME RETENTION TESTS ===");

  const testId1 = `test-upload-${Date.now()}-1`;
  const testId2 = `test-upload-${Date.now()}-2`;

  try {
    // Test 1: Upload a document with a regular name
    const doc1Name = "Travel_Order_Region_V_Official.pdf";
    console.log(`\n[Test 1] Upserting ${testId1} with regular filename: ${doc1Name}`);

    // Emulate server route post("/")
    await db.execute({
      sql: `INSERT INTO dtr_storage (
              id, employee_name, module, status, pdf_filename, remarks
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              pdf_filename = CASE 
                WHEN excluded.pdf_filename IS NOT NULL AND excluded.pdf_filename != '' THEN excluded.pdf_filename
                ELSE dtr_storage.pdf_filename
              END`,
      args: [
        testId1,
        "ANNABEL C. ODOÑO-CALIMPONG",
        "SIGNING_WORKSPACE",
        "pending",
        doc1Name,
        JSON.stringify({ originalFileName: doc1Name, targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" })
      ]
    });

    const check1 = await db.execute({
      sql: "SELECT id, pdf_filename FROM dtr_storage WHERE id = ?",
      args: [testId1]
    });
    console.log("Result after insert 1:", check1.rows[0]);
    if (check1.rows[0].pdf_filename !== doc1Name) {
      throw new Error(`Expected ${doc1Name}, got ${check1.rows[0].pdf_filename}`);
    }

    // Partial update on testId1 without pdfFileName (e.g. persistDocSignatoryUpdate)
    console.log(`\n[Test 1b] Partial update on ${testId1} without pdfFileName`);
    // When no pdfFileName is provided, server resolves existingDbFileName
    const existingDb = await db.execute({
      sql: "SELECT pdf_filename FROM dtr_storage WHERE id = ?",
      args: [testId1]
    });
    const finalResolved = existingDb.rows[0]?.pdf_filename || "FALLBACK.pdf";

    await db.execute({
      sql: `INSERT INTO dtr_storage (
              id, employee_name, module, status, pdf_filename, remarks
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              status = excluded.status,
              pdf_filename = CASE 
                WHEN excluded.pdf_filename IS NOT NULL AND excluded.pdf_filename != '' THEN excluded.pdf_filename
                ELSE dtr_storage.pdf_filename
              END`,
      args: [
        testId1,
        "ANNABEL C. ODOÑO-CALIMPONG",
        "SIGNING_WORKSPACE",
        "signed",
        finalResolved,
        JSON.stringify({ originalFileName: doc1Name, targetPersonnel: "ANNABEL C. ODOÑO-CALIMPONG" })
      ]
    });

    const check1b = await db.execute({
      sql: "SELECT id, status, pdf_filename FROM dtr_storage WHERE id = ?",
      args: [testId1]
    });
    console.log("Result after partial update 1b:", check1b.rows[0]);
    if (check1b.rows[0].pdf_filename !== doc1Name) {
      throw new Error(`Expected ${doc1Name}, got ${check1b.rows[0].pdf_filename}`);
    }

    // Test 2: Upload a document whose real name starts with DTR_
    const doc2Name = "DTR_November_Original_Ace_Malto.pdf";
    console.log(`\n[Test 2] Upserting ${testId2} with genuine DTR_ filename: ${doc2Name}`);

    await db.execute({
      sql: `INSERT INTO dtr_storage (
              id, employee_name, module, status, pdf_filename, remarks
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              pdf_filename = CASE 
                WHEN excluded.pdf_filename IS NOT NULL AND excluded.pdf_filename != '' THEN excluded.pdf_filename
                ELSE dtr_storage.pdf_filename
              END`,
      args: [
        testId2,
        "ACE M. MALTO",
        "SIGNING_WORKSPACE",
        "pending",
        doc2Name,
        JSON.stringify({ originalFileName: doc2Name, targetPersonnel: "ACE M. MALTO" })
      ]
    });

    const check2 = await db.execute({
      sql: "SELECT id, pdf_filename FROM dtr_storage WHERE id = ?",
      args: [testId2]
    });
    console.log("Result after insert 2:", check2.rows[0]);
    if (check2.rows[0].pdf_filename !== doc2Name) {
      throw new Error(`Expected ${doc2Name}, got ${check2.rows[0].pdf_filename}`);
    }

    // Test 3: Batch upsert with pre-fetched existing filenames
    console.log(`\n[Test 3] Testing batch upsert with pre-fetched map...`);
    const batchRecords = [
      { id: testId1, employeeName: "ANNABEL C. ODOÑO-CALIMPONG" }, // partial update, no pdfFileName
      { id: testId2, employeeName: "ACE M. MALTO", pdfFileName: doc2Name },
    ];
    const itemIds = batchRecords.map(b => b.id);
    const placeholders = itemIds.map(() => "?").join(",");
    const existingRows = await db.execute({
      sql: `SELECT id, pdf_filename FROM dtr_storage WHERE id IN (${placeholders})`,
      args: itemIds,
    });
    const existingMap = new Map();
    for (const r of existingRows.rows) {
      existingMap.set(String(r.id), String(r.pdf_filename));
    }

    for (const item of batchRecords) {
      const explicit = item.pdfFileName || null;
      const existing = existingMap.get(item.id) || null;
      const resolved = explicit || existing || "fallback.pdf";

      await db.execute({
        sql: `INSERT INTO dtr_storage (
                id, employee_name, module, status, pdf_filename
              ) VALUES (?, ?, 'SIGNING_WORKSPACE', 'signed', ?)
              ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                pdf_filename = CASE 
                  WHEN excluded.pdf_filename IS NOT NULL AND excluded.pdf_filename != '' THEN excluded.pdf_filename
                  ELSE dtr_storage.pdf_filename
                END`,
        args: [item.id, item.employeeName, resolved]
      });
    }

    const checkBatch = await db.execute({
      sql: `SELECT id, pdf_filename, status FROM dtr_storage WHERE id IN (${placeholders})`,
      args: itemIds,
    });
    console.log("Result after batch update:", checkBatch.rows);

    const r1 = checkBatch.rows.find(r => r.id === testId1);
    const r2 = checkBatch.rows.find(r => r.id === testId2);

    if (r1.pdf_filename !== doc1Name) {
      throw new Error(`Batch failed: record 1 lost name, got ${r1.pdf_filename}`);
    }
    if (r2.pdf_filename !== doc2Name) {
      throw new Error(`Batch failed: record 2 lost name, got ${r2.pdf_filename}`);
    }

    console.log("\nALL TESTS PASSED WITH 100% SUCCESS!");

    // Clean up test records
    await db.execute({
      sql: `DELETE FROM dtr_storage WHERE id IN (${placeholders})`,
      args: itemIds,
    });
    console.log("Cleaned up test records from Turso database.");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTests();
