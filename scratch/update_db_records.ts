import { db } from "../server/db.js";
import fs from "fs";

async function updateDb() {
  const povBytes = fs.readFileSync("scratch/test_pov_fixed.pdf");
  const povBase64 = `data:application/pdf;base64,${povBytes.toString("base64")}`;

  const absBytes = fs.readFileSync("scratch/test_abstract_fixed.pdf");
  const absBase64 = `data:application/pdf;base64,${absBytes.toString("base64")}`;

  console.log("Updating doc-upload-1794144126251-1-nvny (POV)...");
  await db.execute({
    sql: "UPDATE dtr_storage SET pdf_data = ? WHERE id = ?",
    args: [povBase64, "doc-upload-1794144126251-1-nvny"],
  });

  console.log("Updating doc-upload-1794144126251-0-dqsa (Abstract)...");
  await db.execute({
    sql: "UPDATE dtr_storage SET pdf_data = ? WHERE id = ?",
    args: [absBase64, "doc-upload-1794144126251-0-dqsa"],
  });

  console.log("Database successfully updated with fixed PDF bytes!");
}

updateDb().catch(console.error);
