import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import LoginPage from '@/routes/auth/Login';
import RegisterPage from '@/routes/auth/Register';
import VerifyEmailPage from '@/routes/auth/VerifyEmail';
import DashboardPage from '@/routes/dashboard/Overview';
import AppLayout from '@/routes/dashboard/AppLayout';
import WorkspaceSettings from '@/routes/dashboard/WorkspaceSettings';
import Members from '@/routes/dashboard/Members';
import AuditLog from '@/routes/dashboard/AuditLog';
import Billing from '@/routes/dashboard/Billing';
import ProfileSecurity from '@/routes/dashboard/ProfileSecurity';
import SeoKeywords from '@/routes/dashboard/SeoKeywords';
import ContentGenerator from '@/routes/dashboard/ContentGenerator';
import Contacts from '@/routes/dashboard/Contacts';
import Campaigns from '@/routes/dashboard/Campaigns';
import EmailPage from '@/routes/dashboard/Email';
import Social from '@/routes/dashboard/Social';
import Analytics from '@/routes/dashboard/Analytics';
import Media from '@/routes/dashboard/Media';
import InfluencerPage from '@/routes/dashboard/Influencer';
import Intelligence from '@/routes/dashboard/Intelligence';
import ContentLibrary from '@/routes/dashboard/ContentLibrary';
import OneClick from '@/routes/dashboard/OneClick';
import AffiliatePage from '@/routes/dashboard/Affiliate';
import Notifications from '@/routes/dashboard/Notifications';
import Integrations from '@/routes/dashboard/Integrations';
import LocalSeo from '@/routes/dashboard/LocalSeo';
import Messaging from '@/routes/dashboard/Messaging';
import Migration from '@/routes/dashboard/Migration';

function RequireAuth({ children }: { children: JSX.Element }) {
  const user = useSelector((s: RootState) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      {/* Legacy /dashboard/* URLs (bookmarks, old emails) → new /app/* */}
      <Route path="/dashboard/*" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="seo" element={<SeoKeywords />} />
        <Route path="content" element={<ContentGenerator />} />
        <Route path="crm" element={<Contacts />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="email" element={<EmailPage />} />
        <Route path="social" element={<Social />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="media" element={<Media />} />
        <Route path="influencer" element={<InfluencerPage />} />
        <Route path="intelligence" element={<Intelligence />} />
        <Route path="content/library" element={<ContentLibrary />} />
        <Route path="one-click" element={<OneClick />} />
        <Route path="affiliate" element={<AffiliatePage />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="local-seo" element={<LocalSeo />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="migration" element={<Migration />} />
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
