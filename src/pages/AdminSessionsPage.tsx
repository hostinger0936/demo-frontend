// src/pages/AdminSessionsPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { AdminSessionDoc } from "../types";
import { listSessions, logoutAll, logoutDevice } from "../services/api/admin";

function formatTs(ts?: number | string | null) {
  if (!ts) return "-";
  try {
    const d = typeof ts === "number" ? new Date(ts) : new Date(String(ts));
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function isActive(lastSeen?: number | string | null) {
  const t =
    typeof lastSeen === "number"
      ? lastSeen
      : typeof lastSeen === "string"
        ? Number.isFinite(Date.parse(lastSeen))
          ? Date.parse(lastSeen)
          : Number(lastSeen)
        : 0;

  if (!t || !Number.isFinite(t)) return false;
  // active if seen within last 35 seconds
  return Date.now() - t < 35_000;
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSessionDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyDevice, setBusyDevice] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await listSessions();
      setSessions(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("load sessions failed", e);
      setError("Failed to load admin sessions");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => setRefreshTick((t) => t + 1), 12_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshTick > 0) load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const deviceRows = useMemo(() => {
    // group by deviceId and pick latest lastSeen per device
    const map = new Map<
      string,
      { deviceId: string; admins: string[]; lastSeen: any; count: number; raw: AdminSessionDoc[] }
    >();

    for (const s of sessions || []) {
      const did = (s as any).deviceId || "unknown";
      const admin = (s as any).admin || "admin";
      const lastSeen = (s as any).lastSeen;

      const prev = map.get(did);
      if (!prev) {
        map.set(did, { deviceId: did, admins: [admin], lastSeen, count: 1, raw: [s] });
      } else {
        prev.count += 1;
        prev.raw.push(s);
        if (!prev.admins.includes(admin)) prev.admins.push(admin);

        // keep max lastSeen
        const a = typeof prev.lastSeen === "number" ? prev.lastSeen : Date.parse(String(prev.lastSeen)) || 0;
        const b = typeof lastSeen === "number" ? lastSeen : Date.parse(String(lastSeen)) || 0;
        if (b > a) prev.lastSeen = lastSeen;
      }
    }

    const arr = Array.from(map.values());
    arr.sort((x, y) => {
      const a = typeof x.lastSeen === "number" ? x.lastSeen : Date.parse(String(x.lastSeen)) || 0;
      const b = typeof y.lastSeen === "number" ? y.lastSeen : Date.parse(String(y.lastSeen)) || 0;
      return b - a;
    });
    return arr;
  }, [sessions]);

  async function handleLogoutDevice(deviceId: string) {
    if (!confirm(`Force logout admin session on device "${deviceId}"?`)) return;
    setBusyDevice(deviceId);
    setError(null);
    try {
      await logoutDevice(deviceId);
      setSessions((prev) => prev.filter((s: any) => s.deviceId !== deviceId));
    } catch (e) {
      console.error("logoutDevice failed", e);
      setError("Failed to logout device");
    } finally {
      setBusyDevice(null);
    }
  }

  async function handleLogoutAll() {
    if (!confirm("Force logout ALL admin sessions?")) return;
    setBusyAll(true);
    setError(null);
    try {
      await logoutAll();
      setSessions([]);
    } catch (e) {
      console.error("logoutAll failed", e);
      setError("Failed to logout all sessions");
    } finally {
      setBusyAll(false);
    }
  }

  return (
    <div className="mx-auto max-w-[420px] px-3 pb-24 pt-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[22px] font-extrabold tracking-tight text-gray-900">Admin Sessions</div>
          <div className="text-[12px] text-gray-500">Active admin sessions connected to devices</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="h-10 px-4 rounded-2xl border bg-white text-sm font-semibold hover:bg-gray-50 active:scale-[0.99]"
            type="button"
          >
            Refresh
          </button>
          <button
            onClick={handleLogoutAll}
            className="h-10 px-4 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:brightness-105 active:brightness-95 disabled:opacity-60"
            disabled={busyAll}
            type="button"
          >
            {busyAll ? "Logging out…" : "Logout All"}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border bg-white p-3">
          <div className="text-[11px] text-gray-500">Active devices</div>
          <div className="mt-1 text-[18px] font-extrabold text-gray-900">
            {deviceRows.filter((d) => isActive(d.lastSeen)).length}
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-3">
          <div className="text-[11px] text-gray-500">Total sessions</div>
          <div className="mt-1 text-[18px] font-extrabold text-gray-900">{sessions.length}</div>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="rounded-2xl border bg-white p-4 text-center text-gray-500">Loading…</div>
        ) : deviceRows.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-center text-gray-500">
            No active sessions.
            <div className="mt-2 text-xs text-gray-400">
              Login once from web to create <span className="font-mono">device1</span> session.
            </div>
          </div>
        ) : (
          deviceRows.map((d) => {
            const active = isActive(d.lastSeen);
            const adminsText = d.admins.filter(Boolean).join(", ");

            return (
              <div key={d.deviceId} className="rounded-3xl border bg-white shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[16px] font-extrabold text-gray-900 truncate">{d.deviceId}</div>
                      <span
                        className={[
                          "px-2.5 py-1 rounded-full text-xs font-semibold border",
                          active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200",
                        ].join(" ")}
                      >
                        {active ? "Active" : "Offline"}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-gray-500 truncate">
                      Admin: <span className="text-gray-700 font-semibold">{adminsText || "admin"}</span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border bg-gray-50 p-3">
                        <div className="text-[11px] text-gray-500">Last seen</div>
                        <div className="mt-1 text-[12px] font-semibold text-gray-800">{formatTs(d.lastSeen)}</div>
                      </div>
                      <div className="rounded-2xl border bg-gray-50 p-3">
                        <div className="text-[11px] text-gray-500">Admins</div>
                        <div className="mt-1 text-[12px] font-semibold text-gray-800">{d.count}</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLogoutDevice(d.deviceId)}
                    className="shrink-0 h-10 px-4 rounded-2xl border text-sm font-semibold text-red-600 bg-white hover:bg-gray-50 active:scale-[0.99] disabled:opacity-60"
                    disabled={busyDevice === d.deviceId}
                    type="button"
                  >
                    {busyDevice === d.deviceId ? "…" : "Logout"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
    </div>
  );
}