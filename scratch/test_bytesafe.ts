function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)) as any);
  }
  return s;
}

function binaryStringToUint8Array(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

// Test all 256 bytes
const orig = new Uint8Array(256);
for (let i = 0; i < 256; i++) orig[i] = i;

const s = uint8ArrayToBinaryString(orig);
const back = binaryStringToUint8Array(s);

let ok = true;
for (let i = 0; i < 256; i++) {
  if (back[i] !== orig[i]) {
    console.error(`Mismatch at ${i}: expected ${orig[i]}, got ${back[i]}`);
    ok = false;
  }
}
console.log("All 256 bytes matched perfectly?", ok);
