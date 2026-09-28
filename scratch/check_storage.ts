import { db } from "../server/db";

async function checkStorage() {
  const p = await db.execute("SELECT * FROM dtr_storage LIMIT 10");
  console.log("dtr_storage count:", p.rows.length);
  p.rows.forEach(r => {
    console.log({
      id: r.id,
      userId: r.userId,
      employeeName: r.employeeName,
      status: r.status,
      hasP12: r.hasP12,
      employeeHasP12: r.employeeHasP12,
      supervisorHasP12: r.supervisorHasP12,
      employeeSignerName: r.employeeSignerName,
      signerName: r.signerName,
      supervisorName: r.supervisorName,
      pdfFileName: r.pdfFileName,
    });
  });
}

checkStorage().catch(console.error);
