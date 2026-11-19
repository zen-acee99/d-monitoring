import fs from "fs";

const buf = fs.readFileSync("scratch/test_abstract.pdf");
const str = buf.toString("latin1");

const matches = str.match(/Annabel[^\)\r\n\/]*/gi);
console.log("Matches for Annabel in test_abstract.pdf:", matches);

const bts = str.match(/BT[\s\S]*?ET/g);
if (bts) {
  bts.filter(b => b.includes("Annabel") || b.includes("Digitally")).forEach((b, i) => {
    console.log(`--- Block ${i} ---`);
    console.log(b);
  });
}
