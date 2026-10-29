# Prediksi forward vs backward (ditulis SEBELUM menjalankan `node bench.mjs` pada myplan.json)

Plan: **Candi Siwa, Prambanan** (`myplan.json`): 17 polyline / 50 segmen, framebuffer 800x600 (480.000 pixel), zoom 1x dan 10x.
Total panjang segmen pada 1x = 8.943 px (dihitung dari koordinat, bukan diukur waktunya).

**Model biaya**
- Forward (Bresenham per segmen): biaya ~ jumlah pixel yang dilangkahi = total panjang segmen.
  Zoom 1x: ~8,9 ribu langkah. Zoom 10x: tiap segmen 10x lebih panjang (bagian di luar layar tetap dilangkahi,
  hanya `fb.set` yang menolak) -> ~89 ribu langkah.
- Backward (tiap pixel x tiap segmen, jarak titik-ke-segmen): ~ 480.000 x 50 = 24 juta uji jarak
  (berhenti dini hanya untuk pixel yang kena garis). Tidak bergantung zoom menurut model ini.

**Prediksi** (dari bench denah Pusaka lama: forward ~1 ms, backward ~360 ms untuk 37 segmen)
| zoom | forward | backward | rasio bwd/fwd |
|---|---|---|---|
| 1x  | ~1 ms (0,5-3 ms) | ~400-700 ms (50/37 x lebih banyak segmen) | ~200-600x |
| 10x | ~5-20 ms | ~300-700 ms | ~20-100x (mengecil karena forward tumbuh) |

Pemenang: **forward di kedua zoom**; keunggulannya menyusut seiring zoom naik.
