import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConn, useWatch, connect, refreshAll, errorCopy, store } from "./mcp.js";
import { idr, idrShort, usd, pct, qty, isoDaysAgo, dateShort } from "./format.js";

// Identity colour per asset class — fixed order from the validated categorical palette.
const CLS = {
  cryptocurrency: { label: "Crypto", var: "--c1", icon: "₿" },
  global_equity: { label: "Saham US", var: "--c2", icon: "$" },
  indo_stock: { label: "Saham IDX", var: "--c3", icon: "Rp" },
  usdt: { label: "USDT & lainnya", var: "--c4", icon: "₮" },
};
const DEFAULTS = { crypto: ["BTC", "ETH", "SOL", "XRP", "DOGE"], us: ["AAPL", "NVDA", "TSLA", "MSFT"], idx: ["BBCA", "BBRI", "TLKM", "GOTO"] };

// ---------- small UI atoms ----------
function Delta({ now, base, value, suffix }) {
  let p = value;
  if (p == null && isFinite(now) && isFinite(base) && base) p = ((now - base) / base) * 100;
  if (p == null || !isFinite(p)) return <span className="delta">—</span>;
  const dir = p > 0.005 ? "up" : p < -0.005 ? "down" : "flat";
  return (
    <span className={"delta " + dir} title={dir === "up" ? "naik" : dir === "down" ? "turun" : "datar"}>
      <span className="ic" aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "■"}</span>
      {suffix ?? pct(p)}
    </span>
  );
}
const Avatar = ({ cls, text }) => (
  <span className="avatar" style={{ "--c": `var(${CLS[cls].var})` }} aria-hidden="true">{text.slice(0, 4)}</span>
);
const ErrorNote = ({ error }) => (error ? <div className="err"><b>!</b> {errorCopy(error)}</div> : null);
function Card({ cls, no, title, right, children, className = "", id }) {
  return (
    <section className={"card " + className} id={id} style={cls ? { "--c": `var(${CLS[cls].var})` } : undefined}>
      <h2>
        <span className="h2l">{no && <span className="no mono" aria-hidden="true">{no}</span>}{title}</span>
        {right}
      </h2>
      {children}
    </section>
  );
}

function ListEditor({ value, onSave, placeholder, label }) {
  const [text, setText] = useState("");
  const add = (e) => {
    e.preventDefault();
    const v = [...new Set([...value, ...text.toUpperCase().split(/[\s,;]+/).map((s) => s.replace(/[^A-Z0-9.\-]/g, "")).filter(Boolean)])].slice(0, 25);
    onSave(v); setText("");
  };
  return (
    <form className="edit" onSubmit={add}>
      {value.map((s) => <button type="button" key={s} className="tag mono" aria-label={`Hapus ${s}`} title={`Hapus ${s}`} onClick={() => onSave(value.filter((x) => x !== s))}>{s}<span aria-hidden="true">×</span></button>)}
      <input aria-label={label} placeholder={"+ " + placeholder} value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  );
}

function Sparkline({ values }) {
  if (!values || values.length < 2) return <span className="skel">…</span>;
  const w = 84, h = 26, min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((c, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((c - min) / span) * (h - 6)]);
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--c)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="var(--c)" />
    </svg>
  );
}

// ---------- Portfolio ----------
function Portfolio({ masked, setMasked }) {
  const h = useWatch("portfolio_get_holdings", { category: "all", sort_by: "value_desc", limit: 50 }, 120000);
  const w = useWatch("portfolio_get_wallet_balance", {}, 120000);
  const bp = useWatch("portfolio_get_buying_power", { asset_class: "us_stocks" }, 300000);
  const d = h.data && h.data.data;
  const t = d && d.reportedTotals;
  const rate = bp.data && bp.data.usdToIdrRate;
  const totals = w.data && w.data.data && w.data.data.totals;

  const { rows, partial, alloc } = useMemo(() => {
    const rows = [], partial = [], sums = {};
    ((d && d.assetCategories) || []).forEach((cat) => {
      const items = cat.assetCategoryData || [];
      if (cat.totalCount > items.length) partial.push(`${CLS[cat.assetCategory]?.label || cat.title}: ${items.length} dari ${cat.totalCount}`);
      items.forEach((it) => {
        const ti = it.tileInfo || {}, vp = (it.display && it.display.valueAndProfit) || {}, m = vp.meta || {};
        rows.push({ cls: cat.assetCategory, sym: ti.displaySymbol || ti.symbol || "?", name: ti.name || "", qty: vp.totalQuantity, ...m });
        const idrVal = m.currency === "USD" ? (rate ? m.value * rate : null) : m.value;
        if (idrVal != null) sums[cat.assetCategory] = (sums[cat.assetCategory] || 0) + idrVal;
      });
    });
    let alloc = null;
    if (t && rows.length && (rate || !rows.some((r) => r.currency === "USD"))) {
      const parts = ["cryptocurrency", "global_equity", "indo_stock"].filter((k) => sums[k] > 0).map((k) => ({ k, v: sums[k] }));
      const rest = t.netAssetValueIdr - parts.reduce((a, p) => a + p.v, 0);
      if (rest > t.netAssetValueIdr * 0.005) parts.push({ k: "usdt", v: rest });
      const total = parts.reduce((a, p) => a + p.v, 0);
      alloc = parts.map((p) => ({ ...p, share: p.v / total }));
    }
    return { rows, partial, alloc };
  }, [d, rate, t]);

  const cost = t ? t.netAssetValueIdr - t.unrealisedPnlIdr : null;
  const failed = (d && d.failed) || [];
  return (
    <Card no="01" title="Portofolio" className={"span2 porto" + (masked ? " masked" : "")} id="porto"
      right={<span className="row"><small className="hide-sm">refresh 2 mnt</small>
        <button className="btn sm" aria-pressed={masked} onClick={() => setMasked(!masked)}>{masked ? "Tampilkan angka" : "Sembunyikan angka"}</button></span>}>
      <div className="lede">
        <div className="lbl">Nilai aset hari ini</div>
        <p className="headline">
          <span className="mono secret">{t ? idr(t.netAssetValueIdr) : "—"}</span>
          {t && <> <span className={"word " + (t.unrealisedPnlIdr >= 0 ? "up" : "down")}>{t.unrealisedPnlIdr >= 0 ? "naik" : "turun"} {pct(Math.abs(t.unrealisedPnlIdr / cost * 100)).replace(/^[+−]/, "")}</span> dari modal.</>}
        </p>
        <div className="facts mono">
          {t && <span className="secret">{(t.unrealisedPnlIdr >= 0 ? "+" : "−") + idr(Math.abs(t.unrealisedPnlIdr)).replace("−", "")} belum terealisasi</span>}
          <span>Kas <b className="secret">{totals?.IDR ? idr(totals.IDR.amount) : "—"}</b></span>
          <span>Dolar <b className="secret">{totals?.USD ? usd(totals.USD.amount) : "—"}</b></span>
        </div>
      </div>

      {alloc && (
        <div className="alloc">
          <div className="lbl">Komposisi · perkiraan (dalam IDR{rate ? `, kurs Pluang Rp${rate.toLocaleString("id-ID")}/USD` : ""})</div>
          <div className="allocbar" role="img" aria-label={"Komposisi: " + alloc.map((a) => `${CLS[a.k].label} ${Math.round(a.share * 100)}%`).join(", ")}>
            {alloc.map((a) => (
              <div key={a.k} className="seg" style={{ flexGrow: a.share, background: `var(${CLS[a.k].var})` }} title={`${CLS[a.k].label}: ${idr(a.v)} (${(a.share * 100).toFixed(1)}%)`} />
            ))}
          </div>
          <div className="legend">
            {alloc.map((a) => (
              <span key={a.k}><i style={{ background: `var(${CLS[a.k].var})` }} />{CLS[a.k].label} <b className="mono">{(a.share * 100).toFixed(1).replace(".", ",")}%</b> <span className="muted mono secret">{idrShort(a.v)}</span></span>
            ))}
          </div>
        </div>
      )}

      <table>
        <thead><tr><th>Aset</th><th className="r hide-sm">Jumlah</th><th className="r">Nilai</th><th className="r">Untung/rugi</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((r) => {
            const money = r.currency === "USD" ? usd : idr;
            return (
              <tr key={r.cls + r.sym}>
                <td><div className="assetcell"><Avatar cls={r.cls} text={r.sym} /><div className="nm"><b>{r.sym}</b><div className="muted small"><span className="chip" style={{ "--c": `var(${CLS[r.cls]?.var || "--c1"})` }}>{CLS[r.cls]?.label || r.cls}</span> {r.name}</div></div></div></td>
                <td className="r mono secret hide-sm">{qty(r.qty)}{r.cls === "indo_stock" ? " lbr" : ""}</td>
                <td className="r mono secret">{money(r.value)}</td>
                <td className="r secret"><Delta value={r.profitValuePercentage} suffix={`${r.profitValue < 0 ? "−" : "+"}${money(Math.abs(r.profitValue)).replace("−", "")} (${pct(r.profitValuePercentage)})`} /></td>
              </tr>
            );
          }) : <tr><td colSpan="4" className="skel">{d ? "Belum ada aset di Crypto, Saham US, atau Saham IDX." : "memuat…"}</td></tr>}
        </tbody>
      </table>
      <div className="note">
        Nilai aset sudah termasuk saldo USDT di tab Crypto (USDT tidak punya baris sendiri), tapi tidak termasuk emas, reksa dana, opsi, posisi leverage/CFD, futures, komoditas, dan saldo kas. Nilai tiap baris memakai mata uang kelasnya (US = USD).
        {partial.length > 0 && <> Daftar terpotong — {partial.join(", ")}.</>}
        {failed.length > 0 && <> Gagal memuat: {failed.map((x) => CLS[x]?.label || x.assetCategory || String(x)).join(", ")} (tidak masuk total).</>}
        {w.data && w.data.partial && <> Data kas belum lengkap.</>}
      </div>
      <ErrorNote error={h.error || w.error} />
    </Card>
  );
}

// ---------- Big chart ----------
function PriceChart({ symbol, range, setRange, livePrice }) {
  const o = useWatch("crypto_get_ohlc", { symbol, interval: "DAILY", start: isoDaysAgo(range) }, 300000);
  const cs = (o.data && o.data.data) || null;
  const box = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 260 });
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const now = livePrice ?? (cs && cs.length ? cs[cs.length - 1].c : null);

  let body = <text x="50%" y="50%" textAnchor="middle" fill="var(--muted)" fontSize="13">Memuat grafik {symbol}…</text>;
  let geo = null;
  if (cs && cs.length > 1) {
    const { w: W, h: H } = size, L = 8, R = 78, T = 12, B = 24;
    const ys = cs.map((c) => c.c); let min = Math.min(...ys), max = Math.max(...ys);
    const pad = (max - min) * 0.08 || max * 0.01; min -= pad; max += pad;
    const X = (i) => L + (i / (cs.length - 1)) * (W - L - R);
    const Y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const n = cs.length, step = Math.max(1, Math.round(n / Math.max(2, Math.floor((W - L - R) / 90))));
    const path = ys.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
    geo = { X, Y, ys, n, L, R, W };
    body = (
      <>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((k) => { const v = min + (max - min) * (k / 3); const y = Y(v); return (
          <g key={k}><line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" /><text x={W - R + 8} y={y + 4} fontSize="11" fill="var(--muted)" className="mono">{idrShort(v)}</text></g>); })}
        {cs.map((c, i) => ((i % step === 0 && n - 1 - i >= step * 0.6) || i === n - 1) ? <text key={i} x={X(i)} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="middle">{dateShort(c.st)}</text> : null)}
        <path d={path + ` L${X(n - 1)} ${H - B} L${X(0)} ${H - B} Z`} fill="url(#areaGrad)" />
        <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(n - 1)} cy={Y(ys[n - 1])} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        {hover != null && <>
          <line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" />
          <circle cx={X(hover)} cy={Y(ys[hover])} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        </>}
        <rect x="0" y="0" width={W} height={H} fill="transparent"
          onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - L) / (W - L - R)) * (n - 1))))); }}
          onPointerLeave={() => setHover(null)} />
      </>
    );
  }
  return (
    <Card cls="cryptocurrency" no="02" title={`${symbol} · Harga harian`}
      right={<span className="row" role="group" aria-label="Rentang waktu">{[7, 30, 90].map((r) => <button key={r} className="btn sm" aria-pressed={range === r} onClick={() => setRange(r)}>{r}H</button>)}</span>}>
      <div className="hero">
        <span className="big mono">{idrShort(now)}</span>
        {cs && cs.length > 0 && now && <><Delta now={now} base={cs[0].o} /><span className="muted small">dalam {range} hari</span></>}
      </div>
      <div className="note">Harga penutupan harian (IDR). Klik koin di tabel Crypto untuk ganti grafik.</div>
      <div className="chartbox" ref={box}>
        <svg viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label={`Grafik harga penutupan ${symbol} ${range} hari`}>{body}</svg>
        {hover != null && geo && <div className="tip mono" style={{ left: geo.X(hover), top: geo.Y(geo.ys[hover]) }}>
          {new Date(cs[hover].st).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })} · {idrShort(geo.ys[hover])}</div>}
      </div>
      {cs && <details><summary>Lihat sebagai tabel</summary><table><thead><tr><th>Tanggal</th><th className="r">Buka</th><th className="r">Tertinggi</th><th className="r">Terendah</th><th className="r">Tutup</th></tr></thead>
        <tbody>{cs.slice().reverse().map((c) => <tr key={c.st}><td>{new Date(c.st).toLocaleDateString("id-ID")}</td><td className="r mono">{idrShort(c.o)}</td><td className="r mono">{idrShort(c.h)}</td><td className="r mono">{idrShort(c.l)}</td><td className="r mono">{idrShort(c.c)}</td></tr>)}</tbody></table></details>}
      <ErrorNote error={o.error} />
    </Card>
  );
}

// ---------- Crypto table (one row component per coin, each with its own 7-day watch) ----------
function CryptoRow({ sym, px, selected, onPick }) {
  const o = useWatch("crypto_get_ohlc", { symbol: sym, interval: "DAILY", start: isoDaysAgo(7) }, 300000);
  const cs = o.data && o.data.data;
  const mid = px ? px.midPrice : null;
  const week = cs && cs.length ? cs.slice(-7).map((c) => c.c) : null;
  if (week && mid) week[week.length - 1] = mid;
  return (
    <tr className={"pick" + (selected ? " sel" : "")} tabIndex={0} onClick={onPick} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick())} aria-label={`Tampilkan grafik ${sym}`}>
      <td><div className="assetcell"><Avatar cls="cryptocurrency" text={sym} /><b>{sym}</b></div></td>
      <td className="r mono">{px ? idrShort(mid) : <span className="skel">memuat…</span>}</td>
      <td className="r"><Delta now={mid} base={cs && cs.length ? cs[cs.length - 1].o : NaN} /></td>
      <td className="r hide-xs"><Sparkline values={week} /></td>
    </tr>
  );
}
function CryptoCard({ list, setList, selected, setSelected, prices }) {
  return (
    <Card cls="cryptocurrency" no="03" title="Crypto" right={<small>IDR · 60 dtk</small>}>
      <table>
        <thead><tr><th>Koin</th><th className="r">Harga</th><th className="r">Hari ini</th><th className="r hide-xs">7 hari</th></tr></thead>
        <tbody>{list.length ? list.map((s) => <CryptoRow key={s} sym={s} px={prices.data && (prices.data.data || []).find((r) => r.symbol === s)} selected={s === selected} onPick={() => setSelected(s)} />)
          : <tr><td colSpan="4" className="skel">Daftar kosong.</td></tr>}</tbody>
      </table>
      <div className="note">"Hari ini" = dibanding harga buka 07:00 WIB. Harga = mid, bukan harga beli/jual.</div>
      <ListEditor value={list} onSave={setList} placeholder="tambah koin" label="Daftar koin" />
      <ErrorNote error={prices.error} />
    </Card>
  );
}

function StockCard({ kind, list, setList }) {
  const isUS = kind === "us";
  const q = useWatch(isUS ? "us_stocks_get_price" : "indo_stocks_get_price", { symbols: list }, 60000, list.length > 0);
  const p = q.data || {};
  const rows = p.data || [];
  const bad = [...(p.unrecognisedSymbols || []), ...(p.failedSymbols || [])];
  const st = p.marketStatus;
  const status = !isUS ? "IDR per lembar" : "USD · " + (!st ? "…" : st.isMarketOpen ? "pasar BUKA" : st.isPreMarketOpen ? "pre-market" : st.isPostMarketOpen ? "after-hours" : st.isOvernightMarketOpen ? "overnight" : "pasar TUTUP");
  const cls = isUS ? "global_equity" : "indo_stock";
  return (
    <Card cls={cls} no={isUS ? "04" : "05"} title={isUS ? "Saham US" : "Saham IDX"} right={<small>{status}</small>}>
      <table>
        <thead><tr><th>Ticker</th><th className="r">Harga</th><th className="r">vs kemarin</th><th className="r hide-sm">{isUS ? "Rentang hari" : "Nilai transaksi"}</th></tr></thead>
        <tbody>{list.map((s) => {
          const r = rows.find((x) => x.symbol === s);
          if (!r) return <tr key={s}><td><div className="assetcell"><Avatar cls={cls} text={s} /><b>{s}</b></div></td><td className="r skel" colSpan="3">{bad.includes(s) ? "tidak dikenali" : q.data ? "tidak ada data" : "memuat…"}</td></tr>;
          const price = isUS ? r.midPrice : r.lastPrice;
          return (
            <tr key={s}>
              <td><div className="assetcell"><Avatar cls={cls} text={s} /><b>{s}</b></div></td>
              <td className="r mono">{isUS ? usd(price) : idr(price)}</td>
              <td className="r"><Delta now={price} base={r.prevClosePrice > 0 ? r.prevClosePrice : NaN} /></td>
              <td className="r mono muted small hide-sm">{isUS ? (r.lowPrice != null ? `${usd(r.lowPrice)}–${usd(r.highPrice)}` : "—") : r.stats?.turnover ? "Rp" + r.stats.turnover : "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
      {!isUS && <div className="note">Sesi IDX 09:00–12:00 & 13:30–15:00 WIB. Di luar jam itu, harga = transaksi terakhir. 1 lot = 100 lembar.</div>}
      <ListEditor value={list} onSave={setList} placeholder="tambah ticker" label={isUS ? "Daftar saham US" : "Daftar saham IDX"} />
      <ErrorNote error={q.error} />
    </Card>
  );
}

// ---------- App ----------
function usePersist(key, init) {
  const [v, setV] = useState(() => store.get(key, init));
  return [v, (x) => { setV(x); store.set(key, x); }];
}

export default function App() {
  const conn = useConn();
  const [crypto, setCrypto] = usePersist("crypto", DEFAULTS.crypto);
  const [us, setUs] = usePersist("us", DEFAULTS.us);
  const [idx, setIdx] = usePersist("idx", DEFAULTS.idx);
  const [selected, setSelected] = usePersist("sel", "BTC");
  const [range, setRange] = usePersist("range", 30);
  const [masked, setMasked] = usePersist("mask", false);
  const [theme, setTheme] = usePersist("theme", null);
  const [busy, setBusy] = useState(false);
  const prices = useWatch("crypto_get_price", { symbols: crypto }, 60000, crypto.length > 0);

  useEffect(() => { connect(); }, []);
  useEffect(() => { if (theme) document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (crypto.length && !crypto.includes(selected)) setSelected(crypto[0]); }, [crypto.join(",")]);

  const sel = crypto.includes(selected) ? selected : crypto[0] || "BTC";
  const live = prices.data && (prices.data.data || []).find((r) => r.symbol === sel);
  const updated = prices.at ? new Date(prices.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const tape = (prices.data && prices.data.data) || [];
  return (
    <div className="wrap">
      <header>
        <div className="mast">
          <div className="kicker mono"><span className={"dot" + (conn.status === "ready" && prices.data ? " live" : "")} />{today}{updated && ` · diperbarui ${updated}`}</div>
          <h1>Lembar Pasar</h1>
          <div className="sub">Crypto, Saham US, dan Saham IDX dari akun Pluang kamu.</div>
        </div>
        <div className="row">
          <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await refreshAll(); } finally { setBusy(false); } }}>↻ Refresh</button>
          <button className="btn" onClick={() => setTheme(getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "light" : "dark")}>Terang / Gelap</button>
        </div>
      </header>
      {tape.length > 0 && <div className="tape mono" aria-label="Harga crypto terkini">
        <div className="tape-in">{[0, 1].map((k) => <span key={k} aria-hidden={k === 1}>{tape.map((r) => <span key={r.symbol} className="tk"><b>{r.symbol}</b> {idrShort(r.midPrice)}</span>)}</span>)}</div>
      </div>}

      {conn.status === "unavailable" && <div className="banner">Data live butuh konektor <b>Pluang</b>. Buka halaman ini di claude.ai dengan akun yang sudah menyambungkan Pluang.</div>}
      {conn.status === "error" && <div className="banner">{errorCopy(conn.error)}</div>}

      <div className="grid">
        <Portfolio masked={masked} setMasked={setMasked} />
        <PriceChart symbol={sel} range={range} setRange={setRange} livePrice={live ? live.midPrice : null} />
        <CryptoCard list={crypto} setList={setCrypto} selected={sel} setSelected={setSelected} prices={prices} />
        <StockCard kind="us" list={us} setList={setUs} />
        <StockCard kind="idx" list={idx} setList={setIdx} />
      </div>
      <footer>Sumber data: konektor Pluang milik yang membuka halaman ini (read-only, tidak ada tombol beli/jual). Bukan saran investasi.</footer>
    </div>
  );
}
