const td = new TextDecoder("latin1");
for (let b = 128; b <= 160; b++) {
  const char = td.decode(new Uint8Array([b]));
  const code = char.charCodeAt(0);
  const back = code & 0xff;
  if (back !== b) {
    console.log(`Byte ${b} (0x${b.toString(16)}) -> charCode ${code} (0x${code.toString(16)}) -> &0xff = ${back} (0x${back.toString(16)})! MISMATCH!`);
  }
}
