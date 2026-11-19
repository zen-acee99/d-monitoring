import fs from "fs";

const buf = fs.readFileSync("scratch/test_pov.pdf");
const str = buf.toString("latin1");
console.log("File size:", buf.length);

const matches = str.match(/Annabel[^\)\r\n\/]*/gi);
console.log("Matches for Annabel:", matches);

// Check XObject form streams or widget annotations
const xobjects = str.match(/<<[^>]*\/Subtype\s*\/Form[\s\S]*?endstream/g);
console.log("Form XObjects found:", xobjects ? xobjects.length : 0);
if (xobjects) {
  xobjects.forEach((xo, i) => {
    console.log(`=== Form XObject ${i} ===`);
    console.log(xo);
  });
}

// Check widget rects
const widgets = str.match(/<<[^>]*\/Subtype\s*\/Widget[\s\S]*?>>/g);
console.log("Widgets found:", widgets ? widgets.length : 0);
if (widgets) {
  widgets.forEach((w, i) => {
    console.log(`=== Widget ${i} ===`);
    console.log(w);
  });
}

const obj71 = str.match(/71 0 obj[\s\S]*?endobj/);
console.log("=== Object 71 ===");
console.log(obj71 ? obj71[0] : "Not found");
