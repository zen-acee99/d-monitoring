import fs from "fs";

const buf = fs.readFileSync("scratch/test_abstract.pdf");
const str = buf.toString("latin1");

const allObj18 = [...str.matchAll(/18\s+0\s+obj[\s\S]*?endobj/g)];
console.log(`Found ${allObj18.length} versions of 18 0 obj in abstract:`);
allObj18.forEach((m, i) => {
  console.log(`--- Version ${i} ---`);
  console.log(m[0]);
});
