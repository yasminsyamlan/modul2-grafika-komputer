# Langkah akhir (hanya yang butuh data / akun Anda)

Kode inti sudah lengkap dan lolos `npm test` (20 ok). Sisa pekerjaan di bawah ini tidak bisa dibuat orang lain
karena bergantung pada bangunan, mesin, dan akun GitHub Anda. Kerjakan berurutan.

## 1. Denah milik Anda (Lab 1.2)
1. `npm install` lalu `npx serve .`
2. Buka `http://localhost:3000/tools/trace_plan.html`.
3. (Opsional) pilih foto/sketsa denah, kalibrasi dengan dua titik berjarak diketahui, lalu klik titik asal (sudut kiri-bawah).
4. Gambar polyline: minimal **satu dinding luar** (kategori `wall`, tertutup), **satu pembagian interior**
   (`wall`/`cella` tertutup), dan **satu pintu masuk** (`stair`). Tambah `shrine`/`axis` bila ada.
5. Klik *Unduh*, simpan sebagai **`myplan.json` di root repo**.
6. `node tests.mjs` harus tetap `ALL CHECKS PASSED` (ia memvalidasi skema + isi minimum).

## 2. Bangkitkan ulang bukti (Lab 3)
- `node tools/finalize.mjs` (tes -> render -> compare -> bench; hasil di `report/final_numbers.txt`).
- Tanpa Playwright: buka halaman viewer, ekspor PNG 800x600 (pixelRatio 1) sebagai `plan_three.png` di root, jalankan ulang.
- Tulis ulang prediksi di `PREDICTION.md` **sebelum** menjalankan `bench.mjs` pada denah baru, lalu salin angka ke LAPORAN A4.
- Ambil ulang screenshot legenda (normal & deuteranopia) dari halaman Anda ke `report/`.

## 3. Toolchain mesin Anda (Lab 1.1)
`node tools/record_toolchain.mjs "Chrome <versi dari chrome://version>"` -> memperbarui tabel di README dan LAPORAN.

## 4. Publikasi (Lab 3.5)
```bash
git init && git add . && git commit -m "Module 2 final"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```
Di GitHub: Settings -> Pages -> Source = **GitHub Actions**. Setelah workflow hijau, salin URL
`https://<user>.github.io/<repo>/` ke README ("Verified") dan LAPORAN A6.

## 5. Clean clone (Lab 3.6)
```bash
git clone https://github.com/<user>/<repo>.git clean && cd clean
npm install && npm test && npx serve web
```
atau `node tools/verify_clean_clone.mjs` (menulis `CLEAN_CLONE_TRANSCRIPT.txt`). Tempel transkrip ke LAPORAN A6
dan ubah baris "Verified" di README menjadi status asli Anda.

## 6. Cek terakhir sebelum kumpul
- [ ] `myplan.json` ada dan disebut di LAPORAN A1 (hapus catatan "fallback")
- [ ] Toolchain, tanggal, dan URL Pages sudah milik Anda
- [ ] Semua angka di A4 berasal dari denah Anda
- [ ] Anda bisa menjelaskan satu commit dan menjalankan `node tests.mjs` saat viva
