// src/pages/LoginPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import loginBg from "../assets/login-bg.png";
import ztLogo from "../assets/zt-logo.png";
import { createAdminSession, getAdminLogin, saveAdminLogin } from "../services/api/admin";
import { setLoggedIn } from "../services/api/auth";
import { STORAGE_KEYS } from "../config/constants";

type ValidationResult = { ok: true; msg: "" } | { ok: false; msg: string };

function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-4.273 0-7.75 2.477-7.75 5.5 0 .552.448 1 1 1h13.5c.552 0 1-.448 1-1 0-3.023-3.477-5.5-7.75-5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M17 10V8a5 5 0 1 0-10 0v2H6a2 2 0 0 0-2 2v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a2 2 0 0 0-2-2h-1Zm-8 0V8a3 3 0 0 1 6 0v2H9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon: "user" | "lock";
  autoFocus?: boolean;
}) {
  const Icon = icon === "user" ? IconUser : IconLock;

  return (
    <div className="space-y-2">
      <label className="block text-[14px] font-semibold text-white/85">{label}</label>

      <div className="relative">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-cyan-200/35 via-white/10 to-blue-500/20" />
        <div className="absolute -inset-3 rounded-3xl blur-2xl bg-cyan-400/10" />

        <div className="relative rounded-2xl overflow-hidden border border-white/14 bg-white/5 backdrop-blur-xl">
          <div className="pointer-events-none absolute -top-10 -left-14 w-72 h-28 rotate-[-12deg] bg-white/16 blur-xl opacity-70" />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />

          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/55">
            <Icon className="w-5 h-5" />
          </span>

          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            type={type}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={[
              "w-full h-11 pl-11 pr-4",
              "bg-[#061A29]/35 text-white placeholder:text-white/35",
              "outline-none",
              "focus:bg-[#061A29]/45",
              "focus:shadow-[0_0_0_2px_rgba(34,211,238,0.18)]",
            ].join(" ")}
          />
        </div>
      </div>
    </div>
  );
}

function GlowDivider() {
  return (
    <div className="mt-4 flex justify-center">
      <div className="relative w-[340px] max-w-[92%] h-[3px]">
        <div className="absolute inset-0 rounded-full bg-white/18" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-cyan-200/95 to-transparent" />
        <div className="absolute -inset-x-10 -inset-y-4 blur-2xl bg-cyan-400/22" />
      </div>
    </div>
  );
}

function safeStr(v: any) {
  return (v ?? "").toString();
}

// ✅ Web deviceId helper (stable per browser)
function getOrCreateWebDeviceId(): string {
  const KEY = "zerotrace_web_device_id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.trim()) return existing.trim();

    // If user wants simple names: device1/device2...
    const counterKey = "zerotrace_web_device_counter";
    const nRaw = localStorage.getItem(counterKey);
    const n = Math.max(1, Number(nRaw || "1") || 1);
    const id = `device${n}`;

    localStorage.setItem(KEY, id);
    localStorage.setItem(counterKey, String(n + 1));

    return id;
  } catch {
    // fallback if storage blocked
    return `device${Math.floor(Math.random() * 10000)}`;
  }
}

export default function LoginPage() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [useApiKey, setUseApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem(STORAGE_KEYS.API_KEY) || "");

  // stored creds from backend (do not show pass)
  const [storedUser, setStoredUser] = useState<string>("");
  const [storedPass, setStoredPass] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await getAdminLogin();
        if (!mounted) return;

        const u = safeStr(data?.username).trim();
        const p = safeStr(data?.password).trim();

        setStoredUser(u);
        setStoredPass(p);

        if (u) setUsername(u);
        setPassword("");
      } catch {
        if (!mounted) return;
        setStoredUser("");
        setStoredPass("");
        setPassword("");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const validate = useMemo(
    () =>
      (): ValidationResult => {
        const u = (username || "").trim();
        const p = (password || "").trim();
        if (!u) return { ok: false, msg: "Username required" };
        if (!p) return { ok: false, msg: "Password required" };
        return { ok: true, msg: "" };
      },
    [username, password],
  );

  async function afterSuccessfulLogin(adminUser: string) {
    // ✅ mark logged-in
    setLoggedIn(adminUser);

    // ✅ store api key if requested
    try {
      if (useApiKey && apiKey.trim()) localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey.trim());
    } catch {}

    // ✅ create session in backend (this fills Mongo adminsessions)
    try {
      const deviceId = getOrCreateWebDeviceId();
      await createAdminSession(adminUser, deviceId);
    } catch {
      // ignore session create failures (UI should still work)
    }

    nav("/");
  }

  async function handleSaveAndLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    const v = validate();
    if (!v.ok) {
      setError(v.msg);
      return;
    }

    const u = username.trim();
    const p = password.trim();

    const hasStoredCreds = !!storedUser && !!storedPass;

    if (hasStoredCreds) {
      const ok = u === storedUser && p === storedPass;
      if (!ok) {
        setError("Invalid username or password");
        return;
      }

      setSaving(true);
      try {
        await afterSuccessfulLogin(u);
      } finally {
        setSaving(false);
      }
      return;
    }

    // first time: save new creds
    setSaving(true);
    try {
      await saveAdminLogin(u, p);

      setStoredUser(u);
      setStoredPass(p);

      await afterSuccessfulLogin(u);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Server error";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  }

  function handleClear() {
    try {
      localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
      localStorage.removeItem(STORAGE_KEYS.USERNAME);
    } catch {}
    setUsername(storedUser || "");
    setPassword("");
    setError(null);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-center bg-cover" style={{ backgroundImage: `url(${loginBg})` }} />
      <div className="absolute inset-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.55)]" />

      <div className="relative min-h-screen flex flex-col items-center px-4">
        <div className="w-full max-w-[560px] pt-10 sm:pt-12 text-center">
          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full blur-2xl bg-cyan-400/25" />
              <div className="relative w-14 h-14 rounded-full border border-white/25 bg-white/10 overflow-hidden">
                <img src={ztLogo} alt="ZeroTrace" className="w-full h-full object-cover" draggable={false} />
              </div>
            </div>

            <div className="text-left">
              <div className="text-[40px] leading-none font-extrabold tracking-wide text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                ZeroTrace
              </div>
              <div className="text-[18px] font-semibold tracking-wide text-white/90">Secure Admin Panel</div>
            </div>
          </div>

          <GlowDivider />
          <div className="mt-4 text-[22px] font-semibold tracking-[0.12em] text-white/85">No Trace. No Limit</div>
        </div>

        <div className="flex-1" />

        <div className="w-full max-w-[420px] pb-10 sm:pb-12">
          <div className="relative">
            <div className="absolute -inset-7 rounded-[40px] blur-3xl bg-cyan-400/22" />
            <div className="absolute -inset-4 rounded-[36px] blur-2xl bg-blue-500/14" />

            <div className="relative rounded-[32px] p-[1.5px] bg-gradient-to-b from-cyan-200/60 via-cyan-400/22 to-blue-500/38">
              <div
                className={[
                  "relative rounded-[30px] overflow-hidden",
                  "border border-white/16",
                  "bg-[linear-gradient(180deg,rgba(16,92,122,0.40)_0%,rgba(8,52,74,0.34)_55%,rgba(5,28,45,0.28)_100%)]",
                  "backdrop-blur-2xl",
                  "shadow-[0_34px_120px_rgba(0,0,0,0.62)]",
                  "px-6 py-6",
                ].join(" ")}
              >
                <div className="pointer-events-none absolute -top-16 -left-24 w-[520px] h-[240px] rotate-[-12deg] bg-white/18 blur-2xl opacity-60" />
                <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-1 ring-white/10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cyan-300/16 to-transparent" />

                {loading ? (
                  <div className="py-10 text-center text-white/80">Loading…</div>
                ) : (
                  <form onSubmit={handleSaveAndLogin} className="space-y-4">
                    <Field
                      label="Username"
                      value={username}
                      onChange={setUsername}
                      placeholder="Enter your username"
                      icon="user"
                      autoFocus
                    />

                    <Field
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Enter your password"
                      type="password"
                      icon="lock"
                    />

                    <label className="flex items-center gap-3 text-white/75 select-none pt-1">
                      <input
                        type="checkbox"
                        checked={useApiKey}
                        onChange={(e) => setUseApiKey(e.target.checked)}
                        className="h-5 w-5 rounded border-white/25 bg-white/10 text-cyan-400 focus:ring-cyan-400/25"
                      />
                      <span className="text-[15px]">Provide APi key (optional)</span>
                    </label>

                    {useApiKey && (
                      <div className="space-y-2">
                        <label className="block text-[14px] font-semibold text-white/85">API Key</label>

                        <div className="relative">
                          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-cyan-200/30 via-white/10 to-blue-500/18" />
                          <div className="relative rounded-2xl overflow-hidden border border-white/14 bg-white/5 backdrop-blur-xl">
                            <div className="pointer-events-none absolute -top-10 -left-14 w-72 h-28 rotate-[-12deg] bg-white/16 blur-xl opacity-70" />
                            <input
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="Paste API key here"
                              className={[
                                "w-full h-11 px-4",
                                "bg-[#061A29]/35 text-white placeholder:text-white/35",
                                "outline-none",
                                "focus:bg-[#061A29]/45",
                                "focus:shadow-[0_0_0_2px_rgba(34,211,238,0.18)]",
                              ].join(" ")}
                            />
                          </div>
                        </div>

                        <p className="text-[11px] text-white/40">Stored locally in browser (localStorage).</p>
                      </div>
                    )}

                    {error && (
                      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm text-red-100">
                        {error}
                      </div>
                    )}

                    <div className="grid grid-cols-[1fr_auto] gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className={[
                          "h-11 rounded-2xl font-semibold text-[16px]",
                          "bg-gradient-to-b from-cyan-300 to-cyan-500 text-[#05202A]",
                          "shadow-[0_14px_40px_rgba(34,211,238,0.20)]",
                          "hover:brightness-105 active:brightness-95",
                          "disabled:opacity-60 disabled:cursor-not-allowed",
                        ].join(" ")}
                      >
                        {saving ? "Saving…" : storedUser && storedPass ? "Login" : "Save & Login"}
                      </button>

                      <button
                        type="button"
                        onClick={handleClear}
                        className={[
                          "h-11 px-5 rounded-2xl text-[15px] font-semibold",
                          "bg-white/10 text-white/85 border border-white/18",
                          "hover:bg-white/15",
                        ].join(" ")}
                      >
                        Clear
                      </button>
                    </div>

                    <div className="pt-2 text-[12px] leading-relaxed text-white/45">
                      {storedUser && storedPass ? (
                        <>Existing login is set on server. Enter the correct username/password to continue.</>
                      ) : (
                        <>No login found on server. First login will be saved as admin credentials.</>
                      )}
                    </div>

                    {/* tiny debug (optional, harmless) */}
                    <div className="text-[11px] text-white/35">
                      Web Device ID: <b className="text-white/55">{getOrCreateWebDeviceId()}</b>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}