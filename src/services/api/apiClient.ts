// src/services/api/apiClient.ts
import axios from "axios";
import type { AxiosInstance } from "axios";
import { ENV, getApiKey } from "../../config/constants";
import { getLoggedInUser, isLoggedIn, logout } from "./auth";

/**
 * apiClient.ts — UPDATED (Option A)
 *
 * Adds:
 * - x-api-key (existing)
 * - x-admin + x-device-id (for server-enforced sessions)
 * - response interceptor: if 401 session_expired/unauthorized -> logout + redirect /login
 */

function getOrCreateWebDeviceId(): string {
  const KEY = "zerotrace_web_device_id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.trim()) return existing.trim();

    const counterKey = "zerotrace_web_device_counter";
    const nRaw = localStorage.getItem(counterKey);
    const n = Math.max(1, Number(nRaw || "1") || 1);
    const id = `device${n}`;

    localStorage.setItem(KEY, id);
    localStorage.setItem(counterKey, String(n + 1));

    return id;
  } catch {
    return `device${Math.floor(Math.random() * 10000)}`;
  }
}

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: ENV.API_BASE,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use((config) => {
    // api key
    const key = getApiKey();
    if (key) {
      config.headers = config.headers || {};
      (config.headers as any)["x-api-key"] = key;
    }

    // ✅ admin session headers (only when logged in)
    try {
      if (isLoggedIn()) {
        const admin = getLoggedInUser();
        const deviceId = getOrCreateWebDeviceId();

        config.headers = config.headers || {};
        (config.headers as any)["x-admin"] = admin;
        (config.headers as any)["x-device-id"] = deviceId;
      }
    } catch {
      // ignore
    }

    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      try {
        const status = err?.response?.status;
        const data = err?.response?.data;
        const code = (data && (data.error || data.code)) ? String(data.error || data.code) : "";

        // If server enforces session and it was removed (logout device/all)
        const isSessionExpired =
          status === 401 && (code === "session_expired" || code === "unauthorized" || code === "unauthenticated");

        if (isSessionExpired) {
          try {
            logout();
          } catch {}

          // avoid redirect loop if already on login
          try {
            const p = window.location.pathname || "";
            if (!p.startsWith("/login")) {
              window.location.href = "/login";
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }

      return Promise.reject(err);
    }
  );

  return client;
}

const api = createClient();
export default api;