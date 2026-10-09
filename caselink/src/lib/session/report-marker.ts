/** SHA-256 of an opaque report ID. Deletion markers never contain the imported ID or case text. */
export function reportMarker(id: string): string {
  const primes: number[] = [];
  for (let n = 2; primes.length < 64; n++) if (!primes.some(p => p * p <= n && n % p === 0)) primes.push(n);
  const initial = primes.slice(0, 8).map(p => (Math.sqrt(p) % 1 * 0x100000000) | 0);
  const constants = primes.map(p => (Math.cbrt(p) % 1 * 0x100000000) | 0);
  const bytes = new TextEncoder().encode(id); const length = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(length); padded.set(bytes); padded[bytes.length] = 0x80;
  const data = new DataView(padded.buffer); const bitLength = bytes.length * 8;
  data.setUint32(length - 8, Math.floor(bitLength / 0x100000000)); data.setUint32(length - 4, bitLength >>> 0);
  const rotate = (x: number, n: number) => x >>> n | x << (32 - n); const words = new Int32Array(64);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = data.getInt32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = words[i - 15], y = words[i - 2];
      words[i] = (words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ x >>> 3) + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ y >>> 10)) | 0;
    }
    let [a,b,c,d,e,f,g,h] = initial;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[i] + words[i]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,h].forEach((word, i) => { initial[i] = (initial[i] + word) | 0; });
  }
  return initial.map(word => (word >>> 0).toString(16).padStart(8,'0')).join('');
}
