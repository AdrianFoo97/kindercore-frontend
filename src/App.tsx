import { Component, ReactNode, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/common/Navbar.js';
import { ToastProvider } from './components/common/Toast.js';
import { DeleteDialogProvider } from './components/common/DeleteDialog.js';
import LoginPage from './pages/LoginPage.js';
import LeadsPage from './pages/LeadsPage.js';
import ImportLeadsPage from './pages/ImportLeadsPage.js';
import SettingsDataPage from './pages/settings/SettingsDataPage.js';
import SettingsPage from './pages/SettingsPage.js';
import SalesMarketingPage from './pages/analysis/SalesMarketingPage.js';
import SalesAnalysisPage from './pages/analysis/SalesAnalysisPage.js';
import RevenueAnalysisPage from './pages/analysis/RevenueAnalysisPage.js';
import EmployeeCostPage from './pages/analysis/EmployeeCostPage.js';
import OperatingCostAnalysisPage from './pages/analysis/operating-cost/OperatingCostAnalysisPage.js';
import FinanceAnalysisPage from './pages/analysis/FinanceAnalysisPage.js';
import LandingPage from './pages/LandingPage.js';
import EnquiryFormPage from './pages/EnquiryFormPage.js';
import PackagesPage from './pages/PackagesPage.js';
import ProgrammesSettingsPage from './pages/ProgrammesSettingsPage.js';
import AgeGroupsSettingsPage from './pages/AgeGroupsSettingsPage.js';
import SettingsPackagesPage from './pages/settings/SettingsPackagesPage.js';
import StudentsPage from './pages/StudentsPage.js';
import EditStudentPage from './pages/EditStudentPage.js';
import OnboardingSettingsPage from './pages/OnboardingSettingsPage.js';
import OnboardingPage from './pages/OnboardingPage.js';
import WhatsAppTemplatesPage from './pages/WhatsAppTemplatesPage.js';
import LeadStatusSettingsPage from './pages/LeadStatusSettingsPage.js';
import CompanySettingsPage from './pages/CompanySettingsPage.js';
import TestToolsPage from './pages/TestToolsPage.js';
import GoogleCalendarSettingsPage from './pages/GoogleCalendarSettingsPage.js';
import ImportStudentsPage from './pages/ImportStudentsPage.js';
import OperationsPlannerPage from './pages/OperationsPlannerPage.js';
import ProfitSharingPage from './pages/ProfitSharingPage.js';
import AnnualBonusPage from './pages/AnnualBonusPage.js';
import OperatingCostsPage from './pages/operations/OperatingCostsPage.js';
import OperatingCostCategoriesPage from './pages/settings/OperatingCostCategoriesPage.js';
import OperatingCostMainCategoriesPage from './pages/settings/OperatingCostMainCategoriesPage.js';
import SettingsOperatingCostPage from './pages/settings/SettingsOperatingCostPage.js';
import TimetableSettingsPage from './pages/settings/TimetableSettingsPage.js';
import EditTeacherPage from './pages/settings/EditTeacherPage.js';
import EmployeeSalaryPage from './pages/settings/EmployeeSalaryPage.js';
import SettingsHrPage from './pages/settings/SettingsHrPage.js';
import PositionEditPage from './pages/settings/PositionEditPage.js';
import CareerMissionSettingsPage from './pages/settings/CareerMissionSettingsPage.js';
import MissionCategoriesPage from './pages/settings/MissionCategoriesPage.js';
import SopLibraryPage from './pages/operations/SopLibraryPage.js';
import SopTemplateFormPage from './pages/operations/SopTemplateFormPage.js';
import SopProposePage from './pages/operations/SopProposePage.js';
import HrSopRevisionsPage from './pages/HrSopRevisionsPage.js';
import SopTemplateStepsPage from './pages/operations/SopTemplateStepsPage.js';
import SopCategoriesPage from './pages/settings/SopCategoriesPage.js';
import SopSectionsPage from './pages/settings/SopSectionsPage.js';
import SettingsOperationPage from './pages/settings/SettingsOperationPage.js';
import SopObservationsPage from './pages/SopObservationsPage.js';
import SopObservationNewPage from './pages/SopObservationNewPage.js';
import SopObservationDetailPage from './pages/SopObservationDetailPage.js';
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
import AuthRolesPage from './pages/settings/AuthRolesPage.js';
import AuthRoleEditPage from './pages/settings/AuthRoleEditPage.js';
import { RequireModule } from './components/common/RequireModule.js';
import { MODULES } from './constants/authModules.js';
import NoAccessPage from './pages/NoAccessPage.js';
import YearRolloverPage from './pages/settings/YearRolloverPage.js';
import FinanceSettingsPage from './pages/FinanceSettingsPage.js';
import CompensationSettingsPage from './pages/settings/CompensationSettingsPage.js';
import PointsRewardsSettingsPage from './pages/settings/PointsRewardsSettingsPage.js';
import PointsRewardsAddPage from './pages/settings/PointsRewardsAddPage.js';
import SetupAccountPage from './pages/SetupAccountPage.js';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.js';
import TermsOfServicePage from './pages/TermsOfServicePage.js';
import HomePage from './pages/HomePage.js';
import ApplyPage from './pages/ApplyPage.js';
import CandidatesPage from './pages/CandidatesPage.js';
import ImportCandidatesPage from './pages/candidates/ImportCandidatesPage.js';
import RecruitmentSettingsPage from './pages/settings/RecruitmentSettingsPage.js';
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
        {/* Public homepage — explains the product, links visibly to
            /privacy and /terms, and lives outside any auth gate so
            Google's OAuth verification reviewer can read it. */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupAccountPage />} />
        {/* Public legal pages — must be reachable without auth so the
            Google OAuth verification reviewer can open them. */}
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/no-access" element={<ErrorBoundary><NoAccessPage /></ErrorBoundary>} />
          <Route path="/leads" element={<RequireModule module={MODULES.LEADS}><ErrorBoundary><LeadsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/leads/import" element={<RequireModule module={MODULES.LEADS}><ErrorBoundary><ImportLeadsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/packages" element={<ErrorBoundary><PackagesPage /></ErrorBoundary>} />
          <Route path="/settings/leads" element={<ErrorBoundary><LeadStatusSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/company" element={<ErrorBoundary><CompanySettingsPage /></ErrorBoundary>} />
          <Route path="/settings/leads/status" element={<Navigate to="/settings/leads" replace />} />
          <Route path="/settings/whatsapp-templates" element={<ErrorBoundary><WhatsAppTemplatesPage /></ErrorBoundary>} />
          <Route path="/settings/leads/whatsapp-templates" element={<Navigate to="/settings/whatsapp-templates" replace />} />
          <Route path="/settings/leads/whatsapp-appointment" element={<Navigate to="/settings/whatsapp-templates" replace />} />
          <Route path="/settings/leads/whatsapp-followup" element={<Navigate to="/settings/whatsapp-templates" replace />} />
          <Route path="/students" element={<RequireModule module={MODULES.STUDENTS}><ErrorBoundary><StudentsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/students/import" element={<RequireModule module={MODULES.STUDENTS}><ErrorBoundary><ImportStudentsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/students/:id" element={<RequireModule module={MODULES.STUDENTS}><ErrorBoundary><EditStudentPage /></ErrorBoundary></RequireModule>} />
          <Route path="/onboarding" element={<RequireModule module={MODULES.STUDENTS}><ErrorBoundary><OnboardingPage /></ErrorBoundary></RequireModule>} />
          {/* Package Assignment was merged into the unified /packages page (matrix-based) */}
          <Route path="/settings/packages/assignment" element={<Navigate to="/packages" replace />} />
          <Route path="/settings/packages/programmes" element={<ErrorBoundary><ProgrammesSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages/age-groups" element={<ErrorBoundary><AgeGroupsSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/packages" element={<ErrorBoundary><SettingsPackagesPage /></ErrorBoundary>} />
          <Route path="/settings/packages" element={<Navigate to="/packages" replace />} />
          <Route path="/settings/onboarding" element={<ErrorBoundary><OnboardingSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/calendar" element={<ErrorBoundary><GoogleCalendarSettingsPage /></ErrorBoundary>} />
          <Route path="/teachers" element={<RequireModule module={MODULES.HR}><ErrorBoundary><TeachersPage /></ErrorBoundary></RequireModule>} />
          <Route path="/teachers/:id" element={<RequireModule module={MODULES.HR}><ErrorBoundary><EditTeacherPage /></ErrorBoundary></RequireModule>} />
          <Route path="/hr/candidates" element={<RequireModule module={MODULES.HR}><ErrorBoundary><CandidatesPage /></ErrorBoundary></RequireModule>} />
          <Route path="/hr/candidates/import" element={<RequireModule module={MODULES.HR}><ErrorBoundary><ImportCandidatesPage /></ErrorBoundary></RequireModule>} />
          <Route path="/hr/sop-observations" element={<RequireModule module={MODULES.HR}><ErrorBoundary><SopObservationsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/hr/sop-observations/new" element={<RequireModule module={MODULES.HR}><ErrorBoundary><SopObservationNewPage /></ErrorBoundary></RequireModule>} />
          <Route path="/hr/sop-observations/:id" element={<RequireModule module={MODULES.HR}><ErrorBoundary><SopObservationDetailPage /></ErrorBoundary></RequireModule>} />
          {/* Lives at /hr/* but its nav entry is under the Operation dropdown
              (see Navbar.tsx) — gate follows the nav placement, not the URL prefix. */}
          <Route path="/hr/sop-revisions" element={<RequireModule module={MODULES.OPERATION}><ErrorBoundary><HrSopRevisionsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/settings/data" element={<ErrorBoundary><SettingsDataPage /></ErrorBoundary>} />
          <Route path="/settings/recruitment" element={<ErrorBoundary><RecruitmentSettingsPage /></ErrorBoundary>} />
          {/* Admin/legacy views of a teacher's record — see the
              TeacherXyzPage vs TeacherMyXyzPage naming convention in
              CLAUDE.md. Gated under HR since these are staff HR-ops
              screens, not the teacher's own self-service mobile app. */}
          <Route path="/teachers/:id/career" element={<RequireModule module={MODULES.HR}><ErrorBoundary><TeacherCareerPage /></ErrorBoundary></RequireModule>} />
          <Route path="/teachers/:id/appraisal" element={<RequireModule module={MODULES.HR}><ErrorBoundary><TeacherAppraisalPage /></ErrorBoundary></RequireModule>} />
          <Route path="/teachers/:id/compensation" element={<RequireModule module={MODULES.HR}><ErrorBoundary><TeacherCompensationPage /></ErrorBoundary></RequireModule>} />
          {/* Teacher-facing mobile app (bottom-nav tabs Home / Career / Pay /
              Rewards / Leaderboard) — a teacher's own self-service access to
              their own record, orthogonal to the admin nav Module system.
              Deliberately NOT gated by RequireModule here; ownership
              enforcement (a teacher only ever reaching their own :id) is a
              separate, still-open gap tracked in CLAUDE.md's known debt. */}
          <Route path="/teachers/:id/my-career" element={<ErrorBoundary><TeacherMyCareerPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-career/journey" element={<ErrorBoundary><TeacherMyJourneyPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/my-career/skill-badges" element={<ErrorBoundary><TeacherSkillBadgesPage /></ErrorBoundary>} />
          <Route path="/teachers/:id/career/missions" element={<ErrorBoundary><TeacherMissionBoardPage /></ErrorBoundary>} />
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
          <Route path="/settings/hr" element={<ErrorBoundary><SettingsHrPage /></ErrorBoundary>} />
          <Route path="/settings/timetable/:type" element={<ErrorBoundary><TimetableSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/test/reset-leads" element={<ErrorBoundary><TestToolsPage key="reset-leads" tool="reset-leads" /></ErrorBoundary>} />
          <Route path="/settings/test/reset-students" element={<ErrorBoundary><TestToolsPage key="reset-students" tool="reset-students" /></ErrorBoundary>} />
          <Route path="/settings/test/reset-candidates" element={<ErrorBoundary><TestToolsPage key="reset-candidates" tool="reset-candidates" /></ErrorBoundary>} />
          <Route path="/settings/test/seed-dummy" element={<ErrorBoundary><TestToolsPage key="seed-dummy" tool="seed-dummy" /></ErrorBoundary>} />
          <Route path="/settings/test/seed-candidates" element={<ErrorBoundary><TestToolsPage key="seed-candidates" tool="seed-candidates" /></ErrorBoundary>} />
          <Route path="/settings/users" element={<ErrorBoundary><ManageUsersPage /></ErrorBoundary>} />
          <Route path="/settings/auth-roles" element={<ErrorBoundary><AuthRolesPage /></ErrorBoundary>} />
          <Route path="/settings/auth-roles/new" element={<ErrorBoundary><AuthRoleEditPage /></ErrorBoundary>} />
          <Route path="/settings/auth-roles/:id/edit" element={<ErrorBoundary><AuthRoleEditPage /></ErrorBoundary>} />
          <Route path="/admin/year-rollover" element={<ErrorBoundary><YearRolloverPage /></ErrorBoundary>} />
          <Route path="/tools/operations-planner" element={<RequireModule module={MODULES.TOOLS}><ErrorBoundary><OperationsPlannerPage /></ErrorBoundary></RequireModule>} />
          <Route path="/tools/profit-sharing" element={<Navigate to="/analysis/profit-sharing" replace />} />
          <Route path="/operations/operating-costs" element={<RequireModule module={MODULES.FINANCE}><ErrorBoundary><OperatingCostsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/operations/sops" element={<RequireModule module={MODULES.OPERATION}><ErrorBoundary><SopLibraryPage /></ErrorBoundary></RequireModule>} />
          <Route path="/operations/sops/new" element={<RequireModule module={MODULES.OPERATION}><ErrorBoundary><SopTemplateFormPage /></ErrorBoundary></RequireModule>} />
          <Route path="/operations/sops/propose" element={<RequireModule module={MODULES.OPERATION}><ErrorBoundary><SopProposePage /></ErrorBoundary></RequireModule>} />
          <Route path="/operations/sops/:templateId" element={<RequireModule module={MODULES.OPERATION}><ErrorBoundary><SopTemplateStepsPage /></ErrorBoundary></RequireModule>} />
          <Route path="/operations/sops/:templateId/propose" element={<RequireModule module={MODULES.OPERATION}><ErrorBoundary><SopProposePage /></ErrorBoundary></RequireModule>} />
          <Route path="/settings/sop-categories" element={<ErrorBoundary><SopCategoriesPage /></ErrorBoundary>} />
          <Route path="/settings/sop-sections" element={<ErrorBoundary><SopSectionsPage /></ErrorBoundary>} />
          <Route path="/settings/operation" element={<ErrorBoundary><SettingsOperationPage /></ErrorBoundary>} />
          <Route path="/settings/operating-cost-main-categories" element={<ErrorBoundary><OperatingCostMainCategoriesPage /></ErrorBoundary>} />
          <Route path="/settings/operating-cost-categories" element={<ErrorBoundary><OperatingCostCategoriesPage /></ErrorBoundary>} />
          <Route path="/settings/operating-cost" element={<ErrorBoundary><SettingsOperatingCostPage /></ErrorBoundary>} />
          <Route path="/settings/finance" element={<ErrorBoundary><FinanceSettingsPage /></ErrorBoundary>} />
          <Route path="/settings/compensation" element={<ErrorBoundary><CompensationSettingsPage /></ErrorBoundary>} />
          <Route path="/analysis/sales-marketing" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><SalesMarketingPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/sales" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><SalesAnalysisPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/revenue" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><RevenueAnalysisPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/employee-cost" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><EmployeeCostPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/operating-cost" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><OperatingCostAnalysisPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/finance" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><FinanceAnalysisPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/profit-sharing" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><ProfitSharingPage /></ErrorBoundary></RequireModule>} />
          <Route path="/analysis/annual-bonus" element={<RequireModule module={MODULES.ANALYSIS}><ErrorBoundary><AnnualBonusPage /></ErrorBoundary></RequireModule>} />
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
