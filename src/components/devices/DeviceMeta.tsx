import type { DeviceDoc } from "../../types";

/**
 * DeviceMeta.tsx — FULL & FINAL (UPDATED)
 *
 * Fix:
 * - Removed unused React import (new JSX transform)
 *
 * Shows key metadata fields in a clean grid.
 */

export default function DeviceMeta({ device }: { device: DeviceDoc }) {
  const m = device.metadata || {};
  const s = device.status || { online: false };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Device ID</div>
        <div className="font-medium">{device.deviceId}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Online</div>
        <div className="font-medium">{String(!!s.online)}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Last Seen</div>
        <div className="font-medium">{s.timestamp ? new Date(s.timestamp).toLocaleString() : "-"}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Forwarding</div>
        <div className="font-medium">{device.forwardingSim || "auto"}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Brand</div>
        <div className="font-medium">{String(m.brand || "-")}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Model</div>
        <div className="font-medium">{String(m.model || "-")}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Manufacturer</div>
        <div className="font-medium">{String(m.manufacturer || "-")}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-xs text-gray-500">Android</div>
        <div className="font-medium">{String(m.androidVersion || "-")}</div>
      </div>
    </div>
  );
}