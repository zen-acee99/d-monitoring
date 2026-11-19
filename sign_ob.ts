import fs from "fs";
import { signPdfBuffer } from "./server/services/pnpkiSigningService";

async function sign() {
  const pdfBuffer = fs.readFileSync("C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\dict-monitoring\\scratch\\signed_ob_slip_final.pdf");
  const p12Buffer = fs.readFileSync("C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\dict-monitoring\\scratch\\rene_jane.p12");
  const p12Base64 = p12Buffer.toString("base64");
  
  // Try empty password, or maybe I should ask the user
  const password = "1234567890Aa!"; 
  
  try {
      const signed = await signPdfBuffer(pdfBuffer, p12Base64, password, {
        reason: "Date of Arrival Signature",
        sigRect: [195, 120, 295, 140], 
        signerName: "Rene Jane R. Bueno",
      });
      fs.writeFileSync("C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\dict-monitoring\\scratch\\signed_ob_slip_arrival.pdf", signed.signedBuffer);
      console.log("Successfully signed!");
  } catch (err) {
      console.error("Signing failed:", err);
  }
}

sign().catch(console.error);
