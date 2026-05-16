import { Component, ReactNode, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import EmployeeCostPage from './pages/analysis/EmployeeCostPage.js';
import FinanceAnalysisPage from './pages/analysis/FinanceAnalysisPage.js';
import LandingPage from './pages/LandingPage.js';
import EnquiryFormPage from './pages/EnquiryFormPage.js';
import PackagesPage from './pages/PackagesPage.js';
import ProgrammesSettingsPage from './pages/ProgrammesSettingsPage.js';
import AgeGroupsSettingsPage from './pages/AgeGroupsSettingsPage.js';
import StudentsPage from './pages/StudentsPage.js';
import EditStudentPage from './pages/EditStudentPage.js';
import OnboardingSettingsPage from './pages/OnboardingSettingsPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import WhatsAppTemplatesPage from './pages/WhatsAppTemplatesPage.js';
import LeadStatusSettingsPage from './pages/LeadStatusSettingsPage.js';
import TestToolsPage from './pages/TestToolsPage.js';
import GoogleCalendarSettingsPage from './pages/GoogleCalendarSettingsPage.js';
import ImportStudentsPage from './pages/ImportStudentsPage.js';
import OperationsPlannerPage from './pages/OperationsPlannerPage.js';
import ProfitSharingPage from './pages/ProfitSharingPage.js';
import AnnualBonusPage from './pages/AnnualBonusPage.js';
import OperatingCostsPage from './pages/operations/OperatingCostsPage.js';
import OperatingCostCategoriesPage from './pages/settings/OperatingCostCategoriesPage.js';
import OperatingCostMainCategoriesPage from './pages/settings/OperatingCostMainCategoriesPage.js';
import TimetableSettingsPage from './pages/settings/TimetableSettingsPage.js';
import EditTeacherPage from './pages/settings/EditTeacherPage.js';
import EmployeeSalaryPage from './pages/settings/EmployeeSalaryPage.js';
import PositionEditPage from './pages/settings/PositionEditPage.js';
import CareerMissionSettingsPage from './pages/settings/CareerMissionSettingsPage.js';
import MissionCategoriesPage from './pages/settings/MissionCategoriesPage.js';
import TeachersPage from './pages/TeachersPage.js';
import TeacherCareerPage from './pages/TeacherCareerPage.js';
import TeacherMyCareerPage from './pages/TeacherMyCareerPage.js';
import TeacherMyJourneyPage from './pages/TeacherMyJourneyPage.js';
import TeacherSkillBadgesPage from './pages/TeacherSkillBadgesPage.js';
import TeacherMissionBoardPage from './pages/TeacherMissionBoardPage.js';
import TeacherAppraisalPage from './pages/TeacherAppraisalPage.js';
import TeacherCompensationPage from './pages/TeacherCompensationPage.js';
import TeacherPayPage from './pages/TeacherPayPage.js';
import TeacherPayBreakdownPage from './pages/TeacherPayBreakdownPage.js';
import TeacherMyCompensationEarnMorePage from './pages/TeacherMyCompensationEarnMorePage.js';
import TeacherMyCompensationBenefitsPage from './pages/TeacherMyCompensationBenefitsPage.js';
import TeacherRewardsPage from './pages/TeacherRewardsPage.js';
import TeacherRedeemCatalogPage from './pages/TeacherRedeemCatalogPage.js';
import TeacherEarnPointsPage from './pages/TeacherEarnPointsPage.js';
import TeacherRedeemedRewardPage from './pages/TeacherRedeemedRewardPage.js';
import TeacherRewardDetailsPage from './pages/TeacherRewardDetailsPage.js';
import ManageUsersPage from './pages/settings/ManageUsersPage.js';
import YearRolloverPage from './pages/settings/YearRolloverPage.js';
import FinanceSettingsPage from './pages/FinanceSettingsPage.js';
import CompensationSettingsPage from './pages/settings/CompensationSettingsPage.js';
import PointsRewardsSettingsPage from './pages/settings/PointsRewardsSettingsPage.js';
import PointsRewardsAddPage from './pages/settings/PointsRewardsAddPage.js';
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
  // The page content scrolls inside this div (the shell is
  // height:100vh / overflow:hidden), so a route change must reset
  // *this* element's scroll — window.scrollTo would do nothing.
  // Keyed on pathname only: navigating to a new page always starts
  // at the top, while query/hash-only updates leave scroll alone.
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, background: '#f8fafc' }}>
          <Outlet />
        </div>
        <AppFooter />
      </div>
    </div>
  );
}

// Footer is suppressed on the teacher-facing mobile hubs (`/my-career`,
// `/my-compensation`, `/my-journey`) so those pages read as a focused
// app surface, not a back-office screen with corporate chrome. Every
// other route (admin / HR) keeps it.
function AppFooter() {
  const { pathname } = useLocation();
  const isTeacherView = /\/teachers\/[^/]+\/(my-career|my-compensation|my-journey)/.test(pathname);
  if (isTeacherView) return null;
  return (
    <footer style={{
      padding: '12px 24px', borderTop: '1px solid #e2e8f0',
      display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' as const : 'row' as const,
      justifyContent: 'space-between', alignItems: 'center', gap: 2,
      fontSize: 11, color: '#94a3b8', background: '#f8fafc', flexShrink: 0,
    }}>
      <span>&copy; {new Date().getFullYear()} KinderTech. All rights reserved.</span>
      <span>v{APP_VERSION} &middot; Updated {LAST_UPDATED}</span>
    </footer>
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
          <Route path="/students/:id" element={<ErrorBoundary><EditStudentPage /></ErrorBoundary>} />
          <Route path="/onboarding" element={<ErrorBoundary><OnboardingPage /></ErrorBoundary>} />
          {/* Package Assignment was merged into the unified /packages page (matrix-based) */}
          <Route path="/settings/packages/assignment" element={<Navigate to="/packages" replace />} />
          <Route path="/settings/packages/programmes" element={<ErrorBoundary><ProgrammesSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages/age-groups" element={<ErrorBoundary><AgeGroupsSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages" element={<Navigate to="/packages" replace />} />
          <Route path="/settings/onboarding" element={<ErrorBoundary><OnboardingSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/calendar" element={<ErrorBoundary><GoogleCalendarSettingsPage /></ErrorBoundary>} />
          <Route path="/teachers" element={<ErrorBoundary><TeachersPage /></ErrorBoundary>} />
          <Route path="/teachers/:id" element={<ErrorBoundary><EditTeacherPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/career" element={<ErrorBoundary><TeacherCareerPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-career" element={<ErrorBoundary><TeacherMyCareerPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-career/journey" element={<ErrorBoundary><TeacherMyJourneyPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-career/skill-badges" element={<ErrorBoundary><TeacherSkillBadgesPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/career/missions" element={<ErrorBoundary><TeacherMissionBoardPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/appraisal" element={<ErrorBoundary><TeacherAppraisalPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/compensation" element={<ErrorBoundary><TeacherCompensationPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-compensation" element={<ErrorBoundary><TeacherPayPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-compensation/breakdown" element={<ErrorBoundary><TeacherPayBreakdownPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-compensation/earn-more" element={<ErrorBoundary><TeacherMyCompensationEarnMorePage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-compensation/benefits" element={<ErrorBoundary><TeacherMyCompensationBenefitsPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/rewards" element={<ErrorBoundary><TeacherRewardsPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/rewards/catalog" element={<ErrorBoundary><TeacherRedeemCatalogPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/rewards/catalog/:rewardId" element={<ErrorBoundary><TeacherRewardDetailsPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/rewards/earn" element={<ErrorBoundary><TeacherEarnPointsPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/rewards/my/:redemptionId" element={<ErrorBoundary><TeacherRedeemedRewardPage /></ErrorBoundary>} />
          <Route path="/settings/points-rewards" element={<ErrorBoundary><PointsRewardsSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/points-rewards/add/:kind" element={<ErrorBoundary><PointsRewardsAddPage /></ErrorBoundary>} />
          <Route path="/settings/points-rewards/edit/:kind/:id" element={<ErrorBoundary><PointsRewardsAddPage /></ErrorBoundary>} />
          <Route path="/settings/employee-salary" element={<ErrorBoundary><EmployeeSalaryPage /></ErrorBoundary>} />
          <Route path="/settings/employee-salary/positions/new" element={<ErrorBoundary><PositionEditPage /></ErrorBoundary>} />
          <Route path="/settings/employee-salary/positions/:id/edit" element={<ErrorBoundary><PositionEditPage /></ErrorBoundary>} />
          <Route path="/settings/career-missions" element={<ErrorBoundary><CareerMissionSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/mission-categories" element={<ErrorBoundary><MissionCategoriesPage /></ErrorBoundary>} />
          <Route path="/settings/timetable/:type" element={<ErrorBoundary><TimetableSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/test/reset-leads" element={<ErrorBoundary><TestToolsPage key="reset-leads" tool="reset-leads" /></ErrorBoundary>} />
          <Route path="/settings/test/reset-students" element={<ErrorBoundary><TestToolsPage key="reset-students" tool="reset-students" /></ErrorBoundary>} />
          <Route path="/settings/test/seed-dummy" element={<ErrorBoundary><TestToolsPage key="seed-dummy" tool="seed-dummy" /></ErrorBoundary>} />
          <Route path="/settings/users" element={<ErrorBoundary><ManageUsersPage /></ErrorBoundary>} />
          <Route path="/admin/year-rollover" element={<ErrorBoundary><YearRolloverPage /></ErrorBoundary>} />
          <Route path="/tools/operations-planner" element={<ErrorBoundary><OperationsPlannerPage /></ErrorBoundary>} />
          <Route path="/tools/profit-sharing" element={<Navigate to="/analysis/profit-sharing" replace />} />
          <Route path="/operations/operating-costs" element={<ErrorBoundary><OperatingCostsPage /></ErrorBoundary>} />
          <Route path="/settings/operating-cost-main-categories" element={<ErrorBoundary><OperatingCostMainCategoriesPage /></ErrorBoundary>} />
          <Route path="/settings/operating-cost-categories" element={<ErrorBoundary><OperatingCostCategoriesPage /></ErrorBoundary>} />
          <Route path="/settings/finance" element={<ErrorBoundary><FinanceSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/compensation" element={<ErrorBoundary><CompensationSettingsPage /></ErrorBoundary>} />
          <Route path="/analysis/sales-marketing" element={<ErrorBoundary><SalesMarketingPage /></ErrorBoundary>} />
          <Route path="/analysis/sales" element={<ErrorBoundary><SalesAnalysisPage /></ErrorBoundary>} />
          <Route path="/analysis/revenue" element={<ErrorBoundary><RevenueAnalysisPage /></ErrorBoundary>} />
          <Route path="/analysis/employee-cost" element={<ErrorBoundary><EmployeeCostPage /></ErrorBoundary>} />
          <Route path="/analysis/finance" element={<ErrorBoundary><FinanceAnalysisPage /></ErrorBoundary>} />
          <Route path="/analysis/profit-sharing" element={<ErrorBoundary><ProfitSharingPage /></ErrorBoundary>} />
          <Route path="/analysis/annual-bonus" element={<ErrorBoundary><AnnualBonusPage /></ErrorBoundary>} />
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
