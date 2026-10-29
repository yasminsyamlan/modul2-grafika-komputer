# Module 2 -- Rendering Pipeline & 2D Primitives

Praktikum Grafika Komputer (`25MP7716G030`), S1 Informatika UM Surabaya.
From-scratch rasteriser in **plain JavaScript on Node** (no framework, no `<canvas>`) + a
**Three.js** viewer for the library comparison. Full write-up: [`LAPORAN.md`](LAPORAN.md).

## Toolchain (Lab 1, step 1)

> Recorded on the machine that produced the committed evidence. **Replace the row values with
> your own machine's before submitting** (`node -v`, browser `about:` page, `date`).

| Item | Value |
|---|---|
| OS | Windows 11 |
| Node | v24.14.1 |
| Browser | Google Chrome 141.0.7390.123 |
| Three.js | 0.160.0 |
| Date | 2026-10-29 |
## Input plan (Lab 1, step 2)

`myplan.json` is the graded input: a schematic floor plan of **Candi Siwa, Prambanan** (17 polylines / 50 segments),
the same subject as the Module 1 photo set. The 34 m base is the published figure; inner offsets, stair widths and
chamber sizes are proportional estimates, not a survey (stated in the file's `note`). The committed
`pusaka_plan.json` remains only as the fallback; delete or replace `myplan.json` and everything -- `node draw_plan.mjs`,
`bench.mjs`, `tests.mjs`, the web viewer -- switches back automatically.
`node tests.mjs` validates the schema and the Lab 1 minimum (outer wall, interior division, entrance).

## Commands

```bash
npm install                  # only `three` and `serve`
npm test                     # node tests.mjs -> ALL CHECKS PASSED (20 ok)
node draw_square.mjs --mode fill          # worked example: once=36 twice=0 gaps=0
node triangle_gap_bug.mjs                 # Lab 2 diagnose-and-fix evidence
node octant_test.mjs                      # 24-spoke asterisk
node pitfalls.mjs                         # bbox clamp / Wu linear-light / winding auto-flip
node sample_centre.mjs                    # E1 half-pixel demo
node draw_plan.mjs --w 800 --h 600 --fill # -> out/plan_scratch.ppm
node bench.mjs                            # forward vs backward (see PREDICTION.md, written first)
node cvd_check.mjs                        # legend distinguishability under simulated CVD
npx serve .                               # then open http://localhost:3000/web/
node compare.mjs out/plan_scratch.ppm plan_three.png --diff out/diff.png
node tools/capture_three.mjs              # optional: headless export of plan_three.png (needs Playwright)
```

`npm run lab2` runs the four Lab 2 evidence scripts in one go.

## Convention (stated once, never mixed)

`y` DOWN; pixel `(x,y)` is a point sample at `(x+.5, y+.5)`; triangles are passed so
`edge(A,B,C) > 0`; inside = all three edge functions `>= 0`; the on-edge (`E == 0`) case is decided by
an ownership rule: `rule:"module"` (default; the listing's rule, matches `ref/square_fill_ref.ppm`)
or `rule:"d3d"` (true Direct3D top-left). See LAPORAN A3 for why both exist.

## Deliverable

GitHub Pages: push to `main`; `.github/workflows/pages.yml` runs `npm test`, then publishes `web/`
plus the plan JSON. URL: `https://<user>.github.io/<repo>/` (fill in after the first deploy).

## Verified

| Item | Status | Date | Toolchain |
|---|---|---|---|
| `npm test` | **ALL CHECKS PASSED (20 ok)** | 2026-10-29 | Node v22.23.4 |
| Clean copy -> `npm install` -> `npm test` (via `tools/verify_clean_clone.mjs`) | **green** (transcript in LAPORAN A6); literal `git clone` run still to be done by you after push | 2026-10-29 | Node v22.23.4, npm 10 |
| `web/` viewer in a real browser | **yes** headless Chromium 141: plan + 5-category legend render, deuteranopia/protanopia/grayscale toggles keep the 5 categories distinct (screenshots in `report/`) | 2026-10-29 | Chromium 141, Three.js 0.160.0 |
| `plan_three.png` vs `out/plan_scratch.ppm` (myplan.json) | 479 952 / 480 000 identical, PSNR 56.7 dB (fill) | 2026-10-29 | Chromium 141, Three.js 0.160.0 |
| GitHub Pages URL | **not yet** -- needs your GitHub account (push + enable Pages -> "GitHub Actions") | -- | -- |

## Alat bantu untuk menyelesaikan bagian yang butuh data Anda sendiri

| Tujuan | Perintah / berkas |
|---|---|
| Trace denah sendiri -> `myplan.json` (Lab 1.2) | `npx serve .` lalu buka `/tools/trace_plan.html` |
| Isi toolchain milik mesin Anda (Lab 1.1) | `node tools/record_toolchain.mjs "Chrome 130.0.1"` |
| Bangkitkan ulang semua bukti dari `myplan.json` | `node tools/finalize.mjs` (atau `npm run final`) |
| Transkrip clean-copy untuk LAPORAN A6 | `node tools/verify_clean_clone.mjs` (atau `npm run verify`) |
| Urutan lengkap langkah akhir | [`SELESAIKAN.md`](SELESAIKAN.md) |
