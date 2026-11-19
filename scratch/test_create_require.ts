import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const zlib = req('zlib');
console.log('zlib inflateSync exists:', typeof zlib.inflateSync === 'function');
