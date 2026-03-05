// src/services/api/admin.ts
import api from "./apiClient";
import type { AdminSessionDoc } from "../../types";

/**
 * admin.ts — UPDATED
 *
 * Admin login/global:
 * - GET  /admin/login
 * - PUT  /admin/login
 * - GET  /admin/globalPhone
 * - PUT  /admin/globalPhone
 *
 * Sessions (backend router):
 * - POST   /api/admin/session/create
 * - POST   /api/admin/session/ping
 * - GET    /api/admin/sessions
 * - DELETE /api/admin/sessions/:deviceId
 * - DELETE /api/admin/sessions
 * Fallbacks:
 * - POST /api/admin/sessions/:deviceId/logout
 * - POST /api/admin/sessions/logout-all
 */

export async function getAdminLogin(): Promise<{ username: string; password: string }> {
  const res = await api.get(`/admin/login`);
  return {
    username: res.data?.username || "",
    password: res.data?.password || "",
  };
}

export async function saveAdminLogin(username: string, password: string) {
  const res = await api.put(`/admin/login`, { username, password });
  return res.data;
}

export async function getGlobalPhone(): Promise<string> {
  const res = await api.get(`/admin/globalPhone`);
  const data = res.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "phone" in data) return (data as any).phone || "";
  return "";
}

export async function setGlobalPhone(phone: string) {
  const res = await api.put(`/admin/globalPhone`, { phone });
  return res.data;
}

/**
 * Create/Upsert admin session (web + android both).
 * Backend requires BOTH admin + deviceId.
 */
export async function createAdminSession(admin: string, deviceId: string) {
  const res = await api.post(`/api/admin/session/create`, { admin, deviceId });
  return res.data;
}

/**
 * Ping keeps lastSeen fresh.
 */
export async function pingAdminSession(admin: string, deviceId: string) {
  const res = await api.post(`/api/admin/session/ping`, { admin, deviceId });
  return res.data;
}

export async function listSessions(): Promise<AdminSessionDoc[]> {
  const res = await api.get(`/api/admin/sessions`);
  const data = res.data;

  // support a few shapes just in case
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray((data as any).sessions)) return (data as any).sessions;
    if (Array.isArray((data as any).data)) return (data as any).data;
    if (Array.isArray((data as any).items)) return (data as any).items;
  }

  return [];
}

export async function logoutDevice(deviceId: string) {
  // primary delete
  try {
    const res = await api.delete(`/api/admin/sessions/${encodeURIComponent(deviceId)}`);
    return res.data;
  } catch {
    // fallback post
    const res = await api.post(`/api/admin/sessions/${encodeURIComponent(deviceId)}/logout`, {});
    return res.data;
  }
}

export async function logoutAll() {
  try {
    const res = await api.delete(`/api/admin/sessions`);
    return res.data;
  } catch {
    const res = await api.post(`/api/admin/sessions/logout-all`, {});
    return res.data;
  }
}