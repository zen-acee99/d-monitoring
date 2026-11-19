try {
  const req = eval('require');
  const zlib = req('zlib');
  console.log('eval require zlib works:', typeof zlib.inflateSync === 'function');
} catch (e) {
  console.log('eval require failed:', e);
}
