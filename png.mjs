/* Module 2 -- minimal PNG codec on node:zlib (no dependency).
 * decodePNG: 8-bit, non-interlaced, colour types 0/2/4/6 -> Framebuffer (RGB).
 * encodePNG: Framebuffer -> 8-bit RGB PNG (filter 0).
 * Anything else THROWS -- an unsupported file must never be read as "all zero"
 * (which would report a false match in compare.mjs). */
import { inflateSync, deflateSync } from "node:zlib";
import { Framebuffer } from "./raster.mjs";

// own CRC-32 so we do not depend on a recent Node (zlib.crc32 is Node >= 22.2)
const CRC_T = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decodePNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG file");
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error(`PNG bit depth ${depth} unsupported (need 8)`);
  if (interlace) throw new Error("interlaced PNG unsupported");
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!ch) throw new Error(`PNG colour type ${ctype} unsupported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i];
      const a = i >= ch ? out[dst + i - ch] : 0;
      const b = y > 0 ? out[dst - stride + i] : 0;
      const c = i >= ch && y > 0 ? out[dst - stride + i - ch] : 0;
      let v;
      switch (f) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); break;
        }
        default: throw new Error(`bad PNG filter ${f}`);
      }
      out[dst + i] = v & 255;
    }
  }
  const fb = new Framebuffer(w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch;
    if (ch >= 3) { fb.data[i * 3] = out[o]; fb.data[i * 3 + 1] = out[o + 1]; fb.data[i * 3 + 2] = out[o + 2]; }
    else { fb.data[i * 3] = fb.data[i * 3 + 1] = fb.data[i * 3 + 2] = out[o]; }
  }
  return fb;
}

const chunk = (type, data) => {
  const t = Buffer.from(type, "ascii"), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])) >>> 0);
  return Buffer.concat([len, t, data, crc]);
};

export function encodePNG(fb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(fb.w, 0); ihdr.writeUInt32BE(fb.h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const stride = fb.w * 3, raw = Buffer.alloc(fb.h * (stride + 1));
  for (let y = 0; y < fb.h; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(fb.data.buffer, fb.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
