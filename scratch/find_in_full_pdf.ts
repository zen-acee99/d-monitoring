import fs from "fs";

const bytes = fs.readFileSync("scratch/uploaded_ace_dtr.pdf");
const text = new TextDecoder("latin1").decode(bytes);

const idx = text.indexOf("by Ace malto");
console.log("Index in full PDF:", idx);
if (idx !== -1) {
  console.log("Context around index in full PDF:");
  console.log(text.substring(Math.max(0, idx - 200), Math.min(text.length, idx + 200)));
}
