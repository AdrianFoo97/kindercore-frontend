import { Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/common/Navbar.js';
import { ToastProvider } from './components/common/Toast.js';
import { DeleteDialogProvider } from './components/common/DeleteDialog.js';
import LoginPage from './pages/LoginPage.js';
import LeadsPage from './pages/LeadsPage.js';
import ImportLeadsPage from './pages/ImportLeadsPage.js';
import SettingsPage from './pages/SettingsPage.js';
import SalesMarketingPage from './pages/analysis/SalesMarketingPage.js';
import SalesAnalysisPage from './pages/analysis/SalesAnalysisPage.js';
import RevenueAnalysisPage from './pages/analysis/RevenueAnalysisPage.js';
import LandingPage from './pages/LandingPage.js';
import EnquiryFormPage from './pages/EnquiryFormPage.js';
import PackagesPage from './pages/PackagesPage.js';
import PackageSettingsPage from './pages/PackageSettingsPage.js';
import ProgrammesSettingsPage from './pages/ProgrammesSettingsPage.js';
import AgeGroupsSettingsPage from './pages/AgeGroupsSettingsPage.js';
import StudentsPage from './pages/StudentsPage.js';
import OnboardingSettingsPage from './pages/OnboardingSettingsPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import WhatsAppTemplatesPage from './pages/WhatsAppTemplatesPage.js';
import LeadStatusSettingsPage from './pages/LeadStatusSettingsPage.js';
import TestToolsPage from './pages/TestToolsPage.js';
import GoogleCalendarSettingsPage from './pages/GoogleCalendarSettingsPage.js';
import ImportStudentsPage from './pages/ImportStudentsPage.js';
import OperationsPlannerPage from './pages/OperationsPlannerPage.js';
import TimetableSettingsPage from './pages/settings/TimetableSettingsPage.js';
import ManageUsersPage from './pages/settings/ManageUsersPage.js';
import SetupAccountPage from './pages/SetupAccountPage.js';
import { APP_VERSION, LAST_UPDATED } from './version.js';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#e53e3e' }}>Something went wrong</h2>
          <pre style={{ color: '#c53030', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedLayout() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, background: '#f8fafc' }}>
          <Outlet />
        </div>
        <footer style={{
          padding: '12px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' as const : 'row' as const,
          justifyContent: 'space-between', alignItems: 'center', gap: 2,
          fontSize: 11, color: '#94a3b8', background: '#f8fafc', flexShrink: 0,
        }}>
          <span>&copy; {new Date().getFullYear()} KinderTech. All rights reserved.</span>
          <span>v{APP_VERSION} &middot; Updated {LAST_UPDATED}</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
    <DeleteDialogProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupAccountPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/leads" element={<ErrorBoundary><LeadsPage /></ErrorBoundary>} />
          <Route path="/leads/import" element={<ErrorBoundary><ImportLeadsPage /></ErrorBoundary>} />
          <Route path="/packages" element={<ErrorBoundary><PackagesPage /></ErrorBoundary>} />
          <Route path="/settings/leads" element={<ErrorBoundary><LeadStatusSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/leads/status" element={<Navigate to="/settings/leads" replace />} />
          <Route path="/settings/whatsapp-templates" element={<ErrorBoundary><WhatsAppTemplatesPage /></ErrorBoundary>} />
          <Route path="/settings/leads/whatsapp-templates" element={<Navigate to="/settings/whatsapp-templates" replace />} />
          <Route path="/settings/leads/whatsapp-appointment" element={<Navigate to="/settings/whatsapp-templates" replace />} />
          <Route path="/settings/leads/whatsapp-followup" element={<Navigate to="/settings/whatsapp-templates" replace />} />
          <Route path="/students" element={<ErrorBoundary><StudentsPage /></ErrorBoundary>} />
          <Route path="/students/import" element={<ErrorBoundary><ImportStudentsPage /></ErrorBoundary>} />
          <Route path="/onboarding" element={<ErrorBoundary><OnboardingPage /></ErrorBoundary>} />
          <Route path="/settings/packages/assignment" element={<ErrorBoundary><PackageSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages/programmes" element={<ErrorBoundary><ProgrammesSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages/age-groups" element={<ErrorBoundary><AgeGroupsSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages" element={<Navigate to="/settings/packages/assignment" replace />} />
          <Route path="/settings/onboarding" element={<ErrorBoundary><OnboardingSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/calendar" element={<ErrorBoundary><GoogleCalendarSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/timetable/:type" element={<ErrorBoundary><TimetableSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/test/reset-leads" element={<ErrorBoundary><TestToolsPage key="reset-leads" tool="reset-leads" /></ErrorBoundary>} />
          <Route path="/settings/test/reset-students" element={<ErrorBoundary><TestToolsPage key="reset-students" tool="reset-students" /></ErrorBoundary>} />
          <Route path="/settings/test/seed-dummy" element={<ErrorBoundary><TestToolsPage key="seed-dummy" tool="seed-dummy" /></ErrorBoundary>} />
          <Route path="/settings/users" element={<ErrorBoundary><ManageUsersPage /></ErrorBoundary>} />
          <Route path="/tools/operations-planner" element={<ErrorBoundary><OperationsPlannerPage /></ErrorBoundary>} />
          <Route path="/analysis/sales-marketing" element={<ErrorBoundary><SalesMarketingPage /></ErrorBoundary>} />
          <Route path="/analysis/sales" element={<ErrorBoundary><SalesAnalysisPage /></ErrorBoundary>} />
          <Route path="/analysis/revenue" element={<ErrorBoundary><RevenueAnalysisPage /></ErrorBoundary>} />
        </Route>
        <Route path="/enquiry" element={<LandingPage />} />
        <Route path="/enquiry/form" element={<EnquiryFormPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </DeleteDialogProvider>
    </ToastProvider>
  );
}
