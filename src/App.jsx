import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConn, useWatch, connect, refreshAll, errorCopy, store } from "./mcp.js";
import LOGOS from "./logos.js";
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
const logoOf = (cls, sym) => LOGOS[(cls === "cryptocurrency" ? "c:" : cls === "global_equity" ? "s:" : "x:") + sym];
const ETFS = new Set("SPY VOO IVV VTI QQQ QQQM SMH SOXX SOXL TQQQ SQQQ DIA IWM ARKK SCHD VGT XLK XLF XLE XLV GLD SLV TLT VEA VWO EEM EFA RSP SPLV PSQ".split(" "));
function Avatar({ cls, text, etf }) {
  if (!etf && cls === "global_equity" && ETFS.has(text)) etf = true;
  const src = logoOf(cls, text);
  const [bad, setBad] = useState(false);
  return (
    <span className={"avatar " + (src && !bad ? "has-logo " + (cls === "cryptocurrency" ? "coin" : "co") : etf ? "etf-av" : "mono-av")} style={{ "--c": `var(${CLS[cls].var})` }} aria-hidden="true">
      {src && !bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} /> : text.replace(/[^A-Z0-9]/g, "").slice(0, etf ? 4 : 2)}
      {etf && <b className="etf-tag">ETF</b>}
    </span>
  );
}
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
function Portfolio({ masked, setMasked, onPick, picked }) {
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
        rows.push({ cls: cat.assetCategory, sym: ti.displaySymbol || ti.symbol || "?", name: ti.name || "", etf: ti.securityType === "ETF", qty: vp.totalQuantity, ...m });
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
    <Card no="01" title="Total Aset" className={"span2 porto" + (masked ? " masked" : "")} id="porto"
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
              <tr key={r.cls + r.sym} className={"pick" + (picked && picked.sym === r.sym && picked.cls === r.cls ? " sel" : "")} tabIndex={0} style={{ "--c": `var(${CLS[r.cls]?.var || "--c1"})` }} onClick={() => CLS[r.cls] && onPick({ cls: r.cls, sym: r.sym })} onKeyDown={(e) => e.key === "Enter" && CLS[r.cls] && onPick({ cls: r.cls, sym: r.sym })}>
                <td><div className="assetcell"><Avatar cls={r.cls} text={r.sym} etf={r.etf} /><div className="nm"><b>{r.sym}</b><div className="muted small"><span className="chip" style={{ "--c": `var(${CLS[r.cls]?.var || "--c1"})` }}>{CLS[r.cls]?.label || r.cls}</span> {r.name}</div></div></div></td>
                <td className="r mono secret hide-sm">{qty(r.qty)}{r.cls === "indo_stock" ? " lbr" : ""}</td>
                <td className="r mono secret">{money(r.value)}</td>
                <td className="r secret"><Delta value={r.profitValuePercentage} suffix={`${r.profitValue < 0 ? "−" : "+"}${money(Math.abs(r.profitValue)).replace("−", "")} (${pct(r.profitValuePercentage)})`} /></td>
              </tr>
            );
          }) : <tr><td colSpan="4" className="skel">{d ? "Belum ada aset di Crypto, Saham US, atau Saham IDX." : "memuat…"}</td></tr>}
        </tbody>
      </table>
      <div className="note">
        Klik baris aset untuk melihat analisisnya. Nilai aset sudah termasuk saldo USDT di tab Crypto (USDT tidak punya baris sendiri), tapi tidak termasuk emas, reksa dana, opsi, posisi leverage/CFD, futures, komoditas, dan saldo kas. Nilai tiap baris memakai mata uang kelasnya (US = USD).
        {partial.length > 0 && <> Daftar terpotong — {partial.join(", ")}.</>}
        {failed.length > 0 && <> Gagal memuat: {failed.map((x) => CLS[x]?.label || x.assetCategory || String(x)).join(", ")} (tidak masuk total).</>}
        {w.data && w.data.partial && <> Data kas belum lengkap.</>}
      </div>
      <ErrorNote error={h.error || w.error} />
    </Card>
  );
}

// ---------- Big chart ----------

// ---------- per-class tool routing ----------
const TOOLS = {
  cryptocurrency: { ohlc: "crypto_get_ohlc", tech: "crypto_get_technicals", fund: null, money: idrShort },
  global_equity: { ohlc: "us_stocks_get_ohlc", tech: "us_stocks_get_technicals", fund: "us_stocks_get_fundamentals", money: usd },
  indo_stock: { ohlc: "indo_stocks_get_ohlc", tech: "indo_stocks_get_technicals", fund: "indo_stocks_get_fundamentals", money: idr },
};
const SIG = { BULLISH: ["Cenderung naik", "up"], BUY: ["Beli", "up"], BEARISH: ["Cenderung turun", "down"], SELL: ["Jual", "down"], NEUTRAL: ["Netral", "flat"] };
const Signal = ({ s }) => { const [t, c] = SIG[s] || [s || "—", "flat"]; return <span className={"sig " + c}>{t}</span>; };
const num = (v, d = 2) => (v == null || !isFinite(v) ? "—" : new Intl.NumberFormat("id-ID", { maximumFractionDigits: d }).format(v));
const bigIdr = (v) => (v == null ? "—" : (v < 0 ? "−" : "") + "Rp" + num(Math.abs(v) / 1e12, 1) + " T");

// ---------- chart with support/resistance overlay ----------
function PriceChart({ asset, range, setRange, levels }) {
  const T0 = TOOLS[asset.cls];
  const o = useWatch(T0.ohlc, { symbol: asset.sym, interval: "DAILY", start: isoDaysAgo(range) }, 300000);
  const cs = (o.data && o.data.data) || null;
  const box = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 280 });
  const [hover, setHover] = useState(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const m = T0.money;
  const now = cs && cs.length ? cs[cs.length - 1].c : null;
  let body = <text x="50%" y="50%" textAnchor="middle" fill="var(--muted)" fontSize="13">Memuat grafik {asset.sym}…</text>, geo = null;
  if (cs && cs.length > 1) {
    const { w: W, h: H } = size, L = 4, R = 80, T = 12, B = 24;
    const ys = cs.map((c) => c.c);
    let min = Math.min(...cs.map((c) => c.l)), max = Math.max(...cs.map((c) => c.h));
    const pad = (max - min) * 0.08 || max * 0.01; min -= pad; max += pad;
    const X = (i) => L + (i / (cs.length - 1)) * (W - L - R);
    const Y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const n = cs.length, step = Math.max(1, Math.round(n / Math.max(2, Math.floor((W - L - R) / 90))));
    const path = ys.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1)).join(" ");
    const lv = (levels || []).filter((l) => l.value > min && l.value < max && ["S1", "R1"].includes(l.key));
    geo = { X, Y, ys };
    body = (<>
      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ink)" stopOpacity="0.10" /><stop offset="100%" stopColor="var(--ink)" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map((k) => { const v = min + (max - min) * (k / 3); const y = Y(v); return <g key={k}><line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" /><text x={W - R + 8} y={y + 4} fontSize="11" fill="var(--muted)" className="mono">{m(v)}</text></g>; })}
      {lv.map((l) => <g key={l.key}><line x1={L} x2={W - R} y1={Y(l.value)} y2={Y(l.value)} stroke={l.key[0] === "S" ? "var(--up)" : l.key[0] === "R" ? "var(--down)" : "var(--muted)"} strokeWidth="1" strokeDasharray="6 3" /><text x={L + 4} y={Y(l.value) + (l.key[0] === "S" ? 13 : -5)} fontSize="10" fill={l.key[0] === "S" ? "var(--up)" : l.key[0] === "R" ? "var(--down)" : "var(--muted)"} className="mono">{l.key === "PP" ? "Pivot" : l.key[0] === "S" ? "Support" : "Resistance"}</text></g>)}
      {cs.map((c, i) => ((i % step === 0 && n - 1 - i >= step * 0.6) || i === n - 1) ? <text key={i} x={X(i)} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="middle">{dateShort(c.st)}</text> : null)}
      <path d={path + ` L${X(n - 1)} ${H - B} L${X(0)} ${H - B} Z`} fill="url(#ag)" />
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={X(n - 1)} cy={Y(ys[n - 1])} r="4" fill="var(--accent)" stroke="var(--page)" strokeWidth="2" />
      {hover != null && <><line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} stroke="var(--muted)" strokeDasharray="3 3" /><circle cx={X(hover)} cy={Y(ys[hover])} r="5" fill="var(--accent)" stroke="var(--page)" strokeWidth="2" /></>}
      <rect x="0" y="0" width={W} height={H} fill="transparent"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - L) / (W - L - R)) * (n - 1))))); }}
        onPointerLeave={() => setHover(null)} />
    </>);
  }
  return (
    <div className="block">
      <div className="blockhead"><h3>Grafik harga</h3>
        <span className="row" role="group" aria-label="Rentang waktu">{[30, 90, 365].map((r) => <button key={r} className="btn sm" aria-pressed={range === r} onClick={() => setRange(r)}>{r === 365 ? "1T" : r === 90 ? "3B" : "1B"}</button>)}</span></div>
      <div className="hero"><span className="big mono">{m(now)}</span>{cs && cs.length > 0 && now && <><Delta now={now} base={cs[0].o} /><span className="muted small">dalam {range === 365 ? "1 tahun" : range === 90 ? "3 bulan" : "1 bulan"}</span></>}</div>
      <div className="chartbox" ref={box}>
        <svg viewBox={`0 0 ${size.w} ${size.h}`} role="img" aria-label={`Grafik harga ${asset.sym}`}>{body}</svg>
        {hover != null && geo && <div className="tip mono" style={{ left: geo.X(hover), top: geo.Y(geo.ys[hover]) }}>{new Date(cs[hover].st).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })} · {m(geo.ys[hover])}</div>}
      </div>
      <ErrorNote error={o.error} />
    </div>
  );
}

// ---------- technicals ----------
function Technicals({ asset, t, error }) {
  const d = t && t.data;
  const ind = d && (d.indicators || d);
  if (!ind) return <div className="block"><h3>Analisis teknikal</h3><div className="skel">{error ? "" : "memuat…"}</div><ErrorNote error={error} /></div>;
  const ma = ind.movingAverages || {}, osc = ind.oscillators || {};
  const overall = d.overallSummary || d.summary;
  const all = [...(ma.simpleIndicators || []), ...(ma.exponentialIndicators || []), ...(osc.indicators || [])];
  const get = (k) => all.find((x) => x.key === k);
  const m = TOOLS[asset.cls].money;
  const rsi = get("RSI_12") || get("RSI_6");
  const sr = ((ind.supportAndResistance || {}).indicators || []);
  const S = (k) => sr.find((x) => x.key === k)?.value;
  const Tally = ({ s }) => s ? <div className="tally"><i className="b" style={{ flexGrow: s.buyCount }} /><i className="n" style={{ flexGrow: s.neutralCount }} /><i className="s" style={{ flexGrow: s.sellCount }} /></div> : null;
  return (
    <div className="block">
      <h3>Analisis teknikal <span className="muted small">harian</span></h3>
      <div className="verdict"><Signal s={overall?.signal} /><span className="muted small mono">{overall ? `${overall.buyCount} beli · ${overall.neutralCount} netral · ${overall.sellCount} jual` : ""}</span></div>
      <dl className="facts-grid">
        <div><dt>Moving average</dt><dd><Signal s={ma.movingAveragesSummary?.signal} /><Tally s={ma.movingAveragesSummary} /></dd></div>
        <div><dt>Osilator</dt><dd><Signal s={osc.oscillatorsSummary?.signal} /><Tally s={osc.oscillatorsSummary} /></dd></div>
        <div><dt>RSI</dt><dd className="mono">{num(rsi?.value, 1)} <span className="muted small">{rsi ? (rsi.value > 70 ? "jenuh beli" : rsi.value < 30 ? "jenuh jual" : "wajar") : ""}</span></dd></div>
        <div><dt>SMA 50 / 200</dt><dd className="mono small">{m(get("SMA_50")?.value)} / {m(get("SMA_200")?.value)}</dd></div>
        <div><dt>Support (S1)</dt><dd className="mono up-t">{m(S("S1"))}</dd></div>
        <div><dt>Resistance (R1)</dt><dd className="mono down-t">{m(S("R1"))}</dd></div>
      </dl>
      <div className="note">{d.summary ? "Sinyal utama dari Pluang dihitung untuk 24 jam terakhir; rincian di bawahnya memakai data harian." : "Semua sinyal memakai data harian."}</div>
    </div>
  );
}

// ---------- fundamentals (from financial statements) ----------
function Bars({ rows, a, b, la, lb }) {
  const max = Math.max(...rows.map((r) => Math.max(Math.abs(r[a] || 0), Math.abs(r[b] || 0)))) || 1;
  return (
    <div className="bars" role="img" aria-label={`${la} dan ${lb} per periode`}>
      {rows.map((r) => <div key={r.timeframe} className="bar-col">
        <div className="bar-pair"><i className="ba" style={{ height: (Math.abs(r[a] || 0) / max) * 100 + "%" }} title={`${la}: ${bigIdr(r[a])}`} /><i className="bb" style={{ height: (Math.abs(r[b] || 0) / max) * 100 + "%" }} title={`${lb}: ${bigIdr(r[b])}`} /></div>
        <div className="mono small">{r.timeframe.replace(/\n/, " ")}</div>
      </div>)}
    </div>
  );
}
const LBL = { pe: "P/E", ps: "P/S", pb: "P/B", evebitda: "EV/EBITDA", gpm: "Margin kotor", opm: "Margin operasi", npm: "Margin bersih", roe: "ROE", roa: "ROA", de: "Utang/Ekuitas", debtToEquity: "Utang/Ekuitas", ttm: "Dividen yield", dividendYieldTTM: "Dividen yield", revenue: "Pendapatan", net_income: "Laba bersih", netIncome: "Laba bersih", eps: "EPS", bvps: "BVPS" };
function Fundamentals({ asset }) {
  const tool = TOOLS[asset.cls].fund;
  const isIDX = asset.cls === "indo_stock";
  const f = useWatch(tool || "none", { symbol: asset.sym, ...(isIDX ? { include_financials: true } : {}) }, 6 * 3600e3, !!tool);
  if (!tool) return <div className="block"><h3>Fundamental</h3><div className="note">Crypto tidak punya laporan keuangan. Gunakan grafik dan analisis teknikal.</div></div>;
  const d = f.data && f.data.data;
  if (!d) return <div className="block"><h3>Fundamental</h3><div className="skel">{f.error ? "" : "memuat…"}</div><ErrorNote error={f.error} /></div>;
  const fu = d.fundamentals || {};
  const ratios = Object.fromEntries((fu.ratios || []).flatMap((g) => g.fields.map((x) => [x.key, x.value])));
  const ov = Object.fromEntries(((fu.overview || {}).data || []).map((x) => [x.key, x.value]));
  const pick = (keys) => keys.filter((k) => ratios[k] && ratios[k] !== "-").map((k) => [LBL[k], ratios[k]]);
  const inc = d.financials && d.financials.yearly && d.financials.yearly.incomeStatement && d.financials.yearly.incomeStatement.chart;
  const eps = fu.earningsPerShare && fu.earningsPerShare.earnings;
  const pt = fu.priceTarget, ar = fu.analystRatings;
  return (
    <div className="block">
      <h3>Fundamental <span className="muted small">dari laporan keuangan</span></h3>
      <dl className="facts-grid">
        {["revenue", "net_income", "netIncome", "eps"].filter((k) => ov[k]).map((k) => <div key={k}><dt>{LBL[k]}</dt><dd className="mono">{ov[k]}</dd></div>)}
        {pick(["pe", "pb", "npm", "roe", "de", "debtToEquity", "ttm", "dividendYieldTTM"]).map(([l, v]) => <div key={l}><dt>{l}</dt><dd className="mono">{v}</dd></div>)}
      </dl>
      {inc && inc.length > 1 && <>
        <div className="lbl sp">Pendapatan vs laba bersih per tahun</div>
        <Bars rows={inc} a="revenue" b="netProfitLoss" la="Pendapatan" lb="Laba bersih" />
        <div className="legend small"><span><i className="ba" />Pendapatan</span><span><i className="bb" />Laba bersih</span><span className="muted mono">terakhir {bigIdr(inc[inc.length - 1].netProfitLoss)} laba</span></div>
      </>}
      {eps && <>
        <div className="lbl sp">EPS per kuartal: aktual vs perkiraan analis</div>
        <table className="tight"><tbody>{eps.axisValues.map((q, i) => <tr key={q}><td>{q}</td><td className="r mono">{eps.actualEps[i] ?? "—"}</td><td className="r mono muted">{eps.expectedEps[i] ?? "—"}</td><td className="r small">{eps.actualEps[i] == null ? "belum rilis" : eps.actualEps[i] >= eps.expectedEps[i] ? <span className="up-t">di atas perkiraan</span> : <span className="down-t">di bawah perkiraan</span>}</td></tr>)}</tbody></table>
      </>}
      {pt && <div className="note">Target harga analis: {usd(pt.targetLow)} – {usd(pt.targetHigh)}, konsensus <b className="mono">{usd(pt.targetConsensus)}</b>{ar ? ` · ${Math.round(ar.buyPercentage)}% dari ${ar.totalAnalystRatingCount} analis menyarankan beli` : ""}.</div>}
      {fu.earnings && fu.earnings.lastUpdated && <div className="note">{fu.earnings.lastUpdated.replace("Last updated on", "Diperbarui")}.</div>}
    </div>
  );
}

// ---------- analysis section ----------
function Analysis({ asset, setAsset, saved, setSaved }) {
  const [range, setRange] = usePersist("range2", 90);
  const t = useWatch(TOOLS[asset.cls].tech, { symbol: asset.sym, timeframe: "DAILY" }, 600000);
  const ind = t.data && t.data.data && (t.data.data.indicators || t.data.data);
  const levels = ind && ind.supportAndResistance && ind.supportAndResistance.indicators;
  const [text, setText] = useState(""); const [cls, setCls] = useState("indo_stock");
  return (
    <Card cls={asset.cls} no="02" title={<span className="atitle"><Avatar cls={asset.cls} text={asset.sym} /> Analisis {asset.sym}</span>} className="span2"
      right={<small>{CLS[asset.cls].label}</small>}>
      <div className="picker">
        {saved.map((a) => <span key={a.cls + a.sym} className={"tag mono" + (a.sym === asset.sym && a.cls === asset.cls ? " on" : "")}>
          <button type="button" onClick={() => setAsset(a)}>{a.sym}</button>
          <button type="button" aria-label={`Hapus ${a.sym}`} onClick={() => setSaved(saved.filter((x) => x !== a))}>×</button></span>)}
        <form className="add" onSubmit={(e) => { e.preventDefault(); const sym = text.toUpperCase().replace(/[^A-Z0-9.\-]/g, ""); if (!sym) return; const a = { cls, sym }; if (!saved.some((x) => x.sym === sym && x.cls === cls)) setSaved([...saved, a]); setAsset(a); setText(""); }}>
          <select aria-label="Jenis aset" value={cls} onChange={(e) => setCls(e.target.value)}><option value="indo_stock">IDX</option><option value="global_equity">US</option><option value="cryptocurrency">Crypto</option></select>
          <input aria-label="Ticker" placeholder="+ ticker, mis. BBRI" value={text} onChange={(e) => setText(e.target.value)} />
        </form>
      </div>
      <PriceChart key={asset.cls + asset.sym} asset={asset} range={range} setRange={setRange} levels={levels} />
      <div className="two">
        <Technicals asset={asset} t={t.data} error={t.error} />
        <Fundamentals key={asset.cls + asset.sym} asset={asset} />
      </div>
      <div className="note">Indikator teknikal dan angka fundamental dihitung oleh Pluang. Bukan saran investasi.</div>
    </Card>
  );
}

// ---------- App ----------
function usePersist(key, init) {
  const [v, setV] = useState(() => store.get(key, init));
  return [v, (x) => { setV(x); store.set(key, x); }];
}
const SAVED0 = [{ cls: "indo_stock", sym: "BBCA" }, { cls: "global_equity", sym: "AAPL" }, { cls: "cryptocurrency", sym: "BTC" }];

export default function App() {
  const conn = useConn();
  const [masked, setMasked] = usePersist("mask", false);
  const [theme, setTheme] = usePersist("theme", null);
  const [saved, setSaved] = usePersist("saved", SAVED0);
  const [asset, setAssetRaw] = usePersist("asset", SAVED0[0]);
  const [busy, setBusy] = useState(false);
  const setAsset = (a) => { setAssetRaw(a); if (!saved.some((x) => x.sym === a.sym && x.cls === a.cls)) setSaved([...saved, a]); };
  useEffect(() => { connect(); }, []);
  useEffect(() => { if (theme) document.documentElement.dataset.theme = theme; }, [theme]);
  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="wrap">
      <header>
        <div className="mast">
          <div className="kicker mono"><span className={"dot" + (conn.status === "ready" ? " live" : "")} />{today}</div>
          <h1>Lembar Pasar</h1>
        </div>
        <div className="row">
          <button className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await refreshAll(); } finally { setBusy(false); } }}>↻ Refresh</button>
          <button className="btn" onClick={() => setTheme(getComputedStyle(document.documentElement).colorScheme.includes("dark") ? "light" : "dark")}>Terang / Gelap</button>
        </div>
      </header>
      {conn.status === "unavailable" && <div className="banner">Data live butuh konektor <b>Pluang</b>. Buka halaman ini di claude.ai dengan akun yang sudah menyambungkan Pluang.</div>}
      {conn.status === "error" && <div className="banner">{errorCopy(conn.error)}</div>}
      <div className="grid">
        <Portfolio masked={masked} setMasked={setMasked} picked={asset} onPick={setAsset} />
        <Analysis asset={asset} setAsset={setAsset} saved={saved} setSaved={setSaved} />
      </div>
      <footer>Sumber data: konektor Pluang milik yang membuka halaman ini (read-only, tidak ada tombol beli/jual). Bukan saran investasi.</footer>
    </div>
  );
}
