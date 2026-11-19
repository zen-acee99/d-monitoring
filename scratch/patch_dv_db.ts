import { db } from "../server/db.js";
import fs from "fs";

async function rePatchDv() {
  const buf = fs.readFileSync("scratch/test_dv_real.pdf");
  let str = buf.toString("latin1");

  // In test_dv_real.pdf, Annabel's widget has Rect [360 188 585 220] (or [360 ...])
  // Let's find widget 74 / Signature_3
  const rectMatches = [...str.matchAll(/\/Rect\s*\[([0-9\.\s]+)\]/g)];
  console.log("Rect matches in DV:", rectMatches.map(m => m[1]));

  // Let's replace [360 188 585 220] with [421 188 558 220]
  // We pad with spaces to keep exact byte length
  const oldRect = "/Rect [360 188 585 220]";
  const newRect = "/Rect [421 188 558 220]";
  if (str.includes(oldRect)) {
    console.log("Found oldRect, replacing...");
    str = str.replace(oldRect, newRect);
    
    // Also in XObject /BBox [0 0 225 32] -> width is 558 - 421 = 137
    // Let's check Form XObject for this signature
    const oldBBox = "/BBox [0 0 225 32]";
    const newBBox = "/BBox [0 0 137 32]";
    if (str.includes(oldBBox)) {
      str = str.replace(oldBBox, newBBox);
    }

    const updatedBuf = Buffer.from(str, "latin1");
    fs.writeFileSync("scratch/test_dv_corrected.pdf", updatedBuf);
    console.log("Saved scratch/test_dv_corrected.pdf");

    // Update in database
    const b64 = `data:application/pdf;base64,${updatedBuf.toString("base64")}`;
    await db.execute({
      sql: "UPDATE dtr_storage SET pdf_data = ? WHERE id = ?",
      args: [b64, "doc-upload-1794223582282-8-j69c"],
    });
    console.log("Updated doc-upload-1794223582282-8-j69c in database!");
  } else {
    console.log("oldRect not found, checking alternatives...");
  }
}

rePatchDv().catch(console.error);
