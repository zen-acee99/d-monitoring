import fs from "fs";
import { execSync } from "child_process";

try {
  // Check if python with pymupdf / fitz is available
  execSync("python -c \"import fitz; doc = fitz.open('scratch/ace_dtr_perfect_signed.pdf'); page = doc[0]; pix = page.get_pixmap(dpi=150); pix.save('scratch/ace_dtr_perfect_signed.png'); print('Saved scratch/ace_dtr_perfect_signed.png!')\"");
  console.log("Success with PyMuPDF!");
} catch (e) {
  console.log("PyMuPDF failed:", e.message);
}
