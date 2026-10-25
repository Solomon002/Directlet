// Draws DirectLet's PLACEHOLDER app icons: a Trust Blue square with a white roof
// and a green arrow rising into it (the idea in the brand manual, not the real
// logo). When the designers send the logo, replace the files in apps/web/public
// with the same names and sizes, then delete this script.
//
//   node scripts/make-icons.mjs
//
// Writes icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png and
// apple-touch-icon.png. No packages needed: PNGs are encoded with Node's zlib.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "public");
mkdirSync(out, { recursive: true });

const BLUE = [0x17, 0x4a, 0x9d];
const WHITE = [0xff, 0xff, 0xff];
const GREEN = [0x1d, 0xb9, 0x54];

// Drawn on a 512 x 512 grid, centred on (256, 256) after the lift below.
const LIFT = -16;
const shapes = [
  { color: WHITE, width: 52, points: [[112, 270], [256, 138], [400, 270]] }, // roof
  { color: GREEN, width: 44, points: [[256, 410], [256, 262]] }, // arrow shaft
  { color: GREEN, width: 44, points: [[206, 308], [256, 258], [306, 308]] }, // arrow head
].map((s) => ({ ...s, points: s.points.map(([x, y]) => [x, y + LIFT]) }));

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function colorAt(x, y) {
  let color = BLUE;
  for (const shape of shapes) {
    for (let i = 0; i < shape.points.length - 1; i++) {
      if (distanceToSegment(x, y, shape.points[i], shape.points[i + 1]) <= shape.width / 2) {
        color = shape.color;
        break;
      }
    }
  }
  return color;
}

// zoom > 1 makes the artwork larger; maskable icons keep it at 1 so the shape
// stays inside the safe circle that Android crops to.
function render(size, zoom) {
  const SAMPLES = 4;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let py = 0; py < size; py++) {
    raw[o++] = 0; // PNG filter: none
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const gx = ((px + (sx + 0.5) / SAMPLES) / size) * 512;
          const gy = ((py + (sy + 0.5) / SAMPLES) / size) * 512;
          const [cr, cg, cb] = colorAt(256 + (gx - 256) / zoom, 256 + (gy - 256) / zoom);
          r += cr;
          g += cg;
          b += cb;
        }
      }
      const n = SAMPLES * SAMPLES;
      raw[o++] = Math.round(r / n);
      raw[o++] = Math.round(g / n);
      raw[o++] = Math.round(b / n);
    }
  }
  return raw;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function png(size, zoom) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size, zoom), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const files = [
  ["icon-192.png", 192, 1.15],
  ["icon-512.png", 512, 1.15],
  ["icon-maskable-512.png", 512, 1],
  ["apple-touch-icon.png", 180, 1.1],
];
for (const [name, size, zoom] of files) {
  const data = png(size, zoom);
  writeFileSync(join(out, name), data);
  console.log(`${name.padEnd(24)} ${size}x${size}  ${data.length} bytes`);
}

// The same drawing as a vector, for the browser tab.
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const paths = shapes
  .map(
    (s) =>
      `  <path d="M${s.points.map(([x, y]) => `${x} ${y}`).join(" L")}" fill="none" stroke="${hex(s.color)}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
  )
  .join("\n");
writeFileSync(
  join(out, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <rect width="512" height="512" rx="112" fill="${hex(BLUE)}"/>\n${paths}\n</svg>\n`,
);
console.log("icon.svg");
