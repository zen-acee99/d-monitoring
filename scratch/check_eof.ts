import fs from "fs";

const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
const str = new TextDecoder("latin1").decode(bytes);

const eofs = [...str.matchAll(/%%EOF/g)];
console.log(`Found ${eofs.length} %%EOF markers at offsets:`, eofs.map(m => m.index));

if (eofs.length > 1) {
  const firstEofEnd = eofs[0].index! + 5;
  console.log(`Original PDF bytes length before revision 1: ${firstEofEnd}`);
  const cleanOriginalBytes = bytes.subarray(0, firstEofEnd);
  fs.writeFileSync("scratch/clean_original_ace_dtr.pdf", cleanOriginalBytes);
  console.log("Saved scratch/clean_original_ace_dtr.pdf!");
} else {
  console.log("Only 1 %%EOF marker found.");
}
