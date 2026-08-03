import { readFileSync } from 'fs';
const buf = readFileSync('public/models/player-ship.glb');
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const totalLen = dv.getUint32(8, true);
let off = 12; let json=null;
while (off < totalLen) {
  const len = dv.getUint32(off, true);
  const type = buf.toString('utf8', off+4, off+8).trim();
  const data = buf.subarray(off+8, off+8+len);
  if (type==='JSON') json=JSON.parse(data.toString('utf8'));
  off += 8+len;
}
console.log('materials:', JSON.stringify(json.materials, null, 1));
console.log('textures:', JSON.stringify(json.textures));
console.log('samplers:', JSON.stringify(json.samplers));
