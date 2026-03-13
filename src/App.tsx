import { Component, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/common/Navbar.js';
import LoginPage from './pages/LoginPage.js';
import LeadsPage from './pages/LeadsPage.js';
import ImportLeadsPage from './pages/ImportLeadsPage.js';
import SettingsPage from './pages/SettingsPage.js';
import SalesMarketingPage from './pages/analysis/SalesMarketingPage.js';
import SalesAnalysisPage from './pages/analysis/SalesAnalysisPage.js';
import EnquiryPage from './pages/EnquiryPage.js';
import PackagesPage from './pages/PackagesPage.js';
import PackageSettingsPage from './pages/PackageSettingsPage.js';
import StudentsPage from './pages/StudentsPage.js';
import OnboardingSettingsPage from './pages/OnboardingSettingsPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import WhatsAppApptTemplatePage from './pages/WhatsAppApptTemplatePage.js';
import WhatsAppFollowUpPage from './pages/WhatsAppFollowUpPage.js';
import LeadStatusSettingsPage from './pages/LeadStatusSettingsPage.js';
import TestToolsPage from './pages/TestToolsPage.js';

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
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/leads" element={<ErrorBoundary><LeadsPage /></ErrorBoundary>} />
          <Route path="/leads/import" element={<ErrorBoundary><ImportLeadsPage /></ErrorBoundary>} />
          <Route path="/packages" element={<ErrorBoundary><PackagesPage /></ErrorBoundary>} />
          <Route path="/settings/leads" element={<Navigate to="/settings/leads/status" replace />} />
          <Route path="/settings/leads/status" element={<ErrorBoundary><LeadStatusSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/leads/whatsapp-appointment" element={<ErrorBoundary><WhatsAppApptTemplatePage /></ErrorBoundary>} />
          <Route path="/settings/leads/whatsapp-followup" element={<ErrorBoundary><WhatsAppFollowUpPage /></ErrorBoundary>} />
          <Route path="/students" element={<ErrorBoundary><StudentsPage /></ErrorBoundary>} />
          <Route path="/onboarding" element={<ErrorBoundary><OnboardingPage /></ErrorBoundary>} />
          <Route path="/settings/packages" element={<ErrorBoundary><PackageSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/onboarding" element={<ErrorBoundary><OnboardingSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/test/reset-leads" element={<ErrorBoundary><TestToolsPage tool="reset-leads" /></ErrorBoundary>} />
          <Route path="/settings/test/reset-students" element={<ErrorBoundary><TestToolsPage tool="reset-students" /></ErrorBoundary>} />
          <Route path="/analysis/sales-marketing" element={<ErrorBoundary><SalesMarketingPage /></ErrorBoundary>} />
          <Route path="/analysis/sales" element={<ErrorBoundary><SalesAnalysisPage /></ErrorBoundary>} />
        </Route>
        <Route path="/enquiry" element={<EnquiryPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
