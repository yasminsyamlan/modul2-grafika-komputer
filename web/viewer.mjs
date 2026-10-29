/* Module 2 -- the library-side render: the Pusaka3D floor plan with Three.js.
 *
 * Draws the SAME plan JSON (myplan.json, else pusaka_plan.json) that raster.mjs draws headless, at the SAME
 * pixel size, so `node compare.mjs out/plan_scratch.ppm plan_three.ppm`
 * shows a high-but-finite PSNR (the library anti-aliases the edges your
 * integer rasteriser leaves hard).
 *
 * The pipeline stages you still own even with a library: vertex winding,
 * canvas SIZE and pixelRatio, and the colour space of the clear colour.
 */
import * as THREE from "three";

const W = 800, H = 600;
const canvas = document.getElementById("c");
const qs = new URLSearchParams(location.search);
// HALF = 0.5 puts every line vertex at the CENTRE of its pixel, the same
// sample-centre convention raster.mjs uses (pixel (x,y) <-> point (x+.5,y+.5)).
// ?half=0 reproduces the classic half-pixel bug (lines straddle two pixel rows).
const HALF = qs.has("half") ? +qs.get("half") : 0.5;

// --- match raster.mjs exactly: no retina scaling, explicit size ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x121216, 1);

// an orthographic camera in PIXEL space, y-down to match the framebuffer
const camera = new THREE.OrthographicCamera(0, W, 0, H, -10, 10);
const scene = new THREE.Scene();

// viridis 5-step ramp -- identical to plan.mjs CATEGORY_RGB
const CATEGORY = {
  wall:   0x440154,
  cella:  0x3b528b,
  stair:  0x21918c,
  shrine: 0x5ec962,
  axis:   0xfde725,
};
const MARKER = { wall: "■", cella: "◆", stair: "▲", shrine: "●", axis: "‖" };

let plan, planName, world2screen, group;

function makeWorldToScreen(p) {
  const s = p.scale_px_per_m, [ox, oy] = p.origin_m;
  return ([xm, ym]) => [Math.round((xm + ox) * s), Math.round(H - 1 - (ym + oy) * s)];
}

function build(fillSilhouette) {
  if (group) scene.remove(group);
  group = new THREE.Group();

  if (fillSilhouette && plan.silhouette) {
    const shape = new THREE.Shape();
    plan.silhouette.points.map(world2screen).forEach(([x, y], i) => {
      i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    });
    const geo = new THREE.ShapeGeometry(shape);
    // DoubleSide: the y-down camera mirrors the winding, so a FrontSide mesh could be culled.
    const mat = new THREE.MeshBasicMaterial({ color: 0xe6ecf5, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(geo, mat));
  }

  for (const pl of plan.polylines) {
    const pts = pl.points.map(world2screen).map(([x, y]) => new THREE.Vector3(x + HALF, y + HALF, 1));
    if (pl.closed) pts.push(pts[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: CATEGORY[pl.category] ?? 0xffffff });
    group.add(new THREE.Line(geo, mat));
  }
  scene.add(group);
  renderer.render(scene, camera);
}

function buildLegend() {
  const rows = document.getElementById("rows");
  rows.innerHTML = "";
  for (const [cat, hex] of Object.entries(CATEGORY)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML =
      `<span class="swatch" style="background:#${hex.toString(16).padStart(6, "0")}"></span>` +
      `<span class="marker">${MARKER[cat]}</span><span>${cat}</span>`;
    rows.appendChild(row);
  }
}

// read the framebuffer back as top-down RGB (gl.readPixels is bottom-up, RGBA)
function readRGB() {
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const body = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const src = ((H - 1 - y) * W + x) * 4, dst = (y * W + x) * 3;
      body[dst] = px[src]; body[dst + 1] = px[src + 1]; body[dst + 2] = px[src + 2];
    }
  return body;
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

// PPM export (what `node compare.mjs out/plan_scratch.ppm plan_three.ppm` reads)
function exportPPM() {
  const header = new TextEncoder().encode(`P6\n${W} ${H}\n255\n`);
  download(new Blob([header, readRGB()], { type: "application/octet-stream" }), "plan_three.ppm");
}

// PNG export of the 800x600 canvas (pixel ratio forced to 1 above, so no retina 2x)
function exportPNG() {
  renderer.render(scene, camera);
  canvas.toBlob((b) => download(b, "plan_three.png"), "image/png");
}

function applyFilters() {
  const wrap = document.getElementById("wrap");
  wrap.classList.toggle("cvd-deuteranopia", document.getElementById("cvd").checked);
  wrap.classList.toggle("cvd-protanopia", document.getElementById("cvd2").checked);
  wrap.classList.toggle("cvd-grayscale", document.getElementById("gray").checked);
}

// plan candidates, first hit wins: the student's traced plan, then the committed fallback.
// Tried next to the page (GitHub Pages bundle) and one level up (npx serve . -> /web/).
const PLAN_FILES = qs.get("plan") ? [qs.get("plan")] : ["myplan.json", "pusaka_plan.json"];
async function loadFirstPlan() {
  const tried = [];
  for (const f of PLAN_FILES) for (const base of ["./", "../"]) {
    try {
      const r = await fetch(base + f);
      if (r.ok) return { plan: await r.json(), name: f };
      tried.push(`${base}${f} (${r.status})`);
    } catch (e) { tried.push(`${base}${f} (${e.message})`); }
  }
  throw new Error("no plan file found; tried " + tried.join(", "));
}

loadFirstPlan()
  .then(({ plan: p, name }) => {
    plan = p; planName = name;
    world2screen = makeWorldToScreen(plan);
    buildLegend();
    const fillBox = document.getElementById("fill");
    if (qs.has("fill")) fillBox.checked = qs.get("fill") !== "0";
    build(fillBox.checked);
    fillBox.addEventListener("change", (e) => build(e.target.checked));
    for (const id of ["cvd", "cvd2", "gray"]) document.getElementById(id).addEventListener("change", applyFilters);
    document.getElementById("export").addEventListener("click", exportPPM);
    document.getElementById("exportpng").addEventListener("click", exportPNG);
    document.getElementById("planname").textContent = `${plan.name} [${planName}]`;
    document.body.dataset.ready = "1";            // lets a headless test know the first frame is drawn
  })
  .catch((err) => {
    document.getElementById("view").insertAdjacentHTML(
      "beforeend",
      `<p style="color:#f66">Could not load the plan: ${err}. Serve the repo root, e.g. <code>npx serve .</code>, and open <code>/web/</code>.</p>`
    );
  });
