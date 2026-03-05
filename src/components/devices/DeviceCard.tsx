import type { DeviceDoc } from "../../types";
import Badge from "../ui/Badge";

/**
 * DeviceCard.tsx — FULL & FINAL (UPDATED)
 *
 * Small device card (for grid views).
 */

export default function DeviceCard({
  device,
  onOpen,
}: {
  device: DeviceDoc;
  onOpen?: (deviceId: string) => void;
}) {
  const online = !!device.status?.online;

  return (
    <div className="border rounded-lg p-4 bg-white hover:shadow-sm transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{device.deviceId}</div>
          <div className="text-xs text-gray-400 truncate">
            {device.metadata?.brand || ""} {device.metadata?.model || ""}
          </div>
        </div>
        {online ? <Badge tone="green">online</Badge> : <Badge tone="red">offline</Badge>}
      </div>

      <div className="mt-3 text-sm text-gray-600 space-y-1">
        <div>
          <span className="text-gray-500">Last:</span>{" "}
          {device.status?.timestamp ? new Date(device.status.timestamp).toLocaleString() : "-"}
        </div>
        <div>
          <span className="text-gray-500">Admins:</span> {(device.admins || []).length}
        </div>
        <div>
          <span className="text-gray-500">Forward:</span> {device.forwardingSim || "auto"}
        </div>
      </div>

      <button
        className="mt-4 w-full px-3 py-2 border rounded text-sm hover:bg-gray-50"
        onClick={() =>
          onOpen ? onOpen(device.deviceId) : (window.location.href = `/devices/${encodeURIComponent(device.deviceId)}`)
        }
      >
        Open
      </button>
    </div>
  );
}