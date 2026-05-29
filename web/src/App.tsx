import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import LoginPage from '@/routes/auth/Login';
import RegisterPage from '@/routes/auth/Register';
import VerifyEmailPage from '@/routes/auth/VerifyEmail';
import DashboardPage from '@/routes/dashboard/Overview';
import DashboardLayout from '@/routes/dashboard/DashboardLayout';
import WorkspaceSettings from '@/routes/dashboard/WorkspaceSettings';
import Members from '@/routes/dashboard/Members';
import AuditLog from '@/routes/dashboard/AuditLog';
import Billing from '@/routes/dashboard/Billing';
import ProfileSecurity from '@/routes/dashboard/ProfileSecurity';

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useSelector((s: RootState) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="workspace/settings" element={<WorkspaceSettings />} />
        <Route path="workspace/members" element={<Members />} />
        <Route path="workspace/audit-log" element={<AuditLog />} />
        <Route path="workspace/billing" element={<Billing />} />
        <Route path="workspace/billing/return" element={<Billing />} />
        <Route path="profile/security" element={<ProfileSecurity />} />
      </Route>

      <Route path="*" element={<div style={{ padding: 24 }}>Page not found</div>} />
    </Routes>
  );
}
