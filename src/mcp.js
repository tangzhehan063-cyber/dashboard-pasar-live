// Bridge to the viewer's Pluang connector via the artifact runtime.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export const SERVER = "Pluang";
const UQ = "Dashboard Pasar Live: refresh otomatis";

export const store = {
  get(k, d) { try { const v = localStorage.getItem("dpl:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("dpl:" + k, JSON.stringify(v)); } catch {} },
};

// ---- connection state (mcp namespace + chat session id) ----
let conn = { status: "connecting", mcp: null, sid: null, error: null };
const subs = new Set();
const setConn = (patch) => { conn = { ...conn, ...patch }; subs.forEach((f) => f()); };
export const useConn = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => conn);

async function mintSid(mcp) {
  const r = await mcp.callTool(SERVER, "generate_new_session_id", { user_query: UQ });
  const p = r.payload || {};
  return (p.data && p.data.chatSessionId) || p.chatSessionId || null;
}

export async function connect(fresh = false) {
  try {
    const mcp = conn.mcp || (window.claude ? await window.claude.use("mcp") : null);
    if (!mcp) return setConn({ status: "unavailable", mcp: null });
    let sid = fresh ? null : store.get("sid", null);
    if (!sid) { sid = await mintSid(mcp); if (sid) store.set("sid", sid); }
    setConn({ status: "ready", mcp, sid, error: null });
  } catch (e) {
    setConn({ status: "error", error: e });
    if (e && e.retryable) setTimeout(() => connect(true), (e.retryAfterMs || 2000) + Math.random() * 1500);
  }
}

export async function refreshAll() {
  if (!conn.mcp) return connect(true);
  await conn.mcp.invalidate(SERVER).catch(() => {});
  if (!conn.sid) await connect(true);
}

export const DENIAL = new Set(["needs_reauth", "server_not_connected", "blocked_by_policy", "approval_required",
  "not_in_manifest", "selection_required", "not_granted", "capability_disabled", "capability_removed"]);

export function errorCopy(e) {
  switch (e && e.code) {
    case "needs_reauth": return "Koneksi Pluang kedaluwarsa. Sambungkan ulang di claude.ai → Settings → Connectors.";
    case "server_not_connected": return "Konektor Pluang belum ditambahkan. Tambahkan di claude.ai → Settings → Connectors.";
    case "selection_required": return "Ada lebih dari satu konektor bernama Pluang. Pilih salah satu di prompt claude.ai.";
    case "not_in_manifest": return "Akses Pluang dimatikan untuk halaman ini.";
    case "blocked_by_policy": return "Kebijakan organisasi memblokir alat Pluang ini.";
    case "approval_required": return "Butuh persetujuan kamu untuk memakai Pluang. Klik Refresh untuk mengizinkan.";
    case "server_unavailable": return "Server Pluang sedang tidak bisa dihubungi. Data terakhir tetap ditampilkan.";
    case "tool_error": return "Pluang menolak permintaan: " + (e.message || "kesalahan tidak diketahui");
    default: return "Gagal memuat data (" + ((e && e.code) || "error") + ").";
  }
}

/** Live-updating read of one Pluang tool. Returns {data, error, at}. */
export function useWatch(tool, input, interval = 60000, enabled = true) {
  const { mcp, sid } = useConn();
  const [state, setState] = useState({ data: null, error: null, at: null });
  const key = JSON.stringify(input);
  const ref = useRef(null);
  useEffect(() => {
    if (!mcp || !sid || !enabled) return;
    const off = mcp.watchTool(SERVER, tool, { ...input, user_query: UQ, chat_session_id: sid }, (ev) => {
      if (ev.type === "data") {
        const p = ev.result.payload || {};
        if (p.success === false) {
          setState((s) => ({ ...s, error: { code: "tool_error", message: (p.error && (p.error.message || p.error)) || "gagal" } }));
          return;
        }
        setState({ data: p, error: null, at: ev.result.cache ? ev.result.cache.storedAt : Date.now() });
      } else {
        setState((s) => DENIAL.has(ev.error.code) ? { data: null, error: ev.error, at: null } : { ...s, error: ev.error });
      }
    }, { refetchInterval: interval, cache: { staleTime: Math.min(interval, 60000), gcTime: 6 * 3600e3 } });
    ref.current = off;
    return () => { try { off(); } catch {} };
  }, [mcp, sid, tool, key, interval, enabled]);
  return state;
}
