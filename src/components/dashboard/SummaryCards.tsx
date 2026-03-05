import { Card, CardBody } from "../ui/Card";

/**
 * SummaryCards.tsx — FULL & FINAL (UPDATED)
 *
 * Fixes:
 * - Uses named exports from ui/Card.tsx (Card, CardBody)
 * - Removes unused React import (React 17+ JSX transform)
 */

export default function SummaryCards({
  total,
  online,
  offline,
  forms,
}: {
  total: number;
  online: number;
  offline: number;
  forms: number | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardBody>
          <div className="text-xs text-gray-500">Total Devices</div>
          <div className="text-2xl font-bold">{total}</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="text-xs text-gray-500">Online</div>
          <div className="text-2xl font-bold text-green-600">{online}</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="text-xs text-gray-500">Offline</div>
          <div className="text-2xl font-bold text-red-600">{offline}</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="text-xs text-gray-500">All Form Submits</div>
          <div className="text-2xl font-bold">{forms == null ? "…" : forms}</div>
        </CardBody>
      </Card>
    </div>
  );
}