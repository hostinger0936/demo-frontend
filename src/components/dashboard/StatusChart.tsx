import type React from "react";

/**
 * StatusChart.tsx — FULL & FINAL (UPDATED)
 *
 * Fix:
 * - removed unused React value import (keeps JSX typings safe)
 */

export default function StatusChart({
  online,
  offline,
}: {
  online: number;
  offline: number;
}): React.JSX.Element {
  const total = Math.max(1, online + offline);
  const onlinePct = Math.round((online / total) * 100);
  const offlinePct = 100 - onlinePct;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Device Status</div>
        <div className="text-xs text-gray-400">{total} total</div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Online</span>
          <span className="font-medium">
            {online} ({onlinePct}%)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded h-2 overflow-hidden">
          <div className="h-2 bg-green-500" style={{ width: `${onlinePct}%` }} />
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-gray-600">Offline</span>
          <span className="font-medium">
            {offline} ({offlinePct}%)
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded h-2 overflow-hidden">
          <div className="h-2 bg-red-500" style={{ width: `${offlinePct}%` }} />
        </div>
      </div>
    </div>
  );
}