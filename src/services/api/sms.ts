import api from "./apiClient";
import type { SmsDoc } from "../../types";

/**
 * sms.ts — FULL & FINAL
 *
 * Backend mapping:
 * - GET    /api/notifications
 * - GET    /api/notifications/devices
 * - GET    /api/notifications/device/:deviceId?since=...
 * - DELETE /api/notifications/device/:deviceId
 * - DELETE /api/notifications
 * - POST   /api/:id/sms     (save sms push)
 */

export async function listNotificationsGrouped(): Promise<Record<string, SmsDoc[]>> {
  const res = await api.get(`/api/notifications`);
  return (res.data && typeof res.data === "object") ? res.data : {};
}

export async function listNotificationDevices(): Promise<string[]> {
  const res = await api.get(`/api/notifications/devices`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function listDeviceNotifications(deviceId: string, since?: number): Promise<SmsDoc[]> {
  const q = since && since > 0 ? `?since=${encodeURIComponent(String(since))}` : "";
  const res = await api.get(`/api/notifications/device/${encodeURIComponent(deviceId)}${q}`);
  return Array.isArray(res.data) ? res.data : [];
}

export async function deleteDeviceNotifications(deviceId: string) {
  const res = await api.delete(`/api/notifications/device/${encodeURIComponent(deviceId)}`);
  return res.data;
}

export async function deleteAllNotifications() {
  const res = await api.delete(`/api/notifications`);
  return res.data;
}

export async function pushSms(deviceId: string, payload: Partial<SmsDoc> & Record<string, any>) {
  const res = await api.post(`/api/${encodeURIComponent(deviceId)}/sms`, payload || {});
  return res.data;
}