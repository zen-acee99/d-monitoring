import fs from 'fs';

const bytes = fs.readFileSync('./scratch/test_pov.pdf');
const str = new TextDecoder("latin1").decode(bytes);

let count = 0;
let pos = 0;
while ((pos = str.indexOf("stream", pos)) !== -1) {
  const newline = str[pos + 6] === '\r' ? (str[pos + 7] === '\n' ? 8 : 7) : (str[pos + 6] === '\n' ? 7 : 6);
  const b0 = bytes[pos + newline];
  const b1 = bytes[pos + newline + 1];
  console.log(`Stream #${count} at ${pos}: next bytes [${b0}, ${b1}] (${String.fromCharCode(b0)}${String.fromCharCode(b1)})`);
  count++;
  pos += 6;
}
