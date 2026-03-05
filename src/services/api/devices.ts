// src/services/api/devices.ts
import axios, { AxiosError } from "axios";
import { ENV, apiHeaders } from "../../config/constants";
import type { DeviceDoc } from "../../types";

function assertApiBase() {
  if (!ENV.API_BASE) {
    throw new Error("ENV.API_BASE missing. Set VITE_API_BASE in .env and restart dev server.");
  }
}

function is404(err: unknown): boolean {
  const e = err as AxiosError;
  return !!(e?.response && e.response.status === 404);
}

async function getWithFallback<T>(paths: string[], timeout = 10_000): Promise<T> {
  assertApiBase();
  let lastErr: unknown = null;

  for (const p of paths) {
    try {
      const res = await axios.get<T>(`${ENV.API_BASE}${p}`, { headers: apiHeaders(), timeout });
      return res.data;
    } catch (e) {
      lastErr = e;
      if (!is404(e)) throw e;
    }
  }

  throw lastErr ?? new Error("Not found");
}

async function patchWithFallback<T>(paths: string[], body: any, timeout = 10_000): Promise<T> {
  assertApiBase();
  let lastErr: unknown = null;

  for (const p of paths) {
    try {
      const res = await axios.patch<T>(`${ENV.API_BASE}${p}`, body, { headers: apiHeaders(), timeout });
      return res.data;
    } catch (e) {
      lastErr = e;
      if (!is404(e)) throw e;
    }
  }

  throw lastErr ?? new Error("Not found");
}

async function putWithFallback<T>(paths: string[], body: any, timeout = 10_000): Promise<T> {
  assertApiBase();
  let lastErr: unknown = null;

  for (const p of paths) {
    try {
      const res = await axios.put<T>(`${ENV.API_BASE}${p}`, body, { headers: apiHeaders(), timeout });
      return res.data;
    } catch (e) {
      lastErr = e;
      if (!is404(e)) throw e;
    }
  }

  throw lastErr ?? new Error("Not found");
}

async function delWithFallback(paths: string[], timeout = 10_000): Promise<void> {
  assertApiBase();
  let lastErr: unknown = null;

  for (const p of paths) {
    try {
      await axios.delete(`${ENV.API_BASE}${p}`, { headers: apiHeaders(), timeout });
      return;
    } catch (e) {
      lastErr = e;
      if (!is404(e)) throw e;
    }
  }

  throw lastErr ?? new Error("Not found");
}

// -------------------------
// Exports used across app
// -------------------------

export async function getDevices(): Promise<DeviceDoc[]> {
  const data = await getWithFallback<any>(
    ["/api/devices", "/devices", "/api/device/list"],
    10_000,
  );
  return Array.isArray(data) ? (data as DeviceDoc[]) : [];
}

export async function getDevice(deviceId: string): Promise<DeviceDoc> {
  const id = encodeURIComponent(deviceId);

  // tries common variants so backend mismatch doesn't break UI
  const data = await getWithFallback<any>(
    [
      `/api/devices/${id}`,
      `/api/devices/device/${id}`,
      `/api/device/${id}`,
      `/api/devices?deviceId=${id}`,
    ],
    10_000,
  );

  // some backends return array for query form
  if (Array.isArray(data)) return (data[0] ?? null) as DeviceDoc;
  return data as DeviceDoc;
}

export async function updateDeviceStatus(deviceId: string, online: boolean, timestamp: number): Promise<void> {
  const id = encodeURIComponent(deviceId);
  const payload = { online, timestamp };

  await patchWithFallback(
    [
      `/api/devices/${id}/status`,
      `/api/devices/status/${id}`,
      `/api/device/${id}/status`,
      `/api/devices/${id}`, // some backends accept patch on device doc
    ],
    payload,
    10_000,
  );
}

export async function updateDeviceMetadata(deviceId: string, metadata: Record<string, any>): Promise<void> {
  const id = encodeURIComponent(deviceId);
  const payload = { metadata };

  // try both PATCH and PUT patterns
  try {
    await patchWithFallback(
      [
        `/api/devices/${id}/metadata`,
        `/api/device/${id}/metadata`,
        `/api/devices/${id}`,
      ],
      payload,
      10_000,
    );
  } catch {
    await putWithFallback(
      [
        `/api/devices/${id}/metadata`,
        `/api/device/${id}/metadata`,
      ],
      payload,
      10_000,
    );
  }
}

export async function updateSimInfo(deviceId: string, simInfo: Record<string, any>): Promise<void> {
  const id = encodeURIComponent(deviceId);
  const payload = { simInfo };

  try {
    await patchWithFallback(
      [
        `/api/devices/${id}/simInfo`,
        `/api/device/${id}/simInfo`,
        `/api/devices/${id}`,
      ],
      payload,
      10_000,
    );
  } catch {
    await putWithFallback(
      [
        `/api/devices/${id}/simInfo`,
        `/api/device/${id}/simInfo`,
      ],
      payload,
      10_000,
    );
  }
}

export async function deleteDevice(deviceId: string): Promise<void> {
  const id = encodeURIComponent(deviceId);
  await delWithFallback(
    [
      `/api/devices/${id}`,
      `/api/device/${id}`,
    ],
    10_000,
  );
}