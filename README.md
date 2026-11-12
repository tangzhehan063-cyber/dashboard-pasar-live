# Lembar Pasar (Dashboard Pasar Live)

Dashboard sederhana: **total aset** dari akun Pluang + **analisis per aset** (grafik dengan support/resistance,
analisis teknikal, fundamental dari laporan keuangan). Data live dari konektor **Pluang** milik pengunjung (read-only).

Live: https://claude.ai/artifact/9r7u6ZdsbRauyYWtNhsBsM

## Struktur

```
src/
  App.jsx      Portfolio (total aset) + Analysis (PriceChart, Technicals, Fundamentals)
  mcp.js       jembatan ke konektor Pluang (useWatch hook, pesan error)
  format.js    format Rupiah, Dolar, persen, tanggal
  logos.js     logo koin & saham (data URI, hasil dev/fetch_logos.py)
  styles.css   gaya "koran keuangan": kertas + tinta, tema terang/gelap
template.html  kerangka HTML
build.mjs      bundel jadi satu file dist/index.html
dev/serve.mjs  pratinjau live-reload dengan data contoh (dev/mock.js)
previews/      tangkapan layar
```

## Menjalankan

```bash
npm install
npm run dev     # pratinjau di http://localhost:5173, otomatis reload, data contoh
npm run build   # hasil akhir: dist/index.html
```

Data asli hanya muncul saat halaman dibuka sebagai artifact di claude.ai dengan Pluang tersambung.
Artifact ini memakai tool Pluang: portfolio_get_holdings/wallet_balance/buying_power,
*_get_ohlc, *_get_technicals, us/indo_stocks_get_fundamentals.

## Logo

Crypto: `cryptocurrency-icons` (CC0). Saham US: `nvstly/icons` (tanpa lisensi tercantum).
ETF Invesco memakai logo penerbit; ETF lain dan saham IDX memakai lencana/inisial.
Perbarui dengan `python3 dev/fetch_logos.py <folder paket cryptocurrency-icons>`.

## Belum diterbitkan

Commit terakhir (logo ETF QQQ/SMH) belum dipublikasikan ke link live.

Bukan saran investasi.
