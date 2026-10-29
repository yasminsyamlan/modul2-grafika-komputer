/* Module 2 -- from-scratch 2D rasteriser. Plain JavaScript, no framework,
 * no <canvas>: the framebuffer is a typed array. The SAME functions drive a
 * browser <canvas> via ctx.putImageData(new ImageData(fb.rgba(), w, h)).
 *
 * CONVENTION (stated once, never mixed):
 *   - y is DOWN (screen / image row order).
 *   - a pixel (x,y) is a POINT SAMPLE at (x+0.5, y+0.5).
 *   - triangle vertices are passed so the total edge(A,B,C) > 0.
 *   - "inside" = all three edge functions >= 0; the top-left rule decides
 *     the exactly-on-edge (== 0) case.
 *
 * Reproduces:
 *   Example E2 / E3 : lineDDA and lineBresenham on (2,1)->(9,5) give
 *     [(2,1),(3,2),(4,2),(5,3),(6,3),(7,4),(8,4),(9,5)]
 *   Example E4      : edgeFn signs for A(1,1) B(6,2) C(3,7)
 *   Example E5      : barycentric interpolation 10/20/40 at (.5,.25,.25) -> 20
 */
import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------- Framebuffer
export class Framebuffer {
  constructor(w, h, bg = [0, 0, 0]) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 3);
    if (bg[0] || bg[1] || bg[2]) this.clear(bg);
  }
  clear(rgb) {
    for (let i = 0; i < this.data.length; i += 3) {
      this.data[i] = rgb[0]; this.data[i + 1] = rgb[1]; this.data[i + 2] = rgb[2];
    }
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, rgb) {
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 3;
    this.data[i] = rgb[0]; this.data[i + 1] = rgb[1]; this.data[i + 2] = rgb[2];
  }
  get(x, y) {
    const i = (y * this.w + x) * 3;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  // P6 binary PPM: text header then raw RGB bytes (same family as Module 1)
  writePPM(path) {
    const header = Buffer.from(`P6\n${this.w} ${this.h}\n255\n`, "ascii");
    writeFileSync(path, Buffer.concat([header, Buffer.from(this.data.buffer, 0, this.data.length)]));
    return header.length + this.data.length;
  }
  static readPPM(path) {
    const buf = readFileSync(path);
    let p = 0;
    const tok = () => {
      while (p < buf.length && /\s/.test(String.fromCharCode(buf[p]))) p++;
      let s = "";
      while (p < buf.length && !/\s/.test(String.fromCharCode(buf[p]))) s += String.fromCharCode(buf[p++]);
      return s;
    };
    const magic = tok();
    if (magic !== "P6") throw new Error(`${path}: not a P6 PPM (got ${magic})`);
    const w = +tok(), h = +tok(), maxv = +tok();
    if (maxv !== 255) throw new Error(`${path}: maxval ${maxv} != 255`);
    p++; // single whitespace after maxval
    const fb = new Framebuffer(w, h);
    fb.data.set(buf.subarray(p, p + w * h * 3));
    return fb;
  }
}

// --------------------------------------------------------------------- lines
/** DDA line. Returns the list of pixels; also plots into fb if given. */
export function lineDDA(x0, y0, x1, y1, fb = null, rgb = [255, 255, 255]) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const pts = [];
  if (steps === 0) { pts.push([x0, y0]); if (fb) fb.set(x0, y0, rgb); return pts; }
  const xi = dx / steps, yi = dy / steps;
  let x = x0, y = y0;
  for (let k = 0; k <= steps; k++) {
    const px = Math.round(x), py = Math.round(y);
    pts.push([px, py]);
    if (fb) fb.set(px, py, rgb);
    x += xi; y += yi;
  }
  return pts;
}

/** Integer Bresenham, all 8 octants (Zingl form: add / compare only). */
export function lineBresenham(x0, y0, x1, y1, fb = null, rgb = [255, 255, 255]) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const pts = [];
  for (;;) {
    pts.push([x0, y0]);
    if (fb) fb.set(x0, y0, rgb);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

export function polyline(fb, pts, rgb, close = false) {
  for (let i = 0; i + 1 < pts.length; i++)
    lineBresenham(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], fb, rgb);
  if (close && pts.length > 2) {
    const a = pts[pts.length - 1], b = pts[0];
    lineBresenham(a[0], a[1], b[0], b[1], fb, rgb);
  }
}

// ----------------------------------------------------------------- triangles
export const edge = (ax, ay, bx, by, px, py) =>
  (bx - ax) * (py - ay) - (by - ay) * (px - ax);

/** Twice the signed area of A,B,C (= edge(A,B,C)). > 0 means "wound correctly". */
export const totalArea2 = (A, B, C) => edge(A[0], A[1], B[0], B[1], C[0], C[1]);

/**
 * Who owns a pixel centre lying EXACTLY on directed edge X->Y (E == 0)?
 * Convention here: y DOWN, total > 0 (on screen: clockwise), interior is on
 * the E > 0 side of every edge.
 *
 *  rule "module" (DEFAULT) -- the listing in the module text and the one the
 *      committed ref/square_fill_ref.ppm was made with:
 *        owned iff (dy === 0 && dx < 0) || dy > 0.
 *  rule "d3d" -- the Direct3D / OpenGL definition (TOP edge = horizontal with
 *      interior below it; LEFT edge = non-horizontal with interior to its
 *      right). With y down and total > 0 that is:
 *        owned iff (dy === 0 && dx > 0) || dy < 0.
 *
 * FINDING (LAPORAN A3): with this module's own convention the listing's
 * "top"/"left" edges are geometrically the BOTTOM/RIGHT edges -- the two
 * rules are mirror images. Both are watertight (a shared edge is traversed in
 * opposite directions by its two triangles, so exactly one of them owns it);
 * they only differ in WHICH triangle gets the on-edge pixels. "module" keeps
 * the committed reference byte-identical; "d3d" matches real GPUs.
 *
 * FINDING 2: the listing implements ownership as an integer bias (0 / -1)
 * added to E before ">= 0". Pixel centres sit at x+0.5, so E is a
 * HALF-integer whenever (dx - dy) is odd; E = 0.5 plus bias -1 = -0.5 then
 * wrongly drops a pixel that is strictly inside. The exact test used by
 * triangle() is the tie-break: E > 0 always passes, E == 0 passes iff owned.
 */
export function ownsEdge(xx, xy, yx, yy, rule = "module") {
  const dx = yx - xx, dy = yy - xy;
  return rule === "d3d" ? (dy === 0 && dx > 0) || dy < 0
                        : (dy === 0 && dx < 0) || dy > 0;
}
export const isTopLeft = ownsEdge;   // legacy name used in the module text

/**
 * Fill triangle A,B,C (each [x,y]) with rgb.
 * opts.topLeft (default true): apply the on-edge ownership rule on E == 0.
 * opts.rule ("module" | "d3d", default "module"): which edges own E == 0 pixels
 *   (see ownsEdge).
 * opts.strictGreater (default false): use ">" instead of ">=" (the crack bug).
 * opts.autoFlip (default true): if the winding is reversed (total < 0) swap
 *   B and C so the triangle is still filled; degenerate (total == 0) draws nothing.
 * opts.fullScan (default false): scan the whole framebuffer instead of the
 *   clamped bounding box (only to MEASURE the "loose bounding box" pitfall).
 * opts.onFragment(x,y,wA,wB,wC): called per covered pixel; w* are the raw
 *   edge values (= lambda * total), not biased.
 */
export function triangle(fb, A, B, C, rgb = [255, 255, 255], opts = {}) {
  const { topLeft = true, strictGreater = false, autoFlip = true, rule = "module",
          fullScan = false, onFragment = null } = opts;
  const total = totalArea2(A, B, C);
  if (total === 0) return 0;
  if (total < 0) {
    if (!autoFlip) return 0;           // reversed winding -> nothing (the pitfall)
    [B, C] = [C, B];
  }
  const canDraw = !!(fb && typeof fb.set === "function");
  const W = fb ? fb.w : Infinity, H = fb ? fb.h : Infinity;
  const minX = fullScan ? 0 : Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
  const maxX = fullScan ? W - 1 : Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
  const minY = fullScan ? 0 : Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
  const maxY = fullScan ? H - 1 : Math.min(H - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
  // tie-break owner flags for E == 0, per edge (opposite A, B, C respectively)
  const oBC = topLeft && ownsEdge(B[0], B[1], C[0], C[1], rule);
  const oCA = topLeft && ownsEdge(C[0], C[1], A[0], A[1], rule);
  const oAB = topLeft && ownsEdge(A[0], A[1], B[0], B[1], rule);
  const pass = strictGreater
    ? (v) => v > 0
    : (v, own) => v > 0 || (v === 0 && (topLeft ? own : true));
  let n = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;                 // SAMPLE CENTRE
      const wA = edge(B[0], B[1], C[0], C[1], px, py);  // = lambda_A * total
      const wB = edge(C[0], C[1], A[0], A[1], px, py);  // = lambda_B * total
      const wC = edge(A[0], A[1], B[0], B[1], px, py);  // = lambda_C * total
      if (pass(wA, oBC) && pass(wB, oCA) && pass(wC, oAB)) {
        if (canDraw) fb.set(x, y, rgb);
        if (onFragment) onFragment(x, y, wA, wB, wC);
        n++;
      }
    }
  }
  return n;
}

/** Barycentric coords of P in triangle A,B,C (unbiased). Sum to 1. */
export function barycentric(A, B, C, P) {
  const total = edge(A[0], A[1], B[0], B[1], C[0], C[1]);
  const wA = edge(B[0], B[1], C[0], C[1], P[0], P[1]) / total;
  const wB = edge(C[0], C[1], A[0], A[1], P[0], P[1]) / total;
  const wC = edge(A[0], A[1], B[0], B[1], P[0], P[1]) / total;
  return [wA, wB, wC];
}

/**
 * Coverage map for a set of triangles: how many times each pixel is filled.
 * Returns { once, twice, gaps, counts }.
 *
 * `gaps` = pixels filled 0 times that SHOULD have been filled, i.e. whose
 * centre is (a) on/inside >= 2 of the closed triangles (a shared edge or
 * vertex that nobody claimed = a crack) or (b) strictly inside one triangle.
 * A pixel centred exactly on an OUTER edge, claimed by no neighbour, is NOT a
 * gap -- that is the top-left rule working (the pixel belongs to whatever is
 * drawn on the other side).
 */
export function coverage(w, h, tris, opts = {}) {
  const counts = new Int32Array(w * h);
  for (const [A, B, C] of tris)
    triangle({ w, h }, A, B, C, null, {
      ...opts,
      onFragment: (x, y) => { counts[y * w + x]++; },
    });
  const closedN = new Uint8Array(w * h);   // # triangles whose closed set contains the centre
  const strictN = new Uint8Array(w * h);   // # triangles whose open interior contains it
  for (const [A, B, C] of tris) {
    const tot = totalArea2(A, B, C);
    if (tot === 0) continue;
    const [b, c] = tot > 0 ? [B, C] : [C, B];
    const minX = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const minY = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const e1 = edge(b[0], b[1], c[0], c[1], px, py);
        const e2 = edge(c[0], c[1], A[0], A[1], px, py);
        const e3 = edge(A[0], A[1], b[0], b[1], px, py);
        if (e1 >= 0 && e2 >= 0 && e3 >= 0) {
          closedN[y * w + x]++;
          if (e1 > 0 && e2 > 0 && e3 > 0) strictN[y * w + x]++;
        }
      }
  }
  let once = 0, twice = 0, gaps = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] === 1) once++;
    else if (counts[i] >= 2) twice++;
    else if (closedN[i] >= 2 || strictN[i] >= 1) gaps++;
  }
  return { once, twice, gaps, counts };
}

// ------------------------------------------------- anti-aliased line (Wu)
const toLin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (l) => 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);

/** Blend `rgb` over the pixel at (x,y) with coverage a in [0,1].
 *  linear=true: blend in linear light (Module 1); false: naive sRGB-byte blend. */
export function blendPixel(fb, x, y, rgb, a, linear = true) {
  if (!fb.inside(x, y) || a <= 0) return;
  const d = fb.get(x, y), out = [0, 0, 0];
  for (let k = 0; k < 3; k++)
    out[k] = linear ? toSrgb(a * toLin(rgb[k]) + (1 - a) * toLin(d[k]))
                    : a * rgb[k] + (1 - a) * d[k];
  fb.set(x, y, out.map((v) => Math.round(v)));
}

/**
 * Xiaolin Wu (1991) anti-aliased line in CONTINUOUS coordinates under this
 * module's convention (pixel (x,y) has its centre at (x+0.5, y+0.5)).
 * Coverage of the two pixels straddling the line in each column is the
 * fractional distance; blended in linear light unless opts.linear === false.
 */
export function lineWu(x0, y0, x1, y1, fb, rgb = [255, 255, 255], { linear = true } = {}) {
  // shift so integer coordinates = pixel centres (the form Wu is usually given in)
  x0 -= 0.5; y0 -= 0.5; x1 -= 0.5; y1 -= 0.5;
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  if (steep) { [x0, y0] = [y0, x0]; [x1, y1] = [y1, x1]; }
  if (x0 > x1) { [x0, x1] = [x1, x0]; [y0, y1] = [y1, y0]; }
  const dx = x1 - x0, dy = y1 - y0;
  const grad = dx === 0 ? 1 : dy / dx;
  const fpart = (v) => v - Math.floor(v), rfpart = (v) => 1 - fpart(v);
  const plot = (x, y, a) => (steep ? blendPixel(fb, y, x, rgb, a, linear) : blendPixel(fb, x, y, rgb, a, linear));
  // end points
  const endpoint = (x, y, first) => {
    const xend = Math.round(x), yend = y + grad * (xend - x);
    const xgap = first ? rfpart(x + 0.5) : fpart(x + 0.5);
    const xpxl = xend, ypxl = Math.floor(yend);
    plot(xpxl, ypxl, rfpart(yend) * xgap);
    plot(xpxl, ypxl + 1, fpart(yend) * xgap);
    return { yend, xpxl };
  };
  const a = endpoint(x0, y0, true), b = endpoint(x1, y1, false);
  let inter = a.yend + grad;
  for (let x = a.xpxl + 1; x < b.xpxl; x++) {
    plot(x, Math.floor(inter), rfpart(inter));
    plot(x, Math.floor(inter) + 1, fpart(inter));
    inter += grad;
  }
}

// -------------------------------------------------------- octant awareness
/**
 * n-spoke asterisk around (cx,cy), radius r (pixels), spokes every 360/n deg,
 * drawn with lineBresenham. Returns per-spoke { angle, pixels, euclid } where
 * euclid = distance from centre to the last pixel -- equal for all spokes
 * (within +-1 px) iff every octant is handled correctly.
 */
export function asterisk(fb, cx, cy, r, n = 24, rgb = [255, 255, 255]) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n;
    const ex = Math.round(cx + r * Math.cos(ang)), ey = Math.round(cy - r * Math.sin(ang));
    const pts = lineBresenham(cx, cy, ex, ey, fb, rgb);
    const last = pts[pts.length - 1];
    out.push({ angleDeg: (360 * i) / n, pixels: pts.length, euclid: Math.hypot(last[0] - cx, last[1] - cy), end: [ex, ey] });
  }
  return out;
}
