/* Module 2 / Lab 2.4 -- three pitfall fixes, each with measured evidence.
 *   (1) tight, clamped bounding box  vs  scanning the whole framebuffer
 *   (2) Wu anti-aliased line: linear-light blend vs naive sRGB blend
 *   (3) winding auto-flip so a reversed triangle is still filled
 *   node pitfalls.mjs                                                       */
import { Framebuffer, triangle, lineWu, lineBresenham } from "./raster.mjs";
import { mkdirSync } from "node:fs";
mkdirSync("out", { recursive: true });

// ---- (1) overdraw from a loose bounding box ------------------------------
{
  const W = 4096, H = 4096, A = [100, 100], B = [140, 104], C = [112, 140];
  const run = (opts) => {
    const fb = new Framebuffer(W, H);
    const t0 = performance.now(); let n;
    for (let k = 0; k < 5; k++) n = triangle(fb, A, B, C, [255, 255, 255], opts);
    return { ms: (performance.now() - t0) / 5, n, fb };
  };
  run({}); // warm-up
  const tight = run({}), loose = run({ fullScan: true });
  let same = true;
  for (let i = 0; i < tight.fb.data.length; i++) if (tight.fb.data[i] !== loose.fb.data[i]) { same = false; break; }
  console.log("(1) small triangle (~40x40 px) in a 4096x4096 framebuffer");
  console.log(`    clamped bbox : ${tight.ms.toFixed(2)} ms   (${tight.n} pixels filled)`);
  console.log(`    whole screen : ${loose.ms.toFixed(2)} ms   (${loose.n} pixels filled)   -> ${(loose.ms / tight.ms).toFixed(0)}x slower`);
  console.log(`    identical output: ${same}`);
  if (!same) throw new Error("bbox clamp changed the image");
}

// ---- (2) Wu line: linear-light vs naive blend ------------------------------
{
  const toLin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const draw = (linear) => {
    const fb = new Framebuffer(40, 20, [0, 0, 0]);
    lineWu(2, 3.5, 38, 13.25, fb, [255, 255, 255], { linear });
    return fb;
  };
  // total light emitted (sum of linear intensity) -- a 1px-wide line of length L
  // should deposit ~ one unit of light per column regardless of the blend space
  const light = (fb) => { let s = 0; for (let i = 0; i < fb.data.length; i += 3) s += toLin(fb.data[i]); return s; };
  const lin = draw(true), naive = draw(false);
  const cols = 36;
  console.log("\n(2) Wu line (2,3.5)->(38,13.25) white on black, 36 columns");
  console.log(`    linear-light blend : light per column = ${(light(lin) / cols).toFixed(3)}   (ideal 1.000)`);
  console.log(`    naive sRGB blend   : light per column = ${(light(naive) / cols).toFixed(3)}   -> line looks ${(100 * (1 - light(naive) / light(lin))).toFixed(0)}% too dark / thin`);
  lin.writePPM("out/wu_linear.ppm"); naive.writePPM("out/wu_naive.ppm");
  const hard = new Framebuffer(40, 20, [0, 0, 0]); lineBresenham(2, 3, 38, 13, hard);
  hard.writePPM("out/wu_bresenham.ppm");
  if (!(Math.abs(light(lin) / cols - 1) < 0.08 && light(naive) < light(lin))) throw new Error("Wu evidence unexpected");
}

// ---- (3) winding auto-flip --------------------------------------------------
{
  const A = [1, 1], B = [6, 2], C = [3, 7];          // total = +28
  const ok = new Framebuffer(8, 9), rev = new Framebuffer(8, 9), off = new Framebuffer(8, 9);
  const n1 = triangle(ok, A, B, C);
  const n2 = triangle(rev, A, C, B);                  // reversed winding, autoFlip on (default)
  const n3 = triangle(off, A, C, B, [255, 255, 255], { autoFlip: false });
  let same = true; for (let i = 0; i < ok.data.length; i++) if (ok.data[i] !== rev.data[i]) same = false;
  console.log("\n(3) reversed winding (A,C,B): total = -28");
  console.log(`    autoFlip OFF : ${n3} pixels   <- the whole triangle vanishes`);
  console.log(`    autoFlip ON  : ${n2} pixels   same image as correct winding (${n1}): ${same}`);
  if (!(n3 === 0 && n2 === n1 && same)) throw new Error("auto-flip evidence unexpected");
}
