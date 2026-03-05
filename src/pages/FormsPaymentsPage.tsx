import { useEffect, useMemo, useState } from "react";
import type { FormSubmissionDoc } from "../types";
import { listFormSubmissions, deleteFormSubmission } from "../services/api/forms";
import { getCardPaymentsByDevice, getNetbankingByDevice } from "../services/api/payments";

/**
 * FormsPaymentsPage.tsx — FULL & FINAL (UPDATED)
 *
 * Fix:
 * - Removed unused React default import
 * - Removed explicit return type JSX.Element to avoid "Cannot find namespace JSX"
 */

export default function FormsPaymentsPage() {
  const [forms, setForms] = useState<FormSubmissionDoc[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<Record<string, any> | null>(null);

  const [cardPayments, setCardPayments] = useState<any[] | null>(null);
  const [netbankingPayments, setNetbankingPayments] = useState<any[] | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [filterQ, setFilterQ] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  async function loadForms() {
    setLoadingForms(true);
    setError(null);
    try {
      const list = await listFormSubmissions();
      const normalized = (list || []).map((d: any) => ({
        ...d,
        uniqueid: d.uniqueid || (d.payload && d.payload.uniqueid) || "",
        payload: d.payload || {},
      }));
      setForms(normalized);
    } catch (e) {
      console.error("loadForms failed", e);
      setError("Failed to load form submissions");
      setForms([]);
    } finally {
      setLoadingForms(false);
    }
  }

  async function loadPaymentsFor(uniqueid: string) {
    setLoadingPayments(true);
    setCardPayments(null);
    setNetbankingPayments(null);
    try {
      const [c, n] = await Promise.all([
        getCardPaymentsByDevice(uniqueid).catch(() => []),
        getNetbankingByDevice(uniqueid).catch(() => []),
      ]);
      setCardPayments(c);
      setNetbankingPayments(n);
    } finally {
      setLoadingPayments(false);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of forms) {
      const id = (f as any).uniqueid || "unknown";
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [forms]);

  const visibleGroupedEntries = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    const entries = Object.entries(grouped);
    if (!q) return entries.sort((a, b) => b[1] - a[1]);

    return entries
      .filter(([id]) => id.toLowerCase().includes(q))
      .sort((a, b) => b[1] - a[1]);
  }, [grouped, filterQ]);

  async function handleSelect(uniqueid: string | null) {
    if (!uniqueid) {
      setSelectedId(null);
      setSelectedPayload(null);
      setCardPayments(null);
      setNetbankingPayments(null);
      return;
    }
    setSelectedId(uniqueid);

    const docs = forms
      .filter((f: any) => (f.uniqueid || "") === uniqueid)
      .sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });

    const latest = docs[0] || null;
    setSelectedPayload((latest as any)?.payload || {});

    await loadPaymentsFor(uniqueid);
  }

  async function handleDeleteAllFor(uniqueid: string) {
    if (!confirm(`Delete ALL form submissions for ${uniqueid}?`)) return;
    try {
      await deleteFormSubmission(uniqueid);
      alert("Deleted");
      await loadForms();
      await handleSelect(null);
    } catch (e) {
      console.error("delete failed", e);
      alert("Failed to delete submissions");
    }
  }

  useEffect(() => {
    loadForms();
    const id = setInterval(() => setRefreshTick((t) => t + 1), 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (refreshTick > 0) loadForms().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  const selectedDocs = useMemo(() => {
    if (!selectedId) return [];
    return forms
      .filter((f: any) => (f.uniqueid || "") === selectedId)
      .sort((a: any, b: any) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
  }, [forms, selectedId]);

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between py-4">
        <div>
          <h2 className="text-xl font-semibold">All Forms & Payments</h2>
          <p className="text-sm text-gray-500">View submissions and related payments</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">
            Forms: <span className="font-semibold">{forms.length}</span>
          </div>
          <button onClick={() => loadForms()} className="px-3 py-1 border rounded">
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <aside className="lg:col-span-1 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">Unique IDs</div>
            <div className="text-xs text-gray-400">{Object.keys(grouped).length}</div>
          </div>

          <div className="mb-3">
            <input
              placeholder="Search uniqueid..."
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              className="w-full border rounded p-2 text-sm"
            />
          </div>

          <div className="max-h-[60vh] overflow-auto space-y-1">
            {loadingForms ? (
              <div className="text-sm text-gray-400">Loading…</div>
            ) : visibleGroupedEntries.length === 0 ? (
              <div className="text-sm text-gray-400">No submissions yet.</div>
            ) : (
              visibleGroupedEntries.map(([id, cnt]) => (
                <div
                  key={id}
                  onClick={() => handleSelect(id)}
                  className={`p-2 rounded cursor-pointer flex items-center justify-between ${
                    selectedId === id ? "bg-[var(--brand)]/10" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{id}</div>
                    <div className="text-xs text-gray-400">{cnt} submits</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="lg:col-span-3 bg-white rounded-lg shadow p-4">
          {!selectedId ? (
            <div className="text-sm text-gray-400 p-4">Select a uniqueid from left to view payload + payments.</div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-medium">UniqueID: {selectedId}</h3>
                  <div className="text-xs text-gray-400">{selectedDocs.length} total submits</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDeleteAllFor(selectedId)} className="px-3 py-1 border rounded text-red-600">
                    Delete All
                  </button>
                  <button onClick={() => handleSelect(null)} className="px-3 py-1 border rounded">
                    Back
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm text-gray-500">Latest Payload</h4>
                <pre className="bg-gray-50 p-3 rounded max-h-56 overflow-auto text-xs">
                  {JSON.stringify(selectedPayload || {}, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Card Payments</div>
                    <div className="text-xs text-gray-400">
                      {cardPayments == null ? (loadingPayments ? "…" : "0") : cardPayments.length}
                    </div>
                  </div>
                  {loadingPayments && cardPayments == null ? (
                    <div className="text-sm text-gray-400">Loading…</div>
                  ) : (cardPayments || []).length === 0 ? (
                    <div className="text-sm text-gray-400">No card payments</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {(cardPayments || []).map((p, idx) => (
                        <pre key={idx} className="p-2 border rounded text-xs bg-gray-50 overflow-auto">
                          {JSON.stringify(p, null, 2)}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Netbanking Payments</div>
                    <div className="text-xs text-gray-400">
                      {netbankingPayments == null ? (loadingPayments ? "…" : "0") : netbankingPayments.length}
                    </div>
                  </div>
                  {loadingPayments && netbankingPayments == null ? (
                    <div className="text-sm text-gray-400">Loading…</div>
                  ) : (netbankingPayments || []).length === 0 ? (
                    <div className="text-sm text-gray-400">No netbanking payments</div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto">
                      {(netbankingPayments || []).map((p, idx) => (
                        <pre key={idx} className="p-2 border rounded text-xs bg-gray-50 overflow-auto">
                          {JSON.stringify(p, null, 2)}
                        </pre>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <h4 className="text-sm text-gray-500 mb-2">All submissions for this uniqueid</h4>
                <div className="space-y-2 max-h-72 overflow-auto">
                  {selectedDocs.map((f: any) => (
                    <div key={f._id || f.createdAt} className="border rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{f.createdAt ? new Date(f.createdAt).toLocaleString() : "—"}</div>
                        <div className="text-xs text-gray-400">{f._id}</div>
                      </div>
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                        {JSON.stringify(f.payload || {}, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </section>
      </div>
    </div>
  );
}