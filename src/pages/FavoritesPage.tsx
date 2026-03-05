import { useEffect, useMemo, useState } from "react";
import { getFavoritesMap, setFavorite } from "../services/api/favorites";

/**
 * FavoritesPage.tsx — FULL & FINAL (UPDATED)
 *
 * Fix:
 * - Removed unused React default import
 * - Removed explicit return type JSX.Element to avoid "Cannot find namespace JSX"
 */

export default function FavoritesPage() {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const m = await getFavoritesMap();
      setMap(m || {});
    } catch (e) {
      console.error("load favorites failed", e);
      setError("Failed to load favorites");
      setMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => setRefreshTick((t) => t + 1), 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshTick > 0) load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = Object.entries(map).map(([deviceId, fav]) => ({ deviceId, fav }));
    const filtered = q ? all.filter((e) => e.deviceId.toLowerCase().includes(q)) : all;
    return filtered.sort((a, b) => (a.deviceId > b.deviceId ? 1 : -1));
  }, [map, search]);

  const favCount = useMemo(() => Object.values(map).filter(Boolean).length, [map]);

  async function toggle(deviceId: string) {
    const next = !map[deviceId];
    try {
      await setFavorite(deviceId, next);
      setMap((m) => ({ ...m, [deviceId]: next }));
    } catch (e) {
      console.error("toggle favorite failed", e);
      alert("Failed to update favorite");
    }
  }

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between py-4">
        <div>
          <h2 className="text-xl font-semibold">Favorites</h2>
          <p className="text-sm text-gray-500">Quick access to your favorite devices</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            Total favorites: <span className="font-semibold">{favCount}</span>
          </div>
          <button onClick={() => load()} className="px-3 py-1 border rounded">
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search device id..."
            className="border rounded p-2 w-64"
          />
          <div className="text-sm text-gray-500">Showing {entries.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-gray-400">
            No favorites yet. Mark devices as favorite from Devices or Device detail.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entries.map((e) => (
              <div key={e.deviceId} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                <div className="min-w-0">
                  <a
                    href={`/devices/${encodeURIComponent(e.deviceId)}`}
                    className="font-medium text-sky-600 hover:underline truncate block"
                  >
                    {e.deviceId}
                  </a>
                  <div className="text-xs text-gray-400">favorite: {String(e.fav)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggle(e.deviceId)}
                    className={`px-3 py-1 rounded ${
                      e.fav ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {e.fav ? "★ Unfavorite" : "☆ Favorite"}
                  </button>

                  <button
                    onClick={() => (window.location.href = `/devices/${encodeURIComponent(e.deviceId)}`)}
                    className="px-3 py-1 border rounded"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
    </div>
  );
}