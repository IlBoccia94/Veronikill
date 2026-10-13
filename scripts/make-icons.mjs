// Generate real PNG PWA icons without native binaries or third-party build tools.
// Uses only Node.js (zlib). Source geometry is intentionally simple and maskable-safe.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const DIR = new URL('../public/', import.meta.url);
const colors = {
  background: [38, 24, 46, 255],
  golden: [243, 173, 70, 255],
  jacket: [162, 72, 185, 255],
  face: [249, 203, 158, 255],
  hair: [67, 38, 65, 255],
  ink: [38, 24, 46, 255],
  lime: [216, 244, 94, 255]
};
const oval = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const poly = (x, y, coords) => {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const a = coords[i], b = coords[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};
const segments = (x,y,x1,y1,x2,y2,width) => {
  const vx=x2-x1, vy=y2-y1;
  const t=Math.max(0,Math.min(1,((x-x1)*vx+(y-y1)*vy)/(vx*vx+vy*vy)));
  return Math.hypot(x-(x1+vx*t),y-(y1+vy*t)) <= width/2;
};
const coat = [[108,350],[105,195],[165,138],[314,130],[397,198],[407,349],[345,405],[175,405]];
const bangs = [[154,255],[143,163],[211,108],[298,104],[356,146],[358,253],[305,191],[280,151],[241,216],[209,169]];
const barrel = [[380,274],[446,260],[453,310],[389,329]];
function rgba(x, y) {
  let c = colors.background;
  if (oval(x, y, 256, 256, 196, 196)) c=colors.golden;
  if (poly(x, y, coat)) c=colors.jacket;
  if (oval(x,y,253,235,99,101)) c=colors.face;
  if (poly(x,y,bangs)) c=colors.hair;
  if (oval(x,y,220,236,11,11) || oval(x,y,295,236,11,11)) c=colors.ink;
  if (x > 225 && x < 293 && y > 278 && y < 307 && Math.abs(y-(298-11*Math.cos((x-225)/68*Math.PI)))<4) c=colors.ink;
  if (segments(x,y,326,325,418,300,28)) c=colors.ink;
  if (poly(x,y,barrel)) c=colors.lime;
  return c;
}
function crc32(buffer) {
  let crc=0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for(let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tag, bytes) {
  const kind=Buffer.from(tag,'ascii');
  const len=Buffer.alloc(4);len.writeUInt32BE(bytes.length);
  const hash=Buffer.alloc(4);hash.writeUInt32BE(crc32(Buffer.concat([kind,bytes])));
  return Buffer.concat([len,kind,bytes,hash]);
}
function png(size) {
  const pixels=Buffer.alloc(size*(size*4+1),0);
  for(let y=0;y<size;y++) {
    let offset=y*(size*4+1)+1;
    for(let x=0;x<size;x++) {
      const c=rgba((x+0.5)*512/size,(y+0.5)*512/size);
      for(let j=0;j<4;j++) pixels[offset++]=c[j];
    }
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size,0);
  header.writeUInt32BE(size,4);
  header[8]=8; header[9]=6; // RGBA 8-bit
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),
    chunk('IDAT',deflateSync(pixels,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
}
mkdirSync(DIR,{recursive:true});
for(const size of [192,512]) {
  const target = new URL('icon-'+size+'.png',DIR);
  // Never overwrite custom graphics committed to the repo.
  if (!existsSync(target)) writeFileSync(target,png(size));
}
console.log('Generated PWA icons 192px and 512px.');
