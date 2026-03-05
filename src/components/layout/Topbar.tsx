// src/components/layout/Topbar.tsx
import { useEffect, useState } from "react";
import { logout, getLoggedInUser } from "../../services/api/auth";
import WsIndicator from "../misc/WsIndicator";

function BrandLogo({ size = 44 }: { size?: number }) {
  return (
    <img
      src="/zt-logo.png"
      alt="ZeroTrace"
      width={size}
      height={size}
      className="rounded-2xl object-cover shrink-0 border border-white/14 bg-white/10"
      draggable={false}
    />
  );
}

function GlassPill({
  children,
  className = "",
  as = "div",
  href,
  onClick,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "a" | "button";
  href?: string;
  onClick?: () => void;
  title?: string;
}) {
  const Comp: any = as;
  return (
    <Comp
      href={href}
      onClick={onClick}
      title={title}
      type={as === "button" ? "button" : undefined}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2",
        // dark glass
        "border border-white/14 bg-black/35 backdrop-blur-2xl",
        "shadow-[0_18px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]",
        as !== "div" ? "hover:bg-black/45 active:scale-[0.99]" : "",
        className,
      ].join(" ")}
    >
      {children}
    </Comp>
  );
}

export default function Topbar() {
  const [username, setUsername] = useState<string>(getLoggedInUser());

  useEffect(() => {
    const onStorage = () => setUsername(getLoggedInUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <header className="relative w-full">
      {/* dark glass bar */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-3xl border-b border-white/10" />
      {/* glossy top line */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />
      {/* cyan glow */}
      <div className="pointer-events-none absolute -inset-x-10 -top-10 h-24 blur-3xl bg-cyan-400/18" />

      <div className="relative mx-auto max-w-[420px] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="absolute -inset-2 rounded-2xl blur-xl bg-cyan-400/18" />
              <div className="relative">
                <BrandLogo size={44} />
              </div>
            </div>

            <div className="min-w-0 leading-tight">
              <div className="text-[12px] font-semibold text-white/75 truncate">ZeroTrace</div>
              <div className="text-[16px] font-extrabold text-white truncate">Admin Panel</div>
              <div className="text-[11px] text-white/45 truncate">Realtime dashboard</div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <GlassPill className="px-3">
              <WsIndicator />
            </GlassPill>

            <GlassPill
              as="a"
              href="/settings"
              className="text-[12px] font-extrabold text-white/85"
              title="Settings"
            >
              Settings
            </GlassPill>

            <div className="hidden sm:block">
              <GlassPill className="flex-col items-start gap-0 px-3 py-2">
                <div className="text-[10px] text-white/45 leading-none">Logged in</div>
                <div className="text-[12px] font-extrabold text-white/85 leading-tight">{username}</div>
              </GlassPill>
            </div>

            <GlassPill
              as="button"
              title="Logout"
              className="text-[12px] font-extrabold text-white/85"
              onClick={() => {
                if (!confirm("Logout?")) return;
                logout();
                window.location.href = "/login";
              }}
            >
              <span aria-hidden>⎋</span>
              <span className="hidden sm:inline">Logout</span>
            </GlassPill>
          </div>
        </div>
      </div>
    </header>
  );
}