import fs from 'fs';
import zlib from 'zlib';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const str = new TextDecoder("latin1").decode(bytes);

const streamPos = 30572;
let dataStart = streamPos + 6;
if (bytes[dataStart] === 13) dataStart++;
if (bytes[dataStart] === 10) dataStart++;

console.log("dataStart:", dataStart, "first 4 bytes:", bytes.slice(dataStart, dataStart + 4));

const slice = bytes.slice(dataStart, dataStart + 5339);
const inflated = zlib.inflateSync(slice);
console.log("Inflated length:", inflated.length);
console.log("First 300 chars:\n", inflated.toString('latin1').slice(0, 300));
