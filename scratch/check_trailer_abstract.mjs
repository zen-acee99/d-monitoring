import fs from "fs";

const buf = fs.readFileSync("scratch/test_abstract.pdf");
const str = buf.toString("latin1");

const trailers = [...str.matchAll(/trailer[\s\S]*?startxref/g)];
console.log(`Found ${trailers.length} trailers in abstract:`);
trailers.forEach((t, i) => console.log(`--- Trailer ${i} ---\n${t[0]}`));

// Find all root refs
const roots = [...str.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
console.log("Root refs:", roots.map(r => r[1]));

const rootObj = roots.length > 0 ? roots[roots.length - 1][1] : "1";
const allRoots = [...str.matchAll(new RegExp(`${rootObj}\\s+0\\s+obj[\\s\\S]*?endobj`, "g"))];
console.log(`Found ${allRoots.length} versions of Root (${rootObj} 0 obj):`);
allRoots.forEach((m, i) => {
  console.log(`--- Version ${i} ---`);
  console.log(m[0]);
});
