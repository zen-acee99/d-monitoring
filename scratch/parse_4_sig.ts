import fs from "fs";

function parsePdf() {
  const buf = fs.readFileSync("test_4_signatures.pdf");
  const text = buf.toString("binary");

  const sigs = text.match(/\/Type\s*\/Sig/g);
  console.log("Total /Type /Sig found:", sigs ? sigs.length : 0);

  const names = text.match(/\/Name\s*\(([^)]+)\)/g);
  console.log("Signer names in signature dicts:\n", names);

  const reasons = text.match(/\/Reason\s*\(([^)]+)\)/g);
  console.log("Reasons:\n", reasons);

  const byteRanges = text.match(/\/ByteRange\s*\[[^\]]+\]/g);
  console.log("ByteRanges:\n", byteRanges);

  const fieldNames = text.match(/\/T\s*\(([^)]+)\)/g);
  console.log("Field names (/T):\n", fieldNames);
}

parsePdf();
