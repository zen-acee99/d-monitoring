import { createRequire } from 'module';
const req = typeof createRequire === 'function' ? createRequire(import.meta.url) : null;
if (req) {
  const zlib = req('zlib');
  console.log('Success with createRequire:', typeof zlib.inflateSync === 'function');
}
