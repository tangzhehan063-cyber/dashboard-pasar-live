# Dashboard Pasar Live

Dashboard React yang berwarna untuk harga crypto, saham US, saham IDX, dan portofolio,
dengan data live dari konektor **Pluang** milik pengunjung (read-only).

Live: https://claude.ai/artifact/9r7u6ZdsbRauyYWtNhsBsM

## Struktur

```
src/
  main.jsx     titik masuk React
  App.jsx      semua komponen: Portfolio, PriceChart, CryptoCard, StockCard
  mcp.js       jembatan ke konektor Pluang (useWatch hook, pesan error)
  format.js    format Rupiah, Dolar, persen, tanggal
  styles.css   tema terang/gelap + palet warna per kelas aset
template.html  kerangka HTML
build.mjs      bundel semuanya jadi satu file dist/index.html (esbuild)
```

## Menjalankan

```bash
npm install
npm run build
```

Hasilnya `dist/index.html`. Data live hanya muncul saat halaman dibuka sebagai artifact
di claude.ai dengan konektor Pluang tersambung. Tanpa itu, halaman menampilkan pesan
untuk menyambungkan Pluang.

## Warna

Warna per kelas aset diambil dari palet kategorikal yang sudah divalidasi aman untuk buta warna,
dengan urutan tetap: Crypto `--c1` (biru), Saham US `--c2` (oranye), Saham IDX `--c3` (tosca),
USDT & lainnya `--c4` (kuning).

Bukan saran investasi.
