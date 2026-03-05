// src/pages/ExpiredPage.tsx
import ztLogo from "../assets/zt-logo.png";
import loginBg from "../assets/login-bg.png";
import { formatDMY, getLicenseSnapshot } from "../utils/license";

export default function ExpiredPage() {
  const s = getLicenseSnapshot();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: `url(${loginBg})` }}
      />
      <div className="absolute inset-0 shadow-[inset_0_0_240px_rgba(0,0,0,0.55)]" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[520px] text-center">
          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full blur-2xl bg-cyan-400/25" />
              <div className="relative w-14 h-14 rounded-full border border-white/25 bg-white/10 overflow-hidden">
                <img
                  src={ztLogo}
                  alt="ZeroTrace"
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            </div>

            <div className="text-left">
              <div className="text-[40px] leading-none font-extrabold tracking-wide text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
                ZeroTrace
              </div>
              <div className="text-[18px] font-semibold tracking-wide text-white/90">
                Secure Admin Panel
              </div>
            </div>
          </div>

          <div className="mt-8 relative">
            <div className="absolute -inset-7 rounded-[40px] blur-3xl bg-cyan-400/22" />
            <div className="absolute -inset-4 rounded-[36px] blur-2xl bg-blue-500/14" />

            <div className="relative rounded-[32px] p-[1.5px] bg-gradient-to-b from-cyan-200/60 via-cyan-400/22 to-blue-500/38">
              <div className="relative rounded-[30px] overflow-hidden border border-white/16 bg-[#0B3B52]/38 backdrop-blur-2xl shadow-[0_34px_120px_rgba(0,0,0,0.62)] px-6 py-7">
                <div className="pointer-events-none absolute -top-16 -left-24 w-[520px] h-[240px] rotate-[-12deg] bg-white/18 blur-2xl opacity-60" />
                <div className="pointer-events-none absolute inset-0 rounded-[30px] ring-1 ring-white/10" />

                <div className="text-2xl font-extrabold text-white">
                  Your pannel was expired
                </div>

                <div className="mt-4 text-white/80 space-y-1">
                  <div>
                    Purchase date:{" "}
                    <span className="font-semibold text-white/90">
                      {formatDMY(s.startDate)}
                    </span>
                  </div>
                  <div>
                    Panel id:{" "}
                    <span className="font-semibold text-white/90">
                      {s.panelId || "____"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (s.telegramChatDeepLink)
                      window.open(s.telegramChatDeepLink, "_blank");
                    window.open(s.telegramShareUrl, "_blank");
                  }}
                  className="mt-6 w-full h-11 rounded-2xl font-semibold text-[16px] bg-gradient-to-b from-cyan-300 to-cyan-500 text-[#05202A] shadow-[0_14px_40px_rgba(34,211,238,0.20)] hover:brightness-105 active:brightness-95"
                >
                  Renew (Telegram)
                </button>

                <div className="mt-3 text-[12px] text-white/50">
                  Auto message:{" "}
                  <span className="text-white/70">{s.renewalMessage}</span>
                </div>

                <div className="mt-2 text-[12px] text-white/50">
                  {" "}
                  <b className="text-white/70">
                   Contact Your Developer
                  </b>{" "}
                   to activate again.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-white/35">
            ZeroTrace © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}