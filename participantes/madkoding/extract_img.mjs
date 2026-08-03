import { readFileSync, writeFileSync } from 'fs';
const buf = readFileSync('public/models/player-ship.glb');
// BIN chunk starts at file offset 1560 (12 + 8 + 1532 JSON)
const binStart = 1560;
const imgOffset = binStart + 16155624; // bufferView byteOffset within BIN
const imgLen = 19428798;
writeFileSync('/tmp/ship_tex.png', buf.subarray(imgOffset, imgOffset+imgLen));
console.log('wrote /tmp/ship_tex.png', imgLen, 'bytes');
