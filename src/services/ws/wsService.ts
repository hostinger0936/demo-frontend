import { ENV } from "../../config/constants";

/**
 * wsService.ts — FULL & FINAL (UPDATED)
 *
 * Fix:
 * - onMessage() cleanup returns void (OK)
 * - connect() guarded + clears reconnect timer when needed
 * - ✅ sendSms dedupe: prevents duplicate SMS sends within a short window
 */

type WsMsg = Record<string, any>;
type Handler = (msg: WsMsg) => void;

class WsService {
  private ws: WebSocket | null = null;
  private handlers: Set<Handler> = new Set();
  private reconnectTimer: number | null = null;
  private shouldStop = false;
  private connected = false;

  // prevents rapid duplicate sendSms (common in reconnect/strictmode/double-submit edge cases)
  private lastSmsKey: string | null = null;
  private lastSmsAt = 0;

  private buildWsUrl(): string {
    try {
      const base = ENV.API_BASE || window.location.origin;
      const u = new URL(base);
      const proto = u.protocol === "https:" ? "wss" : "ws";
      const path = ENV.WS_ADMIN_PATH.startsWith("/") ? ENV.WS_ADMIN_PATH : `/${ENV.WS_ADMIN_PATH}`;
      return `${proto}://${u.host}${path}`;
    } catch {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const path = ENV.WS_ADMIN_PATH.startsWith("/") ? ENV.WS_ADMIN_PATH : `/${ENV.WS_ADMIN_PATH}`;
      return `${proto}://${window.location.host}${path}`;
    }
  }

  private emitStatus(connected: boolean) {
    try {
      window.dispatchEvent(new CustomEvent("zerotrace:ws", { detail: { connected } }));
    } catch {
      // ignore
    }
  }

  isConnected(): boolean {
    return this.connected === true && this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    // ✅ if a reconnect timer exists, do not stack more connects
    if (this.reconnectTimer) {
      // we still allow current connect attempt to proceed; timer will be cleared on open
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldStop = false;

    const url = this.buildWsUrl();
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.emitStatus(true);

      // ✅ once connected, clear any pending reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      try {
        this.ws?.send(JSON.stringify({ type: "ping" }));
      } catch {}
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.emitStatus(false);
      if (!this.shouldStop) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.connected = false;
      this.emitStatus(false);
      try {
        this.ws?.close();
      } catch {}
    };

    this.ws.onmessage = (ev) => {
      const txt = String(ev.data || "");

      let msg: WsMsg;
      try {
        msg = JSON.parse(txt) as WsMsg;
      } catch {
        msg = { type: "raw", data: txt };
      }

      for (const h of this.handlers) {
        try {
          h(msg);
        } catch {
          // ignore handler errors
        }
      }
    };
  }

  disconnect() {
    this.shouldStop = true;
    this.connected = false;
    this.emitStatus(false);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldStop) this.connect();
    }, 3000);
  }

  onMessage(handler: Handler) {
    this.handlers.add(handler);

    // ✅ IMPORTANT: cleanup returns void
    return () => {
      this.handlers.delete(handler);
    };
  }

  send(payload: WsMsg): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  // ✅ Dedupe sendSms within 1200ms (same device+to+message+sim)
  private shouldDropDuplicateSendSms(name: string, payload: Record<string, any>): boolean {
    if (name !== "sendSms") return false;

    const p = payload || {};
    const to = String(p.address ?? p.to ?? "").trim();
    const msg = String(p.message ?? p.body ?? "").trim();
    const sim = String(p.sim ?? "").trim();
    const uid = String(p.uniqueid ?? p.deviceId ?? "").trim();

    if (!to || !msg || !uid) return false;

    const key = `${uid}::${sim}::${to}::${msg}`;
    const now = Date.now();

    // 1.2 seconds window
    if (this.lastSmsKey === key && now - this.lastSmsAt < 1200) {
      return true;
    }

    this.lastSmsKey = key;
    this.lastSmsAt = now;
    return false;
  }

  sendCmd(name: string, payload: Record<string, any> = {}): boolean {
    if (this.shouldDropDuplicateSendSms(name, payload)) {
      // treat as "sent" to avoid UI retry loops
      return true;
    }
    return this.send({ type: "cmd", name, payload });
  }
}

const wsService = new WsService();
export default wsService;