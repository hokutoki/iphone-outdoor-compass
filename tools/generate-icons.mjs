import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const iconDir = join(root, "icons");
mkdirSync(iconDir, { recursive: true });

function rgba(hex) {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
    255,
  ];
}

function blend(a, b, t) {
  return a.map((channel, index) => {
    if (index === 3) return 255;
    return Math.round(channel + (b[index] - channel) * t);
  });
}

function setPixel(data, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (y * size + x) * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = color[3];
}

function fillCircle(data, size, cx, cy, radius, color) {
  for (let py = cy - radius; py <= cy + radius; py += 1) {
    for (let px = cx - radius; px <= cx + radius; px += 1) {
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) {
        setPixel(data, size, px, py, color);
      }
    }
  }
}

function fillLine(data, size, x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / Math.max(1, steps);
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    fillCircle(data, size, x, y, Math.max(1, Math.round(width / 2)), color);
  }
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function createIcon(size) {
  const data = Buffer.alloc(size * size * 4);
  const green = rgba("#1f7a61");
  const blue = rgba("#2e6f9e");
  const paper = rgba("#fbfefd");
  const line = rgba("#d5dfdb");
  const coral = rgba("#c85b44");
  const ink = rgba("#17221f");

  for (let y = 0; y < size; y += 1) {
    const color = blend(green, blue, y / Math.max(1, size - 1));
    for (let x = 0; x < size; x += 1) {
      setPixel(data, size, x, y, color);
    }
  }

  const s = size / 512;
  fillCircle(data, size, Math.round(256 * s), Math.round(256 * s), Math.round(154 * s), paper);
  fillCircle(data, size, Math.round(256 * s), Math.round(256 * s), Math.round(122 * s), line);
  fillCircle(data, size, Math.round(256 * s), Math.round(256 * s), Math.round(94 * s), paper);
  fillLine(data, size, Math.round(256 * s), Math.round(126 * s), Math.round(256 * s), Math.round(178 * s), Math.round(26 * s), green);
  fillLine(data, size, Math.round(256 * s), Math.round(334 * s), Math.round(256 * s), Math.round(386 * s), Math.round(26 * s), green);
  fillLine(data, size, Math.round(126 * s), Math.round(256 * s), Math.round(178 * s), Math.round(256 * s), Math.round(26 * s), green);
  fillLine(data, size, Math.round(334 * s), Math.round(256 * s), Math.round(386 * s), Math.round(256 * s), Math.round(26 * s), green);
  fillLine(data, size, Math.round(214 * s), Math.round(304 * s), Math.round(320 * s), Math.round(184 * s), Math.round(34 * s), coral);
  fillLine(data, size, Math.round(246 * s), Math.round(218 * s), Math.round(214 * s), Math.round(304 * s), Math.round(30 * s), coral);
  fillCircle(data, size, Math.round(256 * s), Math.round(256 * s), Math.round(18 * s), ink);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    data.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  writeFileSync(join(iconDir, `icon-${size}.png`), createIcon(size));
}
