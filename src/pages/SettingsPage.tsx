import { useEffect, useMemo, useState } from "react";
import { getGlobalPhone, setGlobalPhone } from "../services/api/admin";
import { ENV, STORAGE_KEYS } from "../config/constants";

/**
 * SettingsPage.tsx — FULL & FINAL (UPDATED)
 *
 * Fix:
 * - Removed unused React default import
 * - Removed explicit return type JSX.Element to avoid "Cannot find namespace JSX"
 */

function safeTrim(v: any) {
  return (v ?? "").toString().trim();
}

function normalizePhone(raw: string) {
  const s = safeTrim(raw);
  if (!s) return "";
  const keepPlus = s.startsWith("+");
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return keepPlus ? `+${digits}` : digits;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // backend
  const [globalPhone, setGlobalPhoneVal] = useState("");

  // local
  const [apiKey, setApiKey] = useState(localStorage.getItem(STORAGE_KEYS.API_KEY) || "");
  const [licenseExpiry, setLicenseExpiry] = useState(
    localStorage.getItem(STORAGE_KEYS.LICENSE_EXPIRY) || ENV.LICENSE_EXPIRY || ""
  );
  const [whatsAppPhone, setWhatsAppPhone] = useState(
    localStorage.getItem(STORAGE_KEYS.WHATSAPP_PHONE) || ENV.WHATSAPP_PHONE || ""
  );

  const effectiveApiKey = useMemo(() => (ENV.API_KEY ? "(env locked)" : apiKey || "(not set)"), [apiKey]);

  async function loadPhone() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const phone = await getGlobalPhone();
      setGlobalPhoneVal(phone || "");
    } catch (e) {
      console.error("load globalPhone failed", e);
      setError("Failed to load Global Phone (check backend / CORS / API key).");
    } finally {
      setLoading(false);
    }
  }

  async function savePhone() {
    setSavingPhone(true);
    setError(null);
    setOkMsg(null);
    try {
      await setGlobalPhone(safeTrim(globalPhone));
      setOkMsg("Global phone saved.");
    } catch (e: any) {
      console.error("save globalPhone failed", e);
      setError(e?.response?.data?.error || "Failed to save global phone.");
    } finally {
      setSavingPhone(false);
    }
  }

  function saveLocalSettings() {
    setError(null);
    setOkMsg(null);
    try {
      const cleanKey = safeTrim(apiKey);
      if (cleanKey) localStorage.setItem(STORAGE_KEYS.API_KEY, cleanKey);
      else localStorage.removeItem(STORAGE_KEYS.API_KEY);

      const cleanExpiry = safeTrim(licenseExpiry);
      if (cleanExpiry) localStorage.setItem(STORAGE_KEYS.LICENSE_EXPIRY, cleanExpiry);
      else localStorage.removeItem(STORAGE_KEYS.LICENSE_EXPIRY);

      const cleanWa = normalizePhone(whatsAppPhone);
      if (cleanWa) localStorage.setItem(STORAGE_KEYS.WHATSAPP_PHONE, cleanWa);
      else localStorage.removeItem(STORAGE_KEYS.WHATSAPP_PHONE);

      setOkMsg("Local settings saved.");
    } catch {
      setError("Failed to save local settings (storage blocked?).");
    }
  }

  function clearLocalSettings() {
    setError(null);
    setOkMsg(null);
    try {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      localStorage.removeItem(STORAGE_KEYS.LICENSE_EXPIRY);
      localStorage.removeItem(STORAGE_KEYS.WHATSAPP_PHONE);

      setApiKey("");
      setLicenseExpiry(ENV.LICENSE_EXPIRY || "");
      setWhatsAppPhone(ENV.WHATSAPP_PHONE || "");

      setOkMsg("Local settings cleared.");
    } catch {
      setError("Failed to clear local settings.");
    }
  }

  async function testBackend() {
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(`${ENV.API_BASE}/healthz`);
      const json = await res.json();
      if (json && json.ok) setOkMsg("Backend OK ✅ (/healthz).");
      else setOkMsg("Backend responded but format different.");
    } catch (e) {
      console.error("test backend failed", e);
      setError("Backend test failed. Check API base, backend running, CORS, API key.");
    }
  }

  useEffect(() => {
    loadPhone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between py-4">
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-gray-500">Admin phone, API key and UI settings</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={testBackend} className="px-3 py-1 border rounded">
            Test Backend
          </button>
          <button onClick={loadPhone} className="px-3 py-1 border rounded">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow p-6">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global phone (backend) */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold mb-2">Global Admin Phone (Backend)</h3>
            <p className="text-sm text-gray-500 mb-4">
              Used for dashboard renew WhatsApp button and global admin updates.
            </p>

            <label className="block text-sm text-gray-700 mb-1">Phone</label>
            <input
              value={globalPhone}
              onChange={(e) => setGlobalPhoneVal(e.target.value)}
              placeholder="+919876543210"
              className="w-full border rounded p-2"
            />

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={savePhone}
                disabled={savingPhone}
                className="px-4 py-2 bg-[var(--brand)] text-white rounded-md disabled:opacity-60"
              >
                {savingPhone ? "Saving…" : "Save"}
              </button>

              <button
                onClick={() => setGlobalPhoneVal("")}
                className="px-4 py-2 border rounded-md"
                title="Clear field only"
              >
                Clear Field
              </button>

              <button
                onClick={async () => {
                  if (!confirm("Erase global phone on backend (set empty)?")) return;
                  setGlobalPhoneVal("");
                  await setGlobalPhone("");
                  setOkMsg("Global phone erased.");
                }}
                className="px-4 py-2 border rounded-md text-red-600"
              >
                Erase on Server
              </button>
            </div>
          </div>

          {/* Local settings */}
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="font-semibold mb-2">Local Settings (Browser)</h3>
            <p className="text-sm text-gray-500 mb-4">
              These are saved in browser storage. Env values (VITE_*) override where applicable.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">API Key</label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="x-api-key (optional)"
                  className="w-full border rounded p-2"
                  disabled={!!ENV.API_KEY}
                />
                <div className="text-xs text-gray-400 mt-1">Effective: {effectiveApiKey}</div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">License Expiry (YYYY-MM-DD)</label>
                <input
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  placeholder="2026-12-31"
                  className="w-full border rounded p-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">WhatsApp Phone Override</label>
                <input
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  placeholder="+911234567890"
                  className="w-full border rounded p-2"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button onClick={saveLocalSettings} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md">
                  Save Local
                </button>
                <button onClick={clearLocalSettings} className="px-4 py-2 border rounded-md">
                  Clear Local
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(error || okMsg) && (
        <div className="mt-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {okMsg && <div className="text-sm text-green-700">{okMsg}</div>}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400">
        API Base: <span className="font-mono">{ENV.API_BASE || "(missing VITE_API_BASE)"}</span>
      </div>
    </div>
  );
}